import { PgBoss } from 'pg-boss';
import type { JobDefinition } from './job';

/**
 * Only the worker runs cron schedules and queue maintenance. The API process
 * and the CLI connect just to enqueue jobs.
 */
export function createBoss(connectionString: string, role: 'api' | 'worker' | 'cli'): PgBoss {
  const isWorker = role === 'worker';
  const boss = new PgBoss({
    connectionString,
    application_name: `content-machine-${role}`,
    schedule: isWorker,
    supervise: isWorker,
  });
  boss.on('error', (error) => console.error('[queue]', error));
  return boss;
}

/** Longest a job may run when it does not set its own timeout. */
export const DEFAULT_TIMEOUT_SECONDS = 15 * 60;

/**
 * A running job's worker checks in this often. When a worker stops checking in
 * (a crash or a restart), its job is retried within about this long instead of
 * after the whole timeout.
 */
export const HEARTBEAT_SECONDS = 60;

/** Retry, timeout and heartbeat settings for a job's queue. */
export const queueOptions = (job: Pick<JobDefinition, 'retryLimit' | 'retryDelaySeconds' | 'timeoutSeconds'>) => ({
  retryLimit: job.retryLimit,
  retryDelay: job.retryDelaySeconds,
  retryBackoff: true,
  expireInSeconds: job.timeoutSeconds ?? DEFAULT_TIMEOUT_SECONDS,
  heartbeatSeconds: HEARTBEAT_SECONDS,
});

/** Creates each job's queue, or brings its settings up to date after a deploy. */
export async function ensureQueues(boss: PgBoss, jobs: JobDefinition[]): Promise<void> {
  for (const job of jobs) {
    const options = queueOptions(job);
    if (await boss.getQueue(job.name)) {
      await boss.updateQueue(job.name, options);
      continue;
    }
    try {
      await boss.createQueue(job.name, options);
    } catch (error) {
      // The API and the worker start together; the other one may have just created it.
      if (!(await boss.getQueue(job.name))) throw error;
    }
  }
}
