import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { ACTION_STATUSES } from '../shared/actions';
import { JOB_RUN_STATUSES, type JobRun, type JobRunDetail } from '../shared/api';
import { resolveCapabilityStates, type CapabilityKey } from '../shared/capabilities';
import { REPORT_KINDS, type ReportRecord } from '../shared/reports';
import { CHART_RANGES, type ChartRange } from '../shared/seo';
import { authRoutes } from './auth/routes';
import { CMS_SYNC_STATE_KEY } from './cms/sync';
import { getAnalyticsOverview, getArticles } from './content/metrics';
import type { Db } from './db/client';
import { aiUsageThisMonth } from './ai/usage';
import { BrandKnowledgeSchema, getBrandSettings, saveBrandKnowledge } from './brand/settings';
import { decideContent, DecisionInputSchema } from './approvals/service';
import { createAlerter } from './notify/telegram';
import { AI_TASKS } from '../shared/aiContent';
import {
  dismissTopic,
  getContentAi,
  listTopics,
  planTopic,
  queueContentTask,
  queueTopicRun,
} from './contentAi/service';
import { appSettings, ga4ChannelDaily, gscDaily, jobRuns, reports, siteCrawls, users } from './db/schema';
import {
  ContentError,
  ContentInputSchema,
  createContent,
  deleteContent,
  listContent,
  listContentEvents,
  listTeam,
  updateContent,
} from './planner/service';
import type { Env } from './env';
import { loadSession, requireRole, type AppEnv } from './http';
import type { JobDefinition, JobEnvelope } from './jobs/job';
import { getAutomationSettings, JobSettingError, JobSettingInputSchema, saveJobSetting } from './jobs/settings';
import { sendTelegramMessage } from './notify/telegram';
import { listSeoActions, updateActionStatus } from './seo/actions';
import { getKeywords, getOverview } from './seo/metrics';
import { getSeoSettings, saveSeoSettings, SeoSettingsSchema } from './seo/settings';
import { getTechnicalHealth } from './technical/health';

export interface AppDeps {
  db: Db;
  env: Env;
  boss: PgBoss;
  jobs: JobDefinition[];
}

const rangeParam = (value: string | undefined, fallback: ChartRange): ChartRange =>
  CHART_RANGES.find((candidate) => candidate === value) ?? fallback;

const toJobRun = (
  row: Pick<
    typeof jobRuns.$inferSelect,
    'id' | 'jobName' | 'trigger' | 'status' | 'attempt' | 'maxAttempts' | 'error' | 'startedAt' | 'finishedAt'
  >,
): JobRun => ({
  id: row.id,
  jobName: row.jobName,
  trigger: row.trigger,
  status: row.status,
  attempt: row.attempt,
  maxAttempts: row.maxAttempts,
  error: row.error,
  startedAt: row.startedAt.toISOString(),
  finishedAt: row.finishedAt?.toISOString() ?? null,
});

