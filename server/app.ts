import { desc } from 'drizzle-orm';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import type { JobRun } from '../shared/api';
import { resolveCapabilityStates, type CapabilityKey } from '../shared/capabilities';
import { CHART_RANGES } from '../shared/seo';
import { authRoutes } from './auth/routes';
import type { Db } from './db/client';
import { gscDaily, jobRuns } from './db/schema';
import type { Env } from './env';
import { loadSession, requireRole, type AppEnv } from './http';
import type { JobDefinition, JobEnvelope } from './jobs/job';
import { getKeywords, getOverview } from './seo/metrics';
import { getSeoSettings, saveSeoSettings, SeoSettingsSchema } from './seo/settings';

export interface AppDeps {
  db: Db;
  env: Env;
  boss: PgBoss;
  jobs: JobDefinition[];
}

export function createApp({ db, env, boss, jobs }: AppDeps) {
  const secure = env.NODE_ENV === 'production';

  /** A capability is live once its data exists, not merely once it is configured. */
  async function liveCapabilities(): Promise<Set<CapabilityKey>> {
    const live = new Set<CapabilityKey>();
    const [searchData] = await db.select({ date: gscDaily.date }).from(gscDaily).limit(1);
    if (searchData) live.add('gsc');
    return live;
  }

  const api = new Hono<AppEnv>()
    .use(csrf({ origin: new URL(env.APP_BASE_URL).origin }))
    .use(loadSession(db, secure))
    .get('/health', (c) => c.json({ ok: true }))
    .route('/auth', authRoutes(db, env))
    .get('/me', requireRole(), (c) => c.json(c.get('user')))
    .get('/capabilities', requireRole(), async (c) =>
      c.json(resolveCapabilityStates(await liveCapabilities())),
    )
    .get('/seo/overview', requireRole(), async (c) => {
      const range = CHART_RANGES.find((candidate) => candidate === c.req.query('range')) ?? '90D';
      return c.json(await getOverview(db, range, await getSeoSettings(db)));
    })
    .get('/seo/keywords', requireRole(), async (c) => c.json(await getKeywords(db, await getSeoSettings(db))))
    .get('/settings/seo', requireRole(), async (c) => c.json(await getSeoSettings(db)))
    .post('/settings/seo', requireRole('admin'), async (c) => {
      const parsed = SeoSettingsSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
      await saveSeoSettings(db, parsed.data, c.get('user')?.id ?? null);
      return c.json(await getSeoSettings(db));
    })
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
