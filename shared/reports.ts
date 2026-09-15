/**
 * Automated reports: which days each kind covers, and the shapes the API
 * stores and the web app shows.
 */
import type { Period } from './content';
import { addDays, formatDate } from './seo';

export const REPORT_KINDS = ['daily', 'weekly', 'monthly'] as const;

export type ReportKind = (typeof REPORT_KINDS)[number];

export interface ReportPeriods {
  current: Period;
  previous: Period;
}

/** Day of the week for an ISO date, 0 = Sunday. */
const weekday = (isoDate: string): number => new Date(`${isoDate}T00:00:00Z`).getUTCDay();

const firstOfMonth = (isoDate: string): string => `${isoDate.slice(0, 7)}-01`;

/**
 * The days a report covers when it runs on `today`, and the days it is
 * compared with: yesterday against the same weekday a week before, the last
 * full Monday–Sunday week against the week before, or the last full calendar
 * month against the month before.
 */
export function reportPeriods(kind: ReportKind, today: string): ReportPeriods {
  if (kind === 'daily') {
    const day = addDays(today, -1);
    const weekBefore = addDays(day, -7);
    return { current: { start: day, end: day }, previous: { start: weekBefore, end: weekBefore } };
  }
  if (kind === 'weekly') {
    const daysSinceSunday = weekday(today) === 0 ? 7 : weekday(today);
    const end = addDays(today, -daysSinceSunday);
    const start = addDays(end, -6);
    return { current: { start, end }, previous: { start: addDays(start, -7), end: addDays(end, -7) } };
  }
  const end = addDays(firstOfMonth(today), -1);
  const start = firstOfMonth(end);
  const previousEnd = addDays(start, -1);
  return { current: { start, end }, previous: { start: firstOfMonth(previousEnd), end: previousEnd } };
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function reportTitle(kind: ReportKind, period: Period): string {
  if (kind === 'daily') return `Daily report, ${formatDate(period.start)}`;
  if (kind === 'weekly') return `Weekly report, ${formatDate(period.start, false)} – ${formatDate(period.end)}`;
  const [year, month] = period.start.split('-').map(Number);
  return `Monthly report, ${MONTH_NAMES[month - 1]} ${year}`;
}

export interface Comparison {
  current: number;
  /** Null when there is no data for the comparison period. */
  previous: number | null;
}

export interface ReportData {
  kind: ReportKind;
  period: Period;
  previousPeriod: Period;
  /** GA4 numbers; null when GA4 has no data for any of the period. */
  traffic: {
    /** False when GA4 data covers only part of the period. */
    covered: boolean;
    sessions: Comparison;
    organicSessions: Comparison;
    engagedSessions: Comparison;
    leadEvents: Comparison;
    ctaClicks: Comparison;
  } | null;
  /** Contact form submissions stored in the CMS. */
  leads: {
    /** Day of the first lead in the CMS; before it the CMS stored none, so there is nothing to count. */
    since: string | null;
    count: Comparison;
    byService: Array<{ service: string; count: number }>;
  };
  /**
   * Search Console numbers. They lag about three days, so daily and weekly
   * reports use the latest 7 final days and monthly reports the month up to
   * the latest final day.
   */
  search: {
    period: Period;
    clicks: Comparison;
    impressions: Comparison;
    position: { current: number | null; previous: number | null };
  } | null;
  /** Website pages with the most search clicks in the search period. */
  topPages: Array<{ title: string; url: string; clicks: number; impressions: number }>;
  articlesPublished: Array<{ title: string; slug: string; publishedAt: string }>;
  /** Background jobs that failed for good during the period. */
  failedJobs: number;
}

export interface ReportSummary {
  summary: string;
  focus: string[];
}

export interface ReportRecord {
  id: string;
  kind: ReportKind;
  title: string;
  periodStart: string;
  periodEnd: string;
  createdAt: string;
  data: ReportData;
  summary: string | null;
  focus: string[];
  aiModel: string | null;
  /** Why the report has no AI summary, when it has none. */
  aiNote: string | null;
  telegramSentAt: string | null;
  telegramError: string | null;
}
