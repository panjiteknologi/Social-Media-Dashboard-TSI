/**
 * Search performance rules, shared by the API (which computes them) and the web
 * app (which labels them). Numeric thresholds are defaults that admins can
 * change in Settings; the reasoning behind each is in docs/Build Plan and Status.md.
 */

export const CHART_RANGES = ['30D', '90D', '6M', '1Y'] as const;

export type ChartRange = (typeof CHART_RANGES)[number];

/**
 * Days covered by each range. Longer ranges are charted in weekly buckets:
 * this site's daily numbers are small enough that a daily line is mostly noise.
 */
export const RANGE_SPECS: Record<ChartRange, { days: number; bucketDays: number }> = {
  '30D': { days: 30, bucketDays: 1 },
  '90D': { days: 90, bucketDays: 1 },
  '6M': { days: 182, bucketDays: 7 },
  '1Y': { days: 364, bucketDays: 7 },
};

/** Keyword comparisons use 28-day windows: current enough to act on, long enough to hold real volume. */
export const KEYWORD_WINDOW_DAYS = 28;

export interface SeoSettings {
  /** Impressions a keyword needs within a 28-day window before its position or movement is judged. */
  minImpressions: number;
  /** Words or phrases that mark a query as a brand search. Brand queries are left out of opportunities and cannibalization. */
  brandTerms: string[];
  /** Keywords the team watches closely; they stay in the keyword list even below the impression threshold. */
  priorityKeywords: string[];
  /**
   * Search Console data before this date (YYYY-MM-DD) is ignored. The site was
   * relaunched on 7 May 2026; before that are spam pages from the hacked
   * earlier site and then months without any data, which would distort every
   * trend and comparison.
   */
  dataStartDate: string;
  /**
   * Host of the marketing website. Pages needing attention are limited to it:
   * the Search Console property also covers subdomains such as the ERP and
   * the academy, which are not content the marketing team edits.
   */
  contentHost: string;
}

export const DEFAULT_SEO_SETTINGS: SeoSettings = {
  minImpressions: 30,
  brandTerms: ['tsi', 'tsicertification'],
  priorityKeywords: [],
  dataStartDate: '2026-05-07',
  contentHost: 'tsicertification.com',
};

// ---------------------------------------------------------------------------
// Dates

