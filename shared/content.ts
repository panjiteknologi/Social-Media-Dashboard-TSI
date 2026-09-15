/**
 * Website content and traffic, shared by the API (which computes it) and the
 * web app (which shows it). Articles come from the CMS and are joined with
 * Search Console and GA4 by URL.
 */
import { addDays, type ChartRange } from './seo';

// ---------------------------------------------------------------------------
// Article URLs

/**
 * Path prefixes articles live under. /blog/ is current; /artikel-iso/ is the
 * earlier path, which Google still reports for some articles.
 */
export const ARTICLE_PATH_PREFIXES = ['blog', 'artikel-iso'] as const;

export const articleUrl = (contentHost: string, slug: string): string => `https://${contentHost}/blog/${slug}/`;

/**
 * The article slug a page belongs to, or null for any other page. Takes a full
 * URL (Search Console) or a path (GA4 landing page). Trailing slashes, query
 * strings and the old /artikel-iso/ path all lead to the same article.
 */
export function slugFromPage(page: string, contentHost: string): string | null {
  let url: URL;
  try {
    url = new URL(page, `https://${contentHost}`);
  } catch {
    return null;
  }
  if (url.hostname !== contentHost) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  if (segments.length !== 2 || !(ARTICLE_PATH_PREFIXES as readonly string[]).includes(segments[0])) return null;
  try {
    return decodeURIComponent(segments[1]);
  } catch {
    return segments[1];
  }
}

// ---------------------------------------------------------------------------
// Articles

export const ARTICLE_STATUSES = ['Published', 'Scheduled', 'Draft'] as const;

export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

/** The CMS stores "publish", "scheduling" or "draft". */
export function articleStatus(cmsStatus: string): ArticleStatus {
  if (cmsStatus === 'publish') return 'Published';
  if (cmsStatus === 'scheduling') return 'Scheduled';
  return 'Draft';
}

/** How far back the published-articles count reaches. */
export const PUBLISHED_WINDOWS = ['All', '30D', '60D', '90D'] as const;

export type PublishedWindow = (typeof PUBLISHED_WINDOWS)[number];

const PUBLISHED_WINDOW_DAYS: Record<Exclude<PublishedWindow, 'All'>, number> = { '30D': 30, '60D': 60, '90D': 90 };

export interface PublishedCount {
  current: number;
  /** The same number of days right before; null for All. */
  previous: number | null;
  period: Period | null;
  days: number | null;
}

/**
 * Published articles: all of them, or those published in the last 30, 60 or
 * 90 days up to and including `today`, with the days before for comparison.
 */
export function countPublished(
  articles: ReadonlyArray<{ status: ArticleStatus; publishedAt: string | null }>,
  today: string,
  window: PublishedWindow,
): PublishedCount {
  const published = articles.filter((article) => article.status === 'Published');
  if (window === 'All') return { current: published.length, previous: null, period: null, days: null };

  const days = PUBLISHED_WINDOW_DAYS[window];
  const start = addDays(today, -(days - 1));
  const between = (from: string, to: string): number =>
    published.filter((article) => article.publishedAt !== null && article.publishedAt >= from && article.publishedAt <= to)
      .length;
  return {
    current: between(start, today),
    previous: between(addDays(start, -days), addDays(start, -1)),
    period: { start, end: today },
    days,
  };
}

/** One item of the CMS editor's SEO checklist. */
export interface SeoCheck {
  label: string;
  passed: boolean;
  note: string;
}

export interface QueryShare {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface ArticleSearch {
  clicks: number;
  impressions: number;
  ctr: number | null;
  position: number | null;
  /** Null when the previous 28 days reach back before the data start date. */
  previousClicks: number | null;
  previousPosition: number | null;
  /** Queries Google reported for the article, most clicks first. */
  topQueries: QueryShare[];
}

export interface ArticleTraffic {
  /** GA4 sessions that started on the article, all channels. */
  sessions: number;
  organicSessions: number;
  engagedSessions: number;
  engagementSeconds: number;
  /** generate_lead events in sessions that started on the article. */
  leadEvents: number;
}

export interface ArticleRow {
  id: number;
  slug: string;
  url: string;
  title: string;
  status: ArticleStatus;
  publishedAt: string | null;
  modifiedAt: string | null;
  authorName: string | null;
  categories: string[];
  tags: string[];
  /** The standard the article is about, from its focus keyword or title. */
  cluster: string;
  focusKeyword: string | null;
  excerpt: string | null;
  readingTimeMinutes: number | null;
  wordCount: number;
  /** Share of the SEO checklist that passes, 0–100. */
  seoScore: number;
  seoChecks: SeoCheck[];
  search: ArticleSearch;
  traffic: ArticleTraffic;
}

export interface Period {
  start: string;
  end: string;
}

export interface ArticlesResponse {
  /** When the CMS copy was last refreshed; null before the first CMS sync. */
  syncedAt: string | null;
  contentHost: string;
  /** The last 28 days of Search Console data; null before the first sync. */
  searchPeriod: (Period & { comparable: boolean }) | null;
  /** The last 28 days of GA4 data, starting no earlier than the first tracked day. */
  trafficPeriod: Period | null;
  /** Today in the site's timezone, for counting recently published articles. */
  today: string;
  articles: ArticleRow[];
}

// ---------------------------------------------------------------------------
// Traffic and leads

/** Events the website sends through GTM; the GA4 sync stores these. */
export const TRACKED_EVENTS = [
  'generate_lead',
  'form_submit',
  'whatsapp_click',
  'cta_click',
  'contact_click',
  'share',
] as const;

export const ORGANIC_SEARCH_CHANNEL = 'Organic Search';

export const SOCIAL_CHANNELS: readonly string[] = ['Organic Social', 'Paid Social'];

export interface TrafficTotals {
  sessions: number;
  engagedSessions: number;
  engagementSeconds: number;
  organicSessions: number;
  socialSessions: number;
  /** generate_lead events, all channels. */
  leadEvents: number;
  ctaClicks: number;
}

export interface FunnelStage {
  label: string;
  value: number;
}

export interface AnalyticsOverview {
  range: ChartRange;
  /** First and last day of GA4 data; null before the first sync. */
  dataSince: string | null;
  dataThrough: string | null;
  /** The days the totals cover, starting no earlier than the first tracked day. */
  period: Period | null;
  totals: { current: TrafficTotals; previous: TrafficTotals | null };
  /** Sessions per GA4 default channel group, largest first. */
  channels: Array<{ channel: string; sessions: number; share: number }>;
  /** Contact form submissions stored in the CMS, counted through today. */
  leads: {
    syncedAt: string | null;
    /** Day of the first lead in the CMS. */
    since: string | null;
    period: Period;
    current: number;
    previous: number | null;
    byService: Array<{ service: string; count: number }>;
  };
  /** Organic search from impression to lead, over days both Search Console and GA4 cover; null until they overlap. */
  funnel: (Period & { stages: FunnelStage[] }) | null;
}
