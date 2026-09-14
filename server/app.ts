import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import type { PgBoss } from 'pg-boss';
import type { JobRun } from '../shared/api';
import { resolveCapabilityStates, type CapabilityKey } from '../shared/capabilities';
import { authRoutes } from './auth/routes';
import type { Db } from './db/client';
import { jobRuns } from './db/schema';
import type { Env } from './env';
import { loadSession, requireRole, type AppEnv } from './http';
import type { JobDefinition, JobEnvelope } from './jobs/job';

export interface AppDeps {
  db: Db;
  env: Env;
  boss: PgBoss;
  jobs: JobDefinition[];
}

/** Capabilities that are live. Each milestone adds its keys as its integration ships. */
const AVAILABLE_CAPABILITIES = new Set<CapabilityKey>();

export function createApp({ db, env, boss, jobs }: AppDeps) {
  const secure = env.NODE_ENV === 'production';

  const api = new Hono<AppEnv>()
    .use(csrf({ origin: new URL(env.APP_BASE_URL).origin }))
    .use(loadSession(db, secure))
    .get('/health', (c) => c.json({ ok: true }))
    .route('/auth', authRoutes(db, env))
    .get('/me', requireRole(), (c) => c.json(c.get('user')))
    .get('/capabilities', requireRole(), (c) =>
      c.json(resolveCapabilityStates(AVAILABLE_CAPABILITIES)),
    )
    .get('/jobs/runs', requireRole(), async (c) => {
      const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
      const rows = await db
        .select({
          id: jobRuns.id,
          jobName: jobRuns.jobName,
          trigger: jobRuns.trigger,
          status: jobRuns.status,
          attempt: jobRuns.attempt,
          maxAttempts: jobRuns.maxAttempts,
          error: jobRuns.error,
          startedAt: jobRuns.startedAt,
          finishedAt: jobRuns.finishedAt,
        })
        .from(jobRuns)
        .orderBy(desc(jobRuns.startedAt))
        .limit(limit);
      return c.json(
        rows.map(
          (row): JobRun => ({
            ...row,
            startedAt: row.startedAt.toISOString(),
            finishedAt: row.finishedAt?.toISOString() ?? null,
          }),
        ),
      );
    })
    .post('/jobs/:name/run', requireRole('admin'), async (c) => {
      const job = jobs.find((candidate) => candidate.manual && candidate.name === c.req.param('name'));
      if (!job) return c.json({ error: 'Unknown job' }, 404);

      const body = (await c.req.json().catch(() => ({}))) as { input?: unknown };
      const envelope: JobEnvelope = {
        trigger: 'manual',
        triggeredBy: c.get('user')?.id,
        input: body.input ?? null,
      };
      const queueJobId = await boss.send(job.name, envelope);
      return c.json({ queueJobId }, 202);
    });

  const app = new Hono().route('/api', api);

  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((error, c) => {
    // Middleware such as CSRF protection rejects with an HTTPException that
    // already carries the right status; only unexpected errors become a 500.
    if (error instanceof HTTPException) return error.getResponse();
    console.error('[api]', error);
    return c.json({ error: 'Internal error' }, 500);
  });

  return app;
}
