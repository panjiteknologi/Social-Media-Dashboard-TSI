import { hostname } from 'node:os';
import { createDb, runMigrations, waitForDatabase } from './db/client';
import { workerHeartbeats } from './db/schema';
import { getEnv } from './env';
import type { JobEnvelope } from './jobs/job';
import { createBoss, ensureQueues } from './jobs/queue';
import { createDbRecorder } from './jobs/recorder';
import { createJobs } from './jobs/registry';
import { executeJob } from './jobs/runner';
import { HEARTBEAT_INTERVAL_MS } from './monitor';
import { createAlerter } from './notify/telegram';

const env = getEnv();
const { db, pool } = createDb(env.DATABASE_URL);

await waitForDatabase(pool);
await runMigrations(db, pool);

const jobs = createJobs(db);
const boss = createBoss(env.DATABASE_URL, 'worker');
await boss.start();
await ensureQueues(boss, jobs);

const deps = { recorder: createDbRecorder(db), alerter: createAlerter(env) };

// Metadata carries the retry count, which tells the runner whether an attempt is the last one.
const WORK_OPTIONS = { includeMetadata: true, localConcurrency: 1 } as const;

for (const job of jobs) {
  await boss.work<JobEnvelope, void, typeof WORK_OPTIONS>(job.name, WORK_OPTIONS, async (batch) => {
    for (const queued of batch) await executeJob(job, queued, deps);
  });

  if (job.schedule) {
    const envelope: JobEnvelope = { trigger: 'schedule' };
    // `missed: 'once'` runs a schedule that came due while the server was down
    // a single time on start, instead of skipping it or piling up every miss.
    await boss.schedule(job.name, job.schedule, envelope, { tz: env.TIMEZONE, missed: 'once' });
  }
}

const workerId = hostname();
const startedAt = new Date();

async function checkIn() {
  const now = new Date();
  try {
    await db
      .insert(workerHeartbeats)
      .values({ workerId, startedAt, lastSeenAt: now })
      .onConflictDoUpdate({ target: workerHeartbeats.workerId, set: { startedAt, lastSeenAt: now } });
  } catch (error) {
    console.error('[worker] Heartbeat failed:', error);
  }
}

await checkIn();
const heartbeat = setInterval(checkIn, HEARTBEAT_INTERVAL_MS);

console.log(`Worker ${workerId} running ${jobs.map((job) => job.name).join(', ')}`);

async function shutdown() {
  clearInterval(heartbeat);
  await boss.stop({ graceful: true, timeout: 30_000 });
  await pool.end();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
