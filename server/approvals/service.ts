import { eq } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import type { CurrentUser } from '../../shared/api';
import { DECISIONS, DECISION_LABELS, DECISION_STAGE, decisionBlocker, type DecisionInput } from '../../shared/approvals';
import type { ContentItem } from '../../shared/planner';
import { CONTENT_AI_JOB } from '../contentAi/service';
import type { Db } from '../db/client';
import { contentEvents, contentItems } from '../db/schema';
import type { JobEnvelope } from '../jobs/job';
import type { Alerter } from '../jobs/runner';
import { buildDecisionMessage } from '../notify/approvals';
import { ContentError, getContentItem } from '../planner/service';

export const DecisionInputSchema = z.object({
  decision: z.enum(DECISIONS),
  note: z.string().max(5000).default(''),
  /** For a revision: let the AI rewrite the draft from the note and the QA issues. */
  useAi: z.boolean().default(true),
});

export interface DecisionDeps {
  db: Db;
  boss: PgBoss;
  alerter: Alerter;
  appBaseUrl: string;
  aiConfigured: boolean;
}

/**
 * Records an approver's decision: it moves the content, writes the reason into
 * its history, starts the AI revision when asked, and tells the team.
 */
export async function decideContent(
  deps: DecisionDeps,
  id: string,
  input: DecisionInput,
  user: CurrentUser,
): Promise<ContentItem> {
  const { db } = deps;
  const [row] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!row) throw new ContentError('Content not found', 404);

  const blocker = decisionBlocker({ stage: row.stage, hasDraft: row.draft !== null }, input);
  // A decision on content that already left Review is a conflict, not bad input.
  if (blocker) throw new ContentError(blocker, row.stage === 'review' ? 400 : 409);

  const stage = DECISION_STAGE[input.decision];
  const note = input.note.trim();
  const aiRevising = input.decision === 'revise' && input.useAi && deps.aiConfigured && row.draft !== null;
  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .update(contentItems)
      .set({
        stage,
        updatedAt: now,
        ...(aiRevising ? { aiTask: 'revise' as const, aiStatus: 'queued' as const, aiError: null, aiUpdatedAt: now } : {}),
      })
      .where(eq(contentItems.id, id));
    await tx.insert(contentEvents).values({
      itemId: id,
      kind: 'decision',
      fromStage: row.stage,
      toStage: stage,
      note: note ? `${DECISION_LABELS[input.decision]}: ${note}` : DECISION_LABELS[input.decision],
      userId: user.id,
    });
  });

  if (aiRevising) {
    const envelope: JobEnvelope = {
      trigger: 'manual',
      triggeredBy: user.id,
      input: { itemId: id, task: 'revise', userId: user.id, note },
    };
    try {
      const queueJobId = await deps.boss.send(CONTENT_AI_JOB, envelope);
      if (!queueJobId) throw new Error('The job queue did not accept the revision.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await db
        .update(contentItems)
        .set({ aiStatus: 'failed', aiError: message, aiUpdatedAt: new Date() })
        .where(eq(contentItems.id, id));
    }
  }

  // The decision is recorded either way: a Telegram problem must not undo it.
  try {
    await deps.alerter.send(
      buildDecisionMessage(row, input.decision, note, user.name ?? user.email, deps.appBaseUrl, aiRevising),
    );
  } catch (error) {
    console.error('[approvals] Could not send the decision notification:', error);
  }

  return getContentItem(db, id);
}
