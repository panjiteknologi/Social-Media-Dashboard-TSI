import { and, desc, eq, gt, isNull, lt, or, sql } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import {
  AI_STALE_MINUTES,
  AI_TASK_LABELS,
  aiTaskBlocker,
  isAiBusy,
  type AiTask,
  type ContentAiDetail,
  type TopicRecommendation,
  type TopicsResponse,
} from '../../shared/aiContent';
import type { CurrentUser } from '../../shared/api';
import type { ContentItem, ContentPriority } from '../../shared/planner';
import type { Db } from '../db/client';
import { contentItems, jobRuns, topicRecommendations } from '../db/schema';
import type { JobEnvelope } from '../jobs/job';
import { aiSummaryOf, ContentError, createContent } from '../planner/service';

export const CONTENT_AI_JOB = 'content-ai';
export const TOPICS_JOB = 'topic-recommendations';

/** A topic run still marked running after this long was cut off. */
const TOPIC_RUN_STALE_MS = 20 * 60_000;

type TopicRow = typeof topicRecommendations.$inferSelect;

const toTopic = (row: TopicRow): TopicRecommendation => ({
  id: row.id,
  keyword: row.keyword,
  title: row.title,
  intent: row.intent,
  action: row.action,
  existingUrl: row.existingUrl,
  angle: row.angle,
  reason: row.reason,
  cluster: row.cluster,
  impressions: row.impressions,
  position: row.position,
  opportunityScore: row.opportunityScore,
  status: row.status,
  contentItemId: row.contentItemId,
  createdAt: row.createdAt.toISOString(),
});

/** Open recommendations, best opportunity first, and how the last run went. */
export async function listTopics(db: Db, configured: boolean): Promise<TopicsResponse> {
  const [rows, [lastRun]] = await Promise.all([
    db
      .select()
      .from(topicRecommendations)
      .where(eq(topicRecommendations.status, 'new'))
      .orderBy(desc(sql`coalesce(${topicRecommendations.opportunityScore}, -1)`), desc(topicRecommendations.impressions)),
    db
      .select({ status: jobRuns.status, startedAt: jobRuns.startedAt, finishedAt: jobRuns.finishedAt, error: jobRuns.error })
      .from(jobRuns)
      .where(eq(jobRuns.jobName, TOPICS_JOB))
      .orderBy(desc(jobRuns.startedAt))
      .limit(1),
  ]);
  return {
    configured,
    items: rows.map(toTopic),
    lastRun: lastRun
      ? {
          status: lastRun.status,
          startedAt: lastRun.startedAt.toISOString(),
          finishedAt: lastRun.finishedAt?.toISOString() ?? null,
          error: lastRun.error,
        }
      : null,
  };
}

export async function queueTopicRun(db: Db, boss: PgBoss, user: CurrentUser): Promise<void> {
  const [running] = await db
    .select({ id: jobRuns.id })
    .from(jobRuns)
    .where(
      and(
        eq(jobRuns.jobName, TOPICS_JOB),
        eq(jobRuns.status, 'running'),
        gt(jobRuns.startedAt, new Date(Date.now() - TOPIC_RUN_STALE_MS)),
      ),
    )
    .limit(1);
  if (running) throw new ContentError('Topic recommendations are already being generated.', 409);
  const envelope: JobEnvelope = { trigger: 'manual', triggeredBy: user.id, input: null };
  await boss.send(TOPICS_JOB, envelope);
}

const priorityFor = (score: number | null): ContentPriority =>
  score === null ? 'medium' : score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';

