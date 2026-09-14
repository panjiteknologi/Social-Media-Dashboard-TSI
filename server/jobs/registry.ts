import { lt } from 'drizzle-orm';
import { z } from 'zod';
import { deleteExpiredSessions } from '../auth/session';
import type { Db } from '../db/client';
import { jobRuns, workerHeartbeats } from '../db/schema';
import type { Env } from '../env';
import { searchConsoleFromEnv } from '../google/fromEnv';
import { createAlerter } from '../notify/telegram';
import { buildPriorityDigest } from '../seo/digest';
import { getKeywords } from '../seo/metrics';
import { getSeoSettings } from '../seo/settings';
import { syncSearchConsole, todayIn } from '../seo/sync';
import type { JobDefinition } from './job';

/** How long Workflow Logs keeps runs. Moves to Settings in a later milestone. */
export const JOB_RUN_RETENTION_DAYS = 90;

const STALE_HEARTBEAT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const SelfTestInput = z.object({ fail: z.boolean().default(false) });

const DigestInput = z.object({
  /** Build the message and return it without sending anything. */
  dryRun: z.boolean().default(false),
  /** Use these keywords instead of the saved ones, to preview the message for a different list. */
  priorityKeywords: z.array(z.string()).optional(),
});

/** Every background job the worker runs. Later milestones add their sync and publishing jobs here. */
export function createJobs({ db, env }: { db: Db; env: Env }): JobDefinition[] {
  const alerter = createAlerter(env);

  return [
    {
      name: 'system-selftest',
      description:
        'Checks the job pipeline end to end. Input {"fail": true} exercises the retry and the failure alert.',
      retryLimit: 1,
      retryDelaySeconds: 2,
      manual: true,
      async run(input) {
        const { fail } = SelfTestInput.parse(input ?? {});
        if (fail) throw new Error('Self-test failure requested');
        return { ok: true };
      },
    },
    {
      name: 'system-cleanup',
      description: 'Deletes job runs past retention, expired sessions and stale worker heartbeats.',
      retryLimit: 2,
      retryDelaySeconds: 300,
      schedule: '30 3 * * *',
      manual: true,
      async run() {
        const now = Date.now();
        const deletedRuns = await db
          .delete(jobRuns)
          .where(lt(jobRuns.startedAt, new Date(now - JOB_RUN_RETENTION_DAYS * DAY_MS)))
          .returning({ id: jobRuns.id });
        const deletedHeartbeats = await db
          .delete(workerHeartbeats)
          .where(lt(workerHeartbeats.lastSeenAt, new Date(now - STALE_HEARTBEAT_DAYS * DAY_MS)))
          .returning({ workerId: workerHeartbeats.workerId });
        return {
          deletedJobRuns: deletedRuns.length,
          deletedSessions: await deleteExpiredSessions(db),
          deletedHeartbeats: deletedHeartbeats.length,
        };
      },
    },
    {
      name: 'gsc-sync',
      description:
        'Copies Search Console data: the full history since the data start date on the first run, then the last few days again each morning while Google finalises them.',
      retryLimit: 3,
      retryDelaySeconds: 600,
      // 07:30 Jakarta. Google finalises data about three days late, so an
      // early-morning run picks up whichever day became final overnight.
      schedule: '30 7 * * *',
      manual: true,
      async run() {
        const settings = await getSeoSettings(db);
        return syncSearchConsole({
          db,
          client: searchConsoleFromEnv(env),
          today: todayIn(env.TIMEZONE),
          dataStartDate: settings.dataStartDate,
        });
      },
    },
    {
      name: 'seo-weekly-digest',
      description:
        'Every Monday morning, messages Telegram when a priority keyword dropped over the last 28 days. Input {"dryRun": true} returns the message without sending it.',
      retryLimit: 2,
      retryDelaySeconds: 600,
      // Monday 08:00 Jakarta, after that morning's Search Console sync.
      schedule: '0 8 * * 1',
      manual: true,
      async run(input) {
        const options = DigestInput.parse(input ?? {});
        const saved = await getSeoSettings(db);
        const settings = options.priorityKeywords
          ? {
              ...saved,
              priorityKeywords: options.priorityKeywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean),
            }
          : saved;

        if (settings.priorityKeywords.length === 0) {
          return { sent: false, reason: 'No priority keywords are set in Settings.' };
        }
        const message = buildPriorityDigest(await getKeywords(db, settings), settings.priorityKeywords, env.APP_BASE_URL);
        if (!message) return { sent: false, reason: 'No priority keyword dropped.' };
        if (options.dryRun) return { sent: false, reason: 'Dry run', message };

        await alerter.send(message);
        return { sent: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID), message };
      },
    },
  ];
}
