import { lt } from 'drizzle-orm';
import { z } from 'zod';
import { deleteExpiredSessions } from '../auth/session';
import type { Db } from '../db/client';
import { jobRuns, workerHeartbeats } from '../db/schema';
import type { JobDefinition } from './job';

/** How long Workflow Logs keeps runs. Moves to Settings in a later milestone. */
export const JOB_RUN_RETENTION_DAYS = 90;

const STALE_HEARTBEAT_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

const SelfTestInput = z.object({ fail: z.boolean().default(false) });

/** Every background job the worker runs. Later milestones add their sync and publishing jobs here. */
export function createJobs(db: Db): JobDefinition[] {
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
  ];
}