/** Turns a recommendation into an idea in the Content Planner, with the reasoning in its notes. */
export async function planTopic(db: Db, id: string, user: CurrentUser): Promise<ContentItem> {
  // Claimed first, so a double click cannot plan the same topic twice.
  const [topic] = await db
    .update(topicRecommendations)
    .set({ status: 'planned', updatedAt: new Date() })
    .where(and(eq(topicRecommendations.id, id), eq(topicRecommendations.status, 'new')))
    .returning();
  if (!topic) {
    const [exists] = await db.select({ id: topicRecommendations.id }).from(topicRecommendations).where(eq(topicRecommendations.id, id));
    throw exists
      ? new ContentError('This recommendation was already planned or dismissed.', 409)
      : new ContentError('Recommendation not found', 404);
  }

  const notes = [
    topic.angle,
    topic.reason ? `Why: ${topic.reason}` : null,
    `Search Console, last 28 days: ${topic.impressions} impressions at average position ${topic.position.toFixed(1)}.`,
    topic.existingUrl ? `Update the existing article instead of writing a new one: ${topic.existingUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  try {
    const item = await createContent(
      db,
      {
        title: topic.title.slice(0, 200),
        type: 'article',
        stage: 'idea',
        keyword: topic.keyword.slice(0, 120),
        campaign: null,
        priority: priorityFor(topic.opportunityScore),
        dueDate: null,
        ownerId: null,
        notes: notes.slice(0, 5000),
      },
      user,
    );
    await db.update(topicRecommendations).set({ contentItemId: item.id }).where(eq(topicRecommendations.id, id));
    return item;
  } catch (error) {
    await db.update(topicRecommendations).set({ status: 'new' }).where(eq(topicRecommendations.id, id));
    throw error;
  }
}

export async function dismissTopic(db: Db, id: string): Promise<void> {
  const dismissed = await db
    .update(topicRecommendations)
    .set({ status: 'dismissed', updatedAt: new Date() })
    .where(and(eq(topicRecommendations.id, id), eq(topicRecommendations.status, 'new')))
    .returning({ id: topicRecommendations.id });
  if (dismissed.length === 0) throw new ContentError('Recommendation not found or already handled', 404);
}

export async function getContentAi(db: Db, configured: boolean, id: string): Promise<ContentAiDetail> {
  const [row] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!row) throw new ContentError('Content not found', 404);
  return { configured, summary: aiSummaryOf(row), brief: row.brief, draft: row.draft, qa: row.qa };
}

/** Queues one AI task for an item, unless it cannot run yet or another task is still working. */
export async function queueContentTask(
  deps: { db: Db; boss: PgBoss; configured: boolean },
  id: string,
  task: AiTask,
  user: CurrentUser,
): Promise<ContentAiDetail> {
  const { db, boss, configured } = deps;
  const [row] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!row) throw new ContentError('Content not found', 404);
  if (!configured) throw new ContentError('OPENROUTER_API_KEY is not set.', 400);

  const summary = aiSummaryOf(row);
  const blocker = aiTaskBlocker(task, { type: row.type, hasBrief: summary.hasBrief, hasDraft: summary.hasDraft });
  if (blocker) throw new ContentError(blocker, 400);
  const busyError = new ContentError(`The AI is still working on the ${AI_TASK_LABELS[row.aiTask ?? task]}.`, 409);
  if (isAiBusy(summary)) throw busyError;

  // A conditional update, so two clicks at once queue one task.
  const staleBefore = new Date(Date.now() - AI_STALE_MINUTES * 60_000);
  const claimed = await db
    .update(contentItems)
    .set({ aiTask: task, aiStatus: 'queued', aiError: null, aiUpdatedAt: new Date() })
    .where(
      and(
        eq(contentItems.id, id),
        or(isNull(contentItems.aiStatus), eq(contentItems.aiStatus, 'failed'), lt(contentItems.aiUpdatedAt, staleBefore)),
      ),
    )
    .returning({ id: contentItems.id });
  if (claimed.length === 0) throw busyError;

  const envelope: JobEnvelope = { trigger: 'manual', triggeredBy: user.id, input: { itemId: id, task, userId: user.id } };
  try {
    const queueJobId = await boss.send(CONTENT_AI_JOB, envelope);
    if (!queueJobId) throw new Error('The job queue did not accept the task.');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db
      .update(contentItems)
      .set({ aiStatus: 'failed', aiError: message, aiUpdatedAt: new Date() })
      .where(eq(contentItems.id, id));
    throw error;
  }
  return getContentAi(db, configured, id);
}