/** Shifts an ISO date (YYYY-MM-DD) by whole days, in UTC so no timezone can move it. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Whole days from one ISO date to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "12 Sep 2026", or "12 Sep" without the year. Reads the ISO date directly, so no timezone can shift it. */
export function formatDate(isoDate: string, withYear = true): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}${withYear ? ` ${year}` : ''}`;
}

export interface DateWindow {
  start: string;
  end: string;
  previousStart: string;
  previousEnd: string;
}

/** A window of `days` ending on `end`, plus the equally long window right before it. */
export function windowEnding(end: string, days: number): DateWindow {
  const start = addDays(end, -(days - 1));
  const previousEnd = addDays(start, -1);
  return { start, end, previousStart: addDays(previousEnd, -(days - 1)), previousEnd };
}

export interface ClippedWindow {
  start: string;
  end: string;
  /** Null when any of the previous window falls before the data start: a partial comparison would mislead. */
  previous: { start: string; end: string } | null;
}

/** Limits a window to data on or after `dataStart`. */
export function clipWindow(window: DateWindow, dataStart: string): ClippedWindow {
  return {
    start: window.start < dataStart ? dataStart : window.start,
    end: window.end,
    previous: window.previousStart >= dataStart ? { start: window.previousStart, end: window.previousEnd } : null,
  };
}

// ---------------------------------------------------------------------------
// Totals and series

export interface SearchMetrics {
  clicks: number;
  impressions: number;
  position: number;
}

export interface SearchTotals {
  clicks: number;
  impressions: number;
  /** Clicks per impression, 0–1; null without impressions. */
  ctr: number | null;
  /** Average position weighted by impressions, as Search Console reports it; null without impressions. */
  position: number | null;
}

export function combineTotals(rows: SearchMetrics[]): SearchTotals {
  let clicks = 0;
  let impressions = 0;
  let weightedPosition = 0;
  for (const row of rows) {
    clicks += row.clicks;
    impressions += row.impressions;
    weightedPosition += row.position * row.impressions;
  }
  return impressions === 0
    ? { clicks, impressions, ctr: null, position: null }
    : { clicks, impressions, ctr: clicks / impressions, position: weightedPosition / impressions };
}

export interface SeriesPoint {
  /** First day of the bucket. */
  start: string;
  clicks: number;
  impressions: number;
}

/**
 * Sums daily rows into buckets that end on `end` and reach back to `start`, so
 * the newest bucket is always complete and only the oldest can be partial.
 * Days Search Console reported nothing for count as zero.
 */
export function bucketSeries(
  days: Array<SearchMetrics & { date: string }>,
  start: string,
  end: string,
  bucketDays: number,
): SeriesPoint[] {
  const totalDays = daysBetween(start, end) + 1;
  if (totalDays <= 0) return [];

  const byDate = new Map(days.map((day) => [day.date, day]));
  const count = Math.ceil(totalDays / bucketDays);
  const points: SeriesPoint[] = [];
  for (let index = 0; index < count; index++) {
    const bucketEnd = addDays(end, -(count - 1 - index) * bucketDays);
    const fullStart = addDays(bucketEnd, -(bucketDays - 1));
    const point: SeriesPoint = { start: fullStart < start ? start : fullStart, clicks: 0, impressions: 0 };
    for (let date = point.start; date <= bucketEnd; date = addDays(date, 1)) {
      const day = byDate.get(date);
      if (day) {
        point.clicks += day.clicks;
        point.impressions += day.impressions;
      }
    }
    points.push(point);
  }
  return points;
}

// ---------------------------------------------------------------------------
// Classifying queries

const words = (text: string): string =>
  ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;

/** Whether a query contains a brand term as a whole word or phrase ("pt.tsi" matches "tsi"). */
export function isBrandQuery(query: string, brandTerms: string[]): boolean {
  const haystack = words(query);
  return brandTerms.some((term) => {
    const needle = words(term);
    return needle.trim() !== '' && haystack.includes(needle);
  });
}

/** Standard numbers common enough to recognise without an "ISO" prefix, as in "27001 adalah". */
const KNOWN_ISO_NUMBERS = new Set([
  '9001', '14001', '20000', '21001', '22000', '22301', '27001', '27701', '37001', '37301', '42001', '45001', '50001',
]);

/** Named schemes, checked before ISO numbers so "FSSC 22000" is not read as ISO 22000. */
const NAMED_SCHEMES: Array<[RegExp, string]> = [
  [/\bfssc\s*22000\b/i, 'FSSC 22000'],
  [/\bhaccp\b/i, 'HACCP'],
  [/\bispo\b/i, 'ISPO'],
  [/\biscc\b/i, 'ISCC'],
  [/\brspo\b/i, 'RSPO'],
  [/\bsmk3\b/i, 'SMK3'],
];

/**
 * The certification scheme a query or URL is about, such as "ISO 27001",
 * "ISO 20000-1" or "HACCP"; null when it names none. A trailing year
 * ("9001:2015", "14001-2026") is ignored.
 */
export function standardOf(text: string): string | null {
  for (const [pattern, name] of NAMED_SCHEMES) {
    if (pattern.test(text)) return name;
  }
  const prefixed = text.match(/\biso(?:\s*[/-]\s*|\s+)?(?:iec\s*-?\s*)?(\d{3,5})(?:\s*-\s*(\d)(?!\d))?/i);
  if (prefixed) return `ISO ${prefixed[1]}${prefixed[2] ? `-${prefixed[2]}` : ''}`;
  const bare = text.match(/(?<!\d)\d{4,5}(?!\d)/g)?.find((number) => KNOWN_ISO_NUMBERS.has(number));
  return bare ? `ISO ${bare}` : null;
}

/** A topic cluster for a query: its standard, otherwise "Brand" or "Other". */
export function clusterOf(query: string, brandTerms: string[]): string {
  return standardOf(query) ?? (isBrandQuery(query, brandTerms) ? 'Brand' : 'Other');
}

// ---------------------------------------------------------------------------
// Keyword status

export type KeywordStatus = 'Rising' | 'Dropping' | 'Stable' | 'Opportunity' | 'At Risk';

/** Smallest change in average position that counts as movement; smaller shifts are noise at this site's volume. */
export const MIN_POSITION_CHANGE = 2;

/**
 * Positions where a non-brand keyword is worth pushing toward page 1. Wider
 * than page 2 alone: this site's non-brand demand sits mostly at 21–50.
 */
export const OPPORTUNITY_POSITIONS = { from: 8, to: 50 } as const;

export interface KeywordPerformance {
  impressions: number;
  position: number;
  previousImpressions: number;
  previousPosition: number | null;
}

/**
 * Positions gained since the previous window, positive when the keyword
 * improved. Null when either window has too few impressions to judge.
 */
export function positionMovement(keyword: KeywordPerformance, minImpressions: number): number | null {
  if (
    keyword.previousPosition === null ||
    keyword.impressions < minImpressions ||
    keyword.previousImpressions < minImpressions
  ) {
    return null;
  }
  return keyword.previousPosition - keyword.position;
}

export function isOpportunity(
  keyword: { impressions: number; position: number },
  options: { minImpressions: number; isBrand: boolean },
): boolean {
  return (
    !options.isBrand &&
    keyword.impressions >= options.minImpressions &&
    keyword.position >= OPPORTUNITY_POSITIONS.from &&
    keyword.position <= OPPORTUNITY_POSITIONS.to
  );
}

/** One status per keyword, in priority order: At Risk, Dropping, Rising, Opportunity, Stable. */
export function classifyKeyword(
  keyword: KeywordPerformance,
  options: { minImpressions: number; isBrand: boolean },
): KeywordStatus {
  const movement = positionMovement(keyword, options.minImpressions);
  if (movement !== null && keyword.previousPosition !== null) {
    if (keyword.previousPosition <= 10 && keyword.position > 10) return 'At Risk';
    if (movement <= -MIN_POSITION_CHANGE) return 'Dropping';
    if (movement >= MIN_POSITION_CHANGE) return 'Rising';
  }
  return isOpportunity(keyword, options) ? 'Opportunity' : 'Stable';
}

/**
 * 0–100 for an opportunity keyword: 60% how much demand it already reaches
 * (impressions on a log scale, relative to the largest candidate) and 40% how
 * close it sits to the top of the opportunity range.
 */
export function opportunityScore(
  keyword: { impressions: number; position: number },
  maxImpressions: number,
): number {
  const reach =
    maxImpressions > 0 ? Math.min(1, Math.log10(keyword.impressions + 1) / Math.log10(maxImpressions + 1)) : 0;
  const span = OPPORTUNITY_POSITIONS.to - OPPORTUNITY_POSITIONS.from;
  const proximity = Math.min(1, Math.max(0, (OPPORTUNITY_POSITIONS.to - keyword.position) / span));
  return Math.round(100 * (0.6 * reach + 0.4 * proximity));
}

export const POSITION_BANDS = [
  { label: 'Top 3', max: 3 },
  { label: 'Pos 4–10', max: 10 },
  { label: 'Pos 11–20', max: 20 },
  { label: 'Pos 21–50', max: 50 },
  { label: 'Pos 51+', max: Number.POSITIVE_INFINITY },
] as const;

export type PositionBand = (typeof POSITION_BANDS)[number]['label'];

export function positionBand(position: number): PositionBand {
  return (POSITION_BANDS.find((band) => position <= band.max) ?? POSITION_BANDS[POSITION_BANDS.length - 1]).label;
}

/** Search result page a position falls on, ten results per page. */
export const serpPage = (position: number): number => Math.max(1, Math.ceil(position / 10));

// ---------------------------------------------------------------------------
// Cannibalization

/** Share of a query's impressions a page needs before it counts as competing for it. */
export const CANNIBALIZATION_MIN_SHARE = 0.2;

export interface PageShare {
  page: string;
  impressions: number;
  position: number;
  /** Fraction of the query's impressions, 0–1. */
  share: number;
}

/** The pages splitting a query's impressions, biggest first; null when one page clearly owns the query. */
export function competingPages(pages: Array<Omit<PageShare, 'share'>>): PageShare[] | null {
  const total = pages.reduce((sum, page) => sum + page.impressions, 0);
  if (total === 0) return null;
  const competing = pages
    .map((page) => ({ ...page, share: page.impressions / total }))
    .filter((page) => page.share >= CANNIBALIZATION_MIN_SHARE)
    .sort((a, b) => b.share - a.share);
  return competing.length >= 2 ? competing : null;
}

// ---------------------------------------------------------------------------
// API responses

export interface SeoOverview {
  /** Last day of final Search Console data; null before the first sync. */
  dataThrough: string | null;
  dataStartDate: string;
  range: ChartRange;
  /** The requested window; it can reach back before the data start date. */
  window: DateWindow | null;
  /** First day the numbers actually cover, after clipping to the data start date. */
  shownFrom: string | null;
  totals: { current: SearchTotals; previous: SearchTotals | null };
  series: { bucketDays: number; current: SeriesPoint[]; previous: SeriesPoint[] | null };
}

export interface KeywordRow {
  query: string;
  cluster: string;
  isBrand: boolean;
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number;
  previousImpressions: number;
  previousPosition: number | null;
  /** Positions gained since the previous window; null when not comparable. */
  movement: number | null;
  status: KeywordStatus;
  /** Set for opportunity keywords only. */
  opportunityScore: number | null;
  /** Page with the most impressions for the query in the window. */
  landingPage: string | null;
}

export type AttentionReason = 'Ranking declining' | 'Low CTR' | 'Keyword cannibalization';

export interface AttentionItem {
  page: string;
  reason: AttentionReason;
  detail: string;
  impressions: number;
}

export interface SeoKeywords {
  dataThrough: string | null;
  window: DateWindow | null;
  /** True when the previous 28-day window lies entirely after the data start date. */
  comparable: boolean;
  settings: SeoSettings;
  /** Share of all impressions that Google attributes to a reported query, 0–1. */
  queryCoverage: number | null;
  counts: {
    top3: { current: number; previous: number | null };
    top10: { current: number; previous: number | null };
  };
  keywords: KeywordRow[];
  movements: KeywordRow[];
  distribution: Array<{ band: PositionBand; count: number }>;
  cannibalization: Array<{ query: string; impressions: number; pages: PageShare[] }>;
  opportunities: KeywordRow[];
  attention: AttentionItem[];
}
