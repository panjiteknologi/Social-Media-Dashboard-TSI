import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { count } from 'drizzle-orm';
import { createApp } from './app';
import { createDb, runMigrations, waitForDatabase } from './db/client';
import { users } from './db/schema';
import { getEnv } from './env';
import { createBoss, ensureQueues } from './jobs/queue';
import { createJobs } from './jobs/registry';
import { applyOverrides, getJobOverrides } from './jobs/settings';
import { startWorkerMonitor } from './monitor';
import { createAlerter } from './notify/telegram';

const env = getEnv();
const { db, pool } = createDb(env.DATABASE_URL);

// Startup can wait on the database or the job queue for a while. Saying which
// step is running makes a stalled start diagnosable from the log alone.
console.log('API starting: connecting to the database');
await waitForDatabase(pool);
await runMigrations(db, pool);
await createInitialAdmin();

console.log('API starting: connecting to the job queue');
const jobs = createJobs({ db, env });
const boss = createBoss(env.DATABASE_URL, 'api');
await boss.start();
// Retry limits saved in Settings win over the defaults in code.
await ensureQueues(boss, applyOverrides(jobs, await getJobOverrides(db)));

console.log(`API starting: opening port ${env.API_PORT}`);

const app = createApp({ db, env, boss, jobs });

if (env.NODE_ENV === 'production') {
  // In production this process also serves the built web app, falling back to
  // index.html so client-side routes survive a refresh.
  const indexHtml = serveStatic({ path: './dist/index.html' });
  app.use('/*', serveStatic({ root: './dist' }));
  app.get('/*', (c, next) => (c.req.path.startsWith('/api/') ? next() : indexHtml(c, next)));
}

const stopMonitor = startWorkerMonitor(db, createAlerter(env));

const server = serve({ fetch: app.fetch, port: env.API_PORT }, (info) => {
  console.log(`API listening on http://localhost:${info.port}`);
});

async function shutdown() {
  stopMonitor();
  server.close();
  await boss.stop({ graceful: false });
  await pool.end();
  process.exit(0);
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

/** Seeds the first admin on an empty database, so a fresh deploy has someone who can sign in. */
async function createInitialAdmin() {
  if (!env.INITIAL_ADMIN_EMAIL) return;
  const [{ total }] = await db.select({ total: count() }).from(users);
  if (total > 0) return;
  await db.insert(users).values({ email: env.INITIAL_ADMIN_EMAIL.toLowerCase(), role: 'admin' });
  console.log(`Created initial admin ${env.INITIAL_ADMIN_EMAIL}`);
}
