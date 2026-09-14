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

/** Creates each job's queue, or brings its retry settings up to date after a deploy. */
export async function ensureQueues(boss: PgBoss, jobs: JobDefinition[]): Promise<void> {
  for (const job of jobs) {
    const options = {
      retryLimit: job.retryLimit,
      retryDelay: job.retryDelaySeconds,
      retryBackoff: true,
    };
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
