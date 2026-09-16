import { desc, eq } from 'drizzle-orm';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import {
  JOB_INFO,
  jobGroup,
  MAX_RETRY_LIMIT,
  parseSchedule,
  type AutomationSettings,
  type JobGroup,
  type JobSettingInput,
  type JobSettingOverride,
} from '../../shared/automation';
import type { Db } from '../db/client';
import { appSettings, jobRuns } from '../db/schema';
import type { JobDefinition, JobEnvelope } from './job';
import { queueOptions } from './queue';

export const AUTOMATION_SETTINGS_KEY = 'automation';

export type JobOverrides = Record<string, JobSettingOverride>;

const OverrideSchema = z.object({
  enabled: z.boolean().optional(),
  schedule: z.string().optional(),
  retryLimit: z.number().int().min(0).max(MAX_RETRY_LIMIT).optional(),
});

export const JobSettingInputSchema = z.object({
  enabled: z.boolean(),
  schedule: z.string().nullable(),
  retryLimit: z.number().int().min(0).max(MAX_RETRY_LIMIT),
});

/** A request Settings cannot apply, with the HTTP status that says why. */
export class JobSettingError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 404,
  ) {
    super(message);
    this.name = 'JobSettingError';
  }
}

export async function getJobOverrides(db: Db): Promise<JobOverrides> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, AUTOMATION_SETTINGS_KEY))
    .limit(1);
  const parsed = z.record(z.string(), OverrideSchema).safeParse((row?.value as { jobs?: unknown } | undefined)?.jobs ?? {});
  return parsed.success ? parsed.data : {};
}

export interface EffectiveJob extends JobDefinition {
  /** False when the team switched the schedule off. The job can still be started by hand. */
  enabled: boolean;
}

/**
 * Job definitions with the team's saved changes applied. A saved schedule only
 * counts when it has the same shape as the default, so a stale or hand-edited
 * value can never turn a weekly job into an hourly one.
 */
export function applyOverrides(jobs: JobDefinition[], overrides: JobOverrides): EffectiveJob[] {
  return jobs.map((job) => {
    const override = overrides[job.name] ?? {};
    const saved = override.schedule ? parseSchedule(override.schedule) : null;
    const original = job.schedule ? parseSchedule(job.schedule) : null;
    const schedule = saved && original && saved.kind === original.kind ? override.schedule : job.schedule;
    return {
      ...job,
      schedule,
      retryLimit: override.retryLimit ?? job.retryLimit,
      enabled: override.enabled ?? true,
    };
  });
}

/** Puts a job's schedule in the queue, or takes it out when the job is switched off. */
export async function syncSchedule(boss: PgBoss, job: EffectiveJob, timeZone: string): Promise<void> {
  if (!job.schedule) return;
  if (!job.enabled) {
    await boss.unschedule(job.name);
    return;
  }
  const envelope: JobEnvelope = { trigger: 'schedule' };
  // `missed: 'once'` runs a schedule that came due while the server was down
  // a single time on start, instead of skipping it or piling up every miss.
  await boss.schedule(job.name, job.schedule, envelope, { tz: timeZone, missed: 'once' });
}

/** Saves one job's settings and applies them to the running queue at once; no restart needed. */
export async function saveJobSetting(deps: {
  db: Db;
  boss: PgBoss;
  jobs: JobDefinition[];
  name: string;
  input: JobSettingInput;
  userId: string | null;
  timeZone: string;
}): Promise<void> {
  const { db, boss, input } = deps;
  const job = deps.jobs.find((candidate) => candidate.name === deps.name);
  if (!job) throw new JobSettingError('Unknown job', 404);

  if (input.schedule !== null) {
    const original = job.schedule ? parseSchedule(job.schedule) : null;
    if (!original) throw new JobSettingError('This job runs only when started by hand, so it has no schedule.', 400);
    const requested = parseSchedule(input.schedule);
    if (!requested || requested.kind !== original.kind) {
      throw new JobSettingError(`The schedule must stay ${original.kind}, with a valid day and time.`, 400);
    }
  }

  const overrides = await getJobOverrides(db);
  overrides[job.name] = {
    enabled: input.enabled,
    retryLimit: input.retryLimit,
    ...(input.schedule !== null ? { schedule: input.schedule } : {}),
  };
  const value = { jobs: overrides };
  await db
    .insert(appSettings)
    .values({ key: AUTOMATION_SETTINGS_KEY, value, updatedBy: deps.userId })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date(), updatedBy: deps.userId } });

  const [effective] = applyOverrides([job], overrides);
  await boss.updateQueue(job.name, queueOptions(effective));
  await syncSchedule(boss, effective, deps.timeZone);
}

const GROUP_ORDER: Record<JobGroup, number> = { reports: 0, sync: 1, seo: 2, content: 3, system: 4 };

/** Every job with its current settings and last run, for the Settings screen. */
export async function getAutomationSettings(
  db: Db,
  jobs: JobDefinition[],
  options: { timeZone: string; telegramConfigured: boolean },
): Promise<AutomationSettings> {
  const [overrides, runs] = await Promise.all([
    getJobOverrides(db),
    db
      .selectDistinctOn([jobRuns.jobName], {
        jobName: jobRuns.jobName,
        status: jobRuns.status,
        startedAt: jobRuns.startedAt,
        finishedAt: jobRuns.finishedAt,
        error: jobRuns.error,
      })
      .from(jobRuns)
      .orderBy(jobRuns.jobName, desc(jobRuns.startedAt)),
  ]);
  const lastRuns = new Map(runs.map((run) => [run.jobName, run]));
  const infoOrder = Object.keys(JOB_INFO);

  return {
    timezone: options.timeZone,
    telegramConfigured: options.telegramConfigured,
    jobs: applyOverrides(jobs, overrides)
      .map((job) => {
        const run = lastRuns.get(job.name);
        const original = jobs.find((candidate) => candidate.name === job.name);
        return {
          name: job.name,
          group: jobGroup(job.name),
          manual: job.manual,
          enabled: job.enabled,
          schedule: job.schedule ?? null,
          defaultSchedule: original?.schedule ?? null,
          retryLimit: job.retryLimit,
          defaultRetryLimit: original?.retryLimit ?? job.retryLimit,
          lastRun: run
            ? {
                status: run.status,
                startedAt: run.startedAt.toISOString(),
                finishedAt: run.finishedAt?.toISOString() ?? null,
                error: run.error,
              }
            : null,
        };
      })
      .sort(
        (a, b) =>
          GROUP_ORDER[a.group] - GROUP_ORDER[b.group] ||
          (infoOrder.indexOf(a.name) === -1 ? 99 : infoOrder.indexOf(a.name)) -
            (infoOrder.indexOf(b.name) === -1 ? 99 : infoOrder.indexOf(b.name)),
      ),
  };
}
