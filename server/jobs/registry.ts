import { lt } from 'drizzle-orm';
import { z } from 'zod';
import type { ReportKind } from '../../shared/reports';
import { aiGatewayFromEnv } from '../ai/fromEnv';
import { syncAnalytics } from '../analytics/sync';
import { deleteExpiredSessions } from '../auth/session';
import { syncCms } from '../cms/sync';
import type { Db } from '../db/client';
import { jobRuns, workerHeartbeats } from '../db/schema';
import type { Env } from '../env';
import { analyticsFromEnv, searchConsoleFromEnv, urlInspectionFromEnv } from '../google/fromEnv';
import { createAlerter } from '../notify/telegram';
import { buildPriorityDigest } from '../seo/digest';
import { getKeywords } from '../seo/metrics';
import { runReport } from '../reports/run';
import { buildActionCandidates, syncActions } from '../seo/actions';
import { getSeoSettings } from '../seo/settings';
import { syncSearchConsole, todayIn } from '../seo/sync';
import { getTechnicalHealth } from '../technical/health';
import { runIndexInspection, runPagespeedCheck, runSiteCrawl } from '../technical/run';
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

const ReportInput = z.object({
  dryRun: z.boolean().default(false),
  resend: z.boolean().default(false),
  refresh: z.boolean().default(false),
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

const REPORT_INPUT_HELP =
  'Input {"dryRun": true} returns the message without AI, saving or sending; {"resend": true} sends a sent report again; {"refresh": true} writes a new AI summary; {"today": "YYYY-MM-DD"} rebuilds an earlier report.';

/** Every background job the worker runs. Later milestones add their sync and publishing jobs here. */
export function createJobs({ db, env }: { db: Db; env: Env }): JobDefinition[] {
  const alerter = createAlerter(env);
  const ai = aiGatewayFromEnv(db, env);

  const reportJob = (kind: ReportKind, schedule: string, description: string): JobDefinition => ({
    name: `report-${kind}`,
    description: `${description} ${REPORT_INPUT_HELP}`,
    retryLimit: 2,
    retryDelaySeconds: 300,
    schedule,
    manual: true,
    run: (input) => runReport({ db, env, ai, kind, options: ReportInput.parse(input ?? {}) }),
  });

  return [
    // 08:00 Jakarta, after the morning GA4 (07:00) and Search Console (07:30) syncs.
    reportJob('daily', '0 8 * * *', "Sends yesterday's report to Telegram every morning."),
    reportJob('weekly', '15 8 * * 1', "Sends last week's report (Monday to Sunday) to Telegram every Monday."),
    reportJob('monthly', '30 8 1 * *', "Sends last month's report to Telegram on the first of the month."),
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
      // The first sync fetches the whole history, which takes a few minutes.
      timeoutSeconds: 30 * 60,
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
      name: 'ga4-sync',
      description:
        'Copies Google Analytics 4 sessions by channel and landing page, and the events the website tracks, through yesterday. The last three days are fetched again each morning.',
      retryLimit: 3,
      retryDelaySeconds: 600,
      // 07:00 Jakarta: yesterday is complete by then.
      schedule: '0 7 * * *',
      manual: true,
      async run() {
        const settings = await getSeoSettings(db);
        return syncAnalytics({
          db,
          client: analyticsFromEnv(env),
          today: todayIn(env.TIMEZONE),
          dataStartDate: settings.dataStartDate,
        });
      },
    },
    {
      name: 'cms-sync',
      description:
        'Copies articles and leads from the CMS database with the read-only role, without any contact details, replacing the previous copy.',
      retryLimit: 2,
      retryDelaySeconds: 300,
      // Hourly, so a lead that arrives in the morning shows up the same morning.
      schedule: '10 * * * *',
      manual: true,
      async run() {
        if (!env.CMS_DATABASE_URL) throw new Error('CMS_DATABASE_URL is not set in .env.');
        return syncCms({ db, connectionString: env.CMS_DATABASE_URL });
      },
    },
    {
      name: 'seo-actions',
      description:
        'Updates the SEO Action Center every morning: opens tasks for keywords that dropped or left page 1, low CTR pages, cannibalization, top opportunities and technical problems, and closes tasks whose issue is gone.',
      retryLimit: 2,
      retryDelaySeconds: 600,
      // 07:45 Jakarta, after the Search Console sync.
      schedule: '45 7 * * *',
      manual: true,
      async run() {
        const settings = await getSeoSettings(db);
        const [keywords, health] = await Promise.all([
          getKeywords(db, settings),
          getTechnicalHealth(db, settings, Boolean(env.PAGESPEED_API_KEY)),
        ]);
        return syncActions(db, buildActionCandidates(keywords, health));
      },
    },
    {
      name: 'site-crawl',
      description:
        'Checks the website every Sunday: every page in the sitemap, every page Google shows in search and every CMS article, plus each internal link they contain. Finds broken pages, missing titles and descriptions, duplicate titles, images without alt text, canonical and structured data problems.',
      retryLimit: 1,
      retryDelaySeconds: 1800,
      // Sunday 02:00 Jakarta, when hardly anyone visits.
      schedule: '0 2 * * 0',
      // About 250 pages at a polite pace took 6 minutes on 15 September.
      timeoutSeconds: 30 * 60,
      manual: true,
      async run() {
        return runSiteCrawl({ db, settings: await getSeoSettings(db) });
      },
    },
    {
      name: 'index-inspection',
      description:
        "Asks Google's URL Inspection API every Sunday whether each sitemap page from the latest crawl is indexed, and which canonical Google chose.",
      retryLimit: 2,
      retryDelaySeconds: 1800,
      // Sunday 03:00 Jakarta, after the crawl.
      schedule: '0 3 * * 0',
      // 210 inspections took 26 minutes on 15 September; the default 15 minutes made it run twice.
      timeoutSeconds: 60 * 60,
      manual: true,
      async run() {
        return runIndexInspection({ db, client: urlInspectionFromEnv(env) });
      },
    },
    {
      name: 'pagespeed-check',
      description:
        'Tests mobile page speed every Sunday with PageSpeed Insights, for the home page and the pages with the most search clicks. Skips itself until PAGESPEED_API_KEY is set.',
      retryLimit: 1,
      retryDelaySeconds: 1800,
      // Sunday 04:00 Jakarta.
      schedule: '0 4 * * 0',
      // Each test takes 10–30 seconds, one page at a time.
      timeoutSeconds: 30 * 60,
      manual: true,
      async run() {
        return runPagespeedCheck({ db, apiKey: env.PAGESPEED_API_KEY, settings: await getSeoSettings(db) });
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
