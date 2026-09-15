/**
 * Settings > Reporting and Automation: schedules the team can change without a
 * developer, in a shape people read ("every Monday at 08:15") rather than cron.
 */
import type { JobRunStatus } from './api';

export type ScheduleShape =
  | { kind: 'hourly'; minute: number }
  | { kind: 'daily'; hour: number; minute: number }
  | { kind: 'weekly'; weekday: number; hour: number; minute: number }
  | { kind: 'monthly'; day: number; hour: number; minute: number };

export const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Monthly jobs run on day 28 at the latest, so every month has that day. */
export const MAX_MONTH_DAY = 28;

export const MAX_RETRY_LIMIT = 5;

const whole = (text: string, min: number, max: number): number | null =>
  /^\d{1,2}$/.test(text) && Number(text) >= min && Number(text) <= max ? Number(text) : null;

/** Reads the four schedule patterns the app uses; anything else is null. */
export function parseSchedule(cron: string): ScheduleShape | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [minuteText, hourText, dayText, monthText, weekdayText] = parts;
  const minute = whole(minuteText, 0, 59);
  if (minute === null || monthText !== '*') return null;
  if (hourText === '*') return dayText === '*' && weekdayText === '*' ? { kind: 'hourly', minute } : null;

  const hour = whole(hourText, 0, 23);
  if (hour === null) return null;
  if (dayText === '*' && weekdayText === '*') return { kind: 'daily', hour, minute };
  if (dayText === '*') {
    const weekday = whole(weekdayText, 0, 6);
    return weekday === null ? null : { kind: 'weekly', weekday, hour, minute };
  }
  if (weekdayText === '*') {
    const day = whole(dayText, 1, MAX_MONTH_DAY);
    return day === null ? null : { kind: 'monthly', day, hour, minute };
  }
  return null;
}

export function formatSchedule(shape: ScheduleShape): string {
  switch (shape.kind) {
    case 'hourly':
      return `${shape.minute} * * * *`;
    case 'daily':
      return `${shape.minute} ${shape.hour} * * *`;
    case 'weekly':
      return `${shape.minute} ${shape.hour} * * ${shape.weekday}`;
    case 'monthly':
      return `${shape.minute} ${shape.hour} ${shape.day} * *`;
  }
}

const pad = (value: number): string => String(value).padStart(2, '0');

export function describeSchedule(shape: ScheduleShape): string {
  switch (shape.kind) {
    case 'hourly':
      return `Every hour at minute ${pad(shape.minute)}`;
    case 'daily':
      return `Every day at ${pad(shape.hour)}:${pad(shape.minute)}`;
    case 'weekly':
      return `Every ${WEEKDAY_NAMES[shape.weekday]} at ${pad(shape.hour)}:${pad(shape.minute)}`;
    case 'monthly':
      return `On day ${shape.day} of every month at ${pad(shape.hour)}:${pad(shape.minute)}`;
  }
}

export type JobGroup = 'reports' | 'sync' | 'seo' | 'system';

/** How each job appears in Settings. Jobs missing here show under System with their queue name. */
export const JOB_INFO: Record<string, { label: string; summary: string; group: JobGroup }> = {
  'report-daily': { label: 'Daily report', summary: "Yesterday's numbers and an AI summary, sent to Telegram.", group: 'reports' },
  'report-weekly': { label: 'Weekly report', summary: 'Last Monday to Sunday, sent to Telegram.', group: 'reports' },
  'report-monthly': { label: 'Monthly report', summary: 'Last calendar month, sent to Telegram.', group: 'reports' },
  'seo-weekly-digest': {
    label: 'Priority keyword alert',
    summary: 'Messages Telegram when a priority keyword dropped. Silent otherwise.',
    group: 'reports',
  },
  'gsc-sync': { label: 'Search Console sync', summary: 'Copies clicks, impressions and positions from Google.', group: 'sync' },
  'ga4-sync': { label: 'Google Analytics sync', summary: 'Copies sessions, channels and website events through yesterday.', group: 'sync' },
  'cms-sync': { label: 'CMS articles and leads', summary: 'Copies articles and lead counts from the CMS database.', group: 'sync' },
  'seo-actions': { label: 'SEO Action Center', summary: 'Opens tasks for problems found and closes tasks that are solved.', group: 'seo' },
  'site-crawl': { label: 'Website crawl', summary: 'Checks every page and internal link for errors and missing tags.', group: 'seo' },
  'index-inspection': { label: 'Google index check', summary: 'Asks Google which sitemap pages are indexed.', group: 'seo' },
  'pagespeed-check': { label: 'Page speed check', summary: 'Tests mobile speed of the home page and top pages.', group: 'seo' },
  'system-cleanup': { label: 'Cleanup', summary: 'Deletes old run logs and expired sign-in sessions.', group: 'system' },
  'system-selftest': { label: 'Job pipeline self-test', summary: 'Checks that background jobs run and alerts work.', group: 'system' },
};

export const jobGroup = (name: string): JobGroup => JOB_INFO[name]?.group ?? 'system';

/** What the team saved for one job; anything left out keeps the default. */
export interface JobSettingOverride {
  enabled?: boolean;
  schedule?: string;
  retryLimit?: number;
}

export interface JobSettingInput {
  enabled: boolean;
  /** Null for jobs that only run when started by hand. */
  schedule: string | null;
  retryLimit: number;
}

export interface AutomationJob {
  name: string;
  group: JobGroup;
  manual: boolean;
  enabled: boolean;
  /** Null for jobs that only run when started by hand. */
  schedule: string | null;
  defaultSchedule: string | null;
  retryLimit: number;
  defaultRetryLimit: number;
  lastRun: { status: JobRunStatus; startedAt: string; finishedAt: string | null; error: string | null } | null;
}

export interface AutomationSettings {
  timezone: string;
  telegramConfigured: boolean;
  jobs: AutomationJob[];
}