export function createApp({ db, env, boss, jobs }: AppDeps) {
  const secure = env.NODE_ENV === 'production';
  const aiConfigured = Boolean(env.OPENROUTER_API_KEY);
  const alerter = createAlerter(env);

  const automationSettings = () =>
    getAutomationSettings(db, jobs, {
      timeZone: env.TIMEZONE,
      telegramConfigured: Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID),
    });

  /** A capability is live once its data exists, not merely once it is configured. */
  async function liveCapabilities(): Promise<Set<CapabilityKey>> {
    const [[searchData], [trafficData], [cmsSync], [report], [crawl], [actionRun]] = await Promise.all([
      db.select({ date: gscDaily.date }).from(gscDaily).limit(1),
      db.select({ date: ga4ChannelDaily.date }).from(ga4ChannelDaily).limit(1),
      db.select({ key: appSettings.key }).from(appSettings).where(eq(appSettings.key, CMS_SYNC_STATE_KEY)).limit(1),
      db.select({ id: reports.id }).from(reports).limit(1),
      db.select({ id: siteCrawls.id }).from(siteCrawls).where(isNotNull(siteCrawls.finishedAt)).limit(1),
      db
        .select({ id: jobRuns.id })
        .from(jobRuns)
        .where(and(eq(jobRuns.jobName, 'seo-actions'), eq(jobRuns.status, 'success')))
        .limit(1),
    ]);
    // The Action Center is live once its job has run, even if it found nothing to do.
    const actionsLive = Boolean(actionRun);
    const live = new Set<CapabilityKey>();
    if (searchData) live.add('gsc');
    if (trafficData) live.add('ga4');
    if (report) live.add('reports');
    if (crawl) live.add('technicalSeo');
    if (actionsLive) live.add('seoActions');
    // The Content Planner and the Approval Queue hold real data from the first
    // item; empty is a real state too.
    live.add('content');
    live.add('approvals');
    // A finished CMS sync makes both live, even with no leads yet: zero is a real count.
    if (cmsSync) {
      live.add('articles');
      live.add('leads');
    }
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
      const range = rangeParam(c.req.query('range'), '90D');
      return c.json(await getOverview(db, range, await getSeoSettings(db)));
    })
    .get('/seo/keywords', requireRole(), async (c) => c.json(await getKeywords(db, await getSeoSettings(db))))
    .get('/seo/technical', requireRole(), async (c) =>
      c.json(await getTechnicalHealth(db, await getSeoSettings(db), Boolean(env.PAGESPEED_API_KEY))),
    )
    .get('/seo/actions', requireRole(), async (c) => c.json(await listSeoActions(db, await getSeoSettings(db))))
    .post('/seo/actions/:id/status', requireRole('editor'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      const body = z.object({ status: z.enum(ACTION_STATUSES) }).safeParse(await c.req.json().catch(() => null));
      if (!id.success || !body.success) return c.json({ error: 'Send a valid task id and status.' }, 400);
      const updated = await updateActionStatus(db, id.data, body.data.status, c.get('user')?.id ?? null);
      return updated ? c.json(updated) : c.json({ error: 'Task not found' }, 404);
    })
    .get('/articles', requireRole(), async (c) =>
      c.json(await getArticles(db, await getSeoSettings(db), env.TIMEZONE)),
    )
    .get('/analytics/overview', requireRole(), async (c) => {
      const range = rangeParam(c.req.query('range'), '30D');
      return c.json(await getAnalyticsOverview(db, range, await getSeoSettings(db), env.TIMEZONE));
    })
    .get('/reports', requireRole(), async (c) => {
      const kind = REPORT_KINDS.find((candidate) => candidate === c.req.query('kind')) ?? 'daily';
      const rows = await db
        .select()
        .from(reports)
        .where(eq(reports.kind, kind))
        .orderBy(desc(reports.periodStart))
        .limit(30);
      return c.json(
        rows.map(
          (row): ReportRecord => ({
            id: row.id,
            kind: row.kind,
            title: row.title,
            periodStart: row.periodStart,
            periodEnd: row.periodEnd,
            createdAt: row.createdAt.toISOString(),
            data: row.data,
            summary: row.summary,
            focus: row.focus,
            aiModel: row.aiModel,
            aiNote: row.aiNote,
            telegramSentAt: row.telegramSentAt?.toISOString() ?? null,
            telegramError: row.telegramError,
          }),
        ),
      );
    })
    .get('/settings/automation', requireRole(), async (c) => c.json(await automationSettings()))
    .post('/settings/automation/:name', requireRole('admin'), async (c) => {
      const parsed = JobSettingInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
      try {
        await saveJobSetting({
          db,
          boss,
          jobs,
          name: c.req.param('name'),
          input: parsed.data,
          userId: c.get('user')?.id ?? null,
          timeZone: env.TIMEZONE,
        });
      } catch (error) {
        if (error instanceof JobSettingError) return c.json({ error: error.message }, error.status);
        throw error;
      }
      return c.json(await automationSettings());
    })
    .post('/settings/telegram/test', requireRole('admin'), async (c) => {
      const { TELEGRAM_BOT_TOKEN: botToken, TELEGRAM_CHAT_ID: chatId } = env;
      if (!botToken || !chatId) {
        return c.json({ error: 'Telegram is not configured: set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.' }, 400);
      }
      try {
        await sendTelegramMessage(
          { botToken, chatId },
          'Content Machine\nTest message from Settings: reports and alerts will arrive in this chat.',
        );
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 502);
      }
      return c.json({ sent: true });
    })
    .get('/settings/brand', requireRole(), async (c) => c.json(await getBrandSettings(db, env)))
    .post('/settings/brand', requireRole('admin'), async (c) => {
      const parsed = BrandKnowledgeSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
      await saveBrandKnowledge(db, parsed.data, c.get('user')?.id ?? null);
      return c.json(await getBrandSettings(db, env));
    })
    .get('/settings/seo', requireRole(), async (c) => c.json(await getSeoSettings(db)))
    .post('/settings/seo', requireRole('admin'), async (c) => {
      const parsed = SeoSettingsSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
      await saveSeoSettings(db, parsed.data, c.get('user')?.id ?? null);
      return c.json(await getSeoSettings(db));
    })
    .get('/jobs/runs', requireRole(), async (c) => {
      const limit = Math.min(Number(c.req.query('limit')) || 50, 200);
      const job = c.req.query('job');
      const status = JOB_RUN_STATUSES.find((candidate) => candidate === c.req.query('status'));
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
        .where(and(job ? eq(jobRuns.jobName, job) : undefined, status ? eq(jobRuns.status, status) : undefined))
        .orderBy(desc(jobRuns.startedAt))
        .limit(limit);
      return c.json(rows.map(toJobRun));
    })
    .get('/jobs/runs/:id', requireRole(), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Not found' }, 404);
      const [row] = await db
        .select({ run: jobRuns, userName: users.name, userEmail: users.email })
        .from(jobRuns)
        .leftJoin(users, eq(users.id, jobRuns.triggeredBy))
        .where(eq(jobRuns.id, id.data))
        .limit(1);
      if (!row) return c.json({ error: 'Not found' }, 404);
      const detail: JobRunDetail = {
        ...toJobRun(row.run),
        input: row.run.input,
        output: row.run.output,
        triggeredByName: row.userName ?? row.userEmail ?? null,
      };
      return c.json(detail as object);
    })
    .get('/ai/usage', requireRole(), async (c) => c.json(await aiUsageThisMonth(db, env)))
    .get('/users', requireRole(), async (c) => c.json(await listTeam(db)))
    .get('/content', requireRole(), async (c) => c.json(await listContent(db)))
    .get('/content/:id/events', requireRole(), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Content not found' }, 404);
      return c.json(await listContentEvents(db, id.data));
    })
    .post('/content', requireRole('editor'), async (c) => {
      const parsed = ContentInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
      try {
        return c.json(await createContent(db, parsed.data, c.get('user')!), 201);
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .put('/content/:id', requireRole('editor'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Content not found' }, 404);
      const parsed = ContentInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!parsed.success) return c.json({ error: z.prettifyError(parsed.error) }, 400);
      try {
        return c.json(await updateContent(db, id.data, parsed.data, c.get('user')!));
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .get('/content/:id/ai', requireRole(), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Content not found' }, 404);
      try {
        return c.json(await getContentAi(db, aiConfigured, id.data));
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .post('/content/:id/ai', requireRole('editor'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Content not found' }, 404);
      const body = z.object({ task: z.enum(AI_TASKS) }).safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
      try {
        return c.json(
          await queueContentTask({ db, boss, configured: aiConfigured }, id.data, body.data.task, c.get('user')!),
          202,
        );
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .post('/content/:id/decision', requireRole('approver'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Content not found' }, 404);
      const body = DecisionInputSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
      try {
        const deps = { db, boss, alerter, appBaseUrl: env.APP_BASE_URL, aiConfigured };
        return c.json(await decideContent(deps, id.data, body.data, c.get('user')!));
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .get('/topics', requireRole(), async (c) => c.json(await listTopics(db, aiConfigured)))
    .post('/topics/run', requireRole('editor'), async (c) => {
      if (!aiConfigured) return c.json({ error: 'OPENROUTER_API_KEY is not set.' }, 400);
      try {
        await queueTopicRun(db, boss, c.get('user')!);
        return c.json({ queued: true }, 202);
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .post('/topics/:id/plan', requireRole('editor'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Recommendation not found' }, 404);
      try {
        return c.json(await planTopic(db, id.data, c.get('user')!), 201);
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .post('/topics/:id/dismiss', requireRole('editor'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Recommendation not found' }, 404);
      try {
        await dismissTopic(db, id.data);
        return c.json({ dismissed: true });
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
    })
    .delete('/content/:id', requireRole('editor'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Content not found' }, 404);
      try {
        await deleteContent(db, id.data);
        return c.json({ deleted: true });
      } catch (error) {
        if (error instanceof ContentError) return c.json({ error: error.message }, error.status);
        throw error;
      }
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
