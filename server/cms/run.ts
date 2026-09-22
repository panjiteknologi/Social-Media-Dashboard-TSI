import { eq, isNotNull } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import type { CurrentUser } from '../../shared/api';
import type { ContentStage } from '../../shared/planner';
import { isPublishBusy, publishBlocker, type PublishStatus, type PublishSummary } from '../../shared/publishing';
import type { Db } from '../db/client';
import { articles, contentEvents, contentItems } from '../db/schema';
import type { Env } from '../env';
import type { JobEnvelope } from '../jobs/job';
import { ContentError, publishSummaryOf } from '../planner/service';
import { getSeoSettings } from '../seo/settings';
import { articleUrl, buildCmsPayload, writeArticleToCms } from './publish';

export const CMS_PUBLISH_JOB = 'cms-publish';

export const CmsPublishInput = z.object({
  itemId: z.uuid(),
  /** Who asked, for the content history. */
  userId: z.uuid().nullable().default(null),
  /** Write it even though the CMS already holds an article with this title. */
  force: z.boolean().default(false),
});

export interface CmsPublishDeps {
  db: Db;
  env: Env;
  /** Tells the team the article is waiting in the CMS; left out in tests. */
  notify?: (text: string) => Promise<void>;
}

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

async function setPublishState(db: Db, itemId: string, status: PublishStatus | null, error: string | null) {
  await db
    .update(contentItems)
    .set({ publishStatus: status, publishError: error, publishUpdatedAt: new Date() })
    .where(eq(contentItems.id, itemId));
}

/** Queues the publish job for one article, unless it cannot go yet or is already on its way. */
export async function queueCmsPublish(
  deps: { db: Db; boss: PgBoss },
  id: string,
  user: CurrentUser,
  force = false,
): Promise<PublishSummary> {
  const { db, boss } = deps;
  const [row] = await db.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  if (!row) throw new ContentError('Content not found', 404);

  const blocker = publishBlocker({ type: row.type, hasDraft: row.draft !== null, stage: row.stage });
  if (blocker) throw new ContentError(blocker, 400);
  const summary = publishSummaryOf(row, (await getSeoSettings(db)).contentHost);
  if (isPublishBusy(summary)) throw new ContentError('This article is already on its way to the CMS.', 409);

  await setPublishState(db, id, 'queued', null);
  const envelope: JobEnvelope = {
    trigger: 'manual',
    triggeredBy: user.id,
    input: { itemId: id, userId: user.id, force },
  };
  try {
    const queueJobId = await boss.send(CMS_PUBLISH_JOB, envelope);
    if (!queueJobId) throw new Error('The job queue did not accept the article.');
  } catch (error) {
    await setPublishState(db, id, 'failed', errorText(error));
    throw error;
  }
  return { ...summary, status: 'queued', error: null, updatedAt: new Date().toISOString() };
}

/** Sends one approved article to the CMS as a draft, or updates the draft it sent before. */
export async function runCmsPublish(deps: CmsPublishDeps, rawInput: unknown) {
  const { itemId, userId, force } = CmsPublishInput.parse(rawInput);
  const { db, env } = deps;

  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, itemId)).limit(1);
  if (!item) return { skipped: true, reason: 'The content item was deleted.' };

  const blocker =
    publishBlocker({ type: item.type, hasDraft: item.draft !== null, stage: item.stage }) ??
    (env.CMS_WRITE_DATABASE_URL ? null : 'CMS_WRITE_DATABASE_URL is not set, so publishing is off.');
  if (blocker) {
    await setPublishState(db, itemId, 'failed', blocker);
    return { skipped: true, reason: blocker };
  }

  await setPublishState(db, itemId, 'running', null);
  try {
    const settings = await getSeoSettings(db);
    const result = await writeArticleToCms({
      connectionString: env.CMS_WRITE_DATABASE_URL!,
      payload: buildCmsPayload(item.draft!),
      contentItemId: itemId,
      postId: item.cmsPostId,
      force,
    });
    const url = articleUrl(settings.contentHost, result.slug);
    const now = new Date();

    await db.transaction(async (tx) => {
      await tx
        .update(contentItems)
        .set({
          cmsPostId: result.postId,
          cmsSlug: result.slug,
          cmsStatus: 'draft',
          publishStatus: null,
          publishError: null,
          publishUpdatedAt: now,
          updatedAt: now,
        })
        .where(eq(contentItems.id, itemId));
      await tx.insert(contentEvents).values({
        itemId,
        kind: 'publish',
        note: `${result.created ? 'Sent to the CMS as a draft' : 'Updated the draft in the CMS'}: ${url}`,
        userId,
      });
    });

    if (deps.notify) {
      // A Telegram problem must not undo a published draft.
      try {
        await deps.notify(
          [
            `In the CMS as a draft: ${item.title}`,
            'Add the cover image in the CMS and press Publish to put it on the website.',
            '',
            url,
          ].join('\n'),
        );
      } catch (error) {
        console.error('[cms] Could not send the publishing notification:', errorText(error));
      }
    }
    return { postId: result.postId, slug: result.slug, created: result.created, url };
  } catch (error) {
    await setPublishState(db, itemId, 'failed', errorText(error));
    throw error;
  }
}

/**
 * Matches the CMS articles against the content that created them, so an article
 * somebody published in the CMS shows as Published here. Runs after each CMS sync.
 */
export async function reconcilePublished(db: Db, contentHost: string) {
  const rows = await db
    .select({ item: contentItems, articleStatus: articles.status, articleSlug: articles.slug })
    .from(contentItems)
    .leftJoin(articles, eq(articles.id, contentItems.cmsPostId))
    .where(isNotNull(contentItems.cmsPostId));

  let published = 0;
  let missing = 0;
  for (const { item, articleStatus, articleSlug } of rows) {
    if (articleStatus === null) {
      // The CMS row is gone: someone deleted the draft there.
      missing += 1;
      if (item.cmsStatus !== null) {
        await db
          .update(contentItems)
          .set({ cmsStatus: null, publishError: 'The article is no longer in the CMS.', publishUpdatedAt: new Date() })
          .where(eq(contentItems.id, item.id));
      }
      continue;
    }

    const goesLive = articleStatus === 'publish' && item.stage !== 'published';
    if (articleStatus === item.cmsStatus && articleSlug === item.cmsSlug && !goesLive) continue;

    const now = new Date();
    await db.transaction(async (tx) => {
      await tx
        .update(contentItems)
        .set({
          cmsStatus: articleStatus,
          cmsSlug: articleSlug,
          ...(goesLive ? { stage: 'published' as ContentStage, updatedAt: now } : {}),
          publishUpdatedAt: now,
        })
        .where(eq(contentItems.id, item.id));
      if (goesLive) {
        published += 1;
        await tx.insert(contentEvents).values({
          itemId: item.id,
          kind: 'publish',
          note: `Published on the website: ${articleUrl(contentHost, articleSlug ?? item.cmsSlug ?? '')}`,
          userId: null,
        });
        await tx
          .insert(contentEvents)
          .values({ itemId: item.id, kind: 'stage_changed', fromStage: item.stage, toStage: 'published', userId: null });
      }
    });
  }
  return { tracked: rows.length, published, missing };
}
