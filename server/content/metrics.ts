import { and, eq, gte, lte, max, min, sql, type AnyColumn } from 'drizzle-orm';
import {
  articleStatus,
  articleUrl,
  ORGANIC_SEARCH_CHANNEL,
  slugFromPage,
  SOCIAL_CHANNELS,
  type AnalyticsOverview,
  type ArticleRow,
  type ArticleSearch,
  type ArticlesResponse,
  type ArticleTraffic,
  type FunnelStage,
  type Period,
  type QueryShare,
  type TrafficTotals,
} from '../../shared/content';
import {
  clipWindow,
  clusterOf,
  combineTotals,
  KEYWORD_WINDOW_DAYS,
  RANGE_SPECS,
  standardOf,
  windowEnding,
  type ChartRange,
  type SearchMetrics,
  type SeoSettings,
} from '../../shared/seo';
import { CMS_SYNC_STATE_KEY } from '../cms/sync';
import type { Db } from '../db/client';
import {
  appSettings,
  articles,
  ga4ChannelDaily,
  ga4EventDaily,
  ga4LandingDaily,
  gscDaily,
  gscQueryPageDaily,
  leads,
} from '../db/schema';
import { latestDataDate, totalsByPage } from '../seo/metrics';
import { todayIn } from '../seo/sync';

/** Queries listed per article in its drawer. */
const TOP_QUERIES = 5;

const sumInt = (column: AnyColumn) => sql<number>`coalesce(sum(${column}), 0)::int`;
const sumFloat = (column: AnyColumn) => sql<number>`coalesce(sum(${column}), 0)::float8`;

const emptySearch = (): ArticleSearch => ({
  clicks: 0,
  impressions: 0,
  ctr: null,
  position: null,
  previousClicks: null,
  previousPosition: null,
  topQueries: [],
});

const emptyTraffic = (): ArticleTraffic => ({
  sessions: 0,
  organicSessions: 0,
  engagedSessions: 0,
  engagementSeconds: 0,
  leadEvents: 0,
});

const emptyTotals = (): TrafficTotals => ({
  sessions: 0,
  engagedSessions: 0,
  engagementSeconds: 0,
  organicSessions: 0,
  socialSessions: 0,
  leadEvents: 0,
  ctaClicks: 0,
});

function pushTo<K, V>(map: Map<K, V[]>, key: K, value: V): void {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

async function cmsSyncedAt(db: Db): Promise<string | null> {
  const [state] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, CMS_SYNC_STATE_KEY))
    .limit(1);
  return (state?.value as { syncedAt?: string } | undefined)?.syncedAt ?? null;
}

/** First and last day of GA4 data; null before the first GA4 sync. */
export async function ga4Span(db: Db): Promise<Period | null> {
  const [row] = await db
    .select({ start: min(ga4ChannelDaily.date), end: max(ga4ChannelDaily.date) })
    .from(ga4ChannelDaily);
  return row?.start && row.end ? { start: row.start, end: row.end } : null;
}

// ---------------------------------------------------------------------------
// Articles

/** Every CMS article with its last 28 days of search and visit numbers. */
export async function getArticles(db: Db, settings: SeoSettings, timeZone: string): Promise<ArticlesResponse> {
  const host = settings.contentHost;
  const [stored, syncedAt, searchThrough, span] = await Promise.all([
    db.select().from(articles),
    cmsSyncedAt(db),
    latestDataDate(db),
    ga4Span(db),
  ]);

  const slugs = new Set(stored.map((article) => article.slug));
  const toSlug = (page: string): string | null => {
    const slug = slugFromPage(page, host);
    return slug && slugs.has(slug) ? slug : null;
  };

  const search = new Map<string, ArticleSearch>();
  let searchPeriod: ArticlesResponse['searchPeriod'] = null;
  if (searchThrough) {
    const window = clipWindow(windowEnding(searchThrough, KEYWORD_WINDOW_DAYS), settings.dataStartDate);
    searchPeriod = { start: window.start, end: window.end, comparable: window.previous !== null };

    const [pagesNow, pagesBefore, queryRows] = await Promise.all([
      totalsByPage(db, window.start, window.end),
      window.previous ? totalsByPage(db, window.previous.start, window.previous.end) : null,
      db
        .select({
          query: gscQueryPageDaily.query,
          page: gscQueryPageDaily.page,
          clicks: sumInt(gscQueryPageDaily.clicks),
          impressions: sumInt(gscQueryPageDaily.impressions),
          position: sql<number>`coalesce(sum(${gscQueryPageDaily.position} * ${gscQueryPageDaily.impressions}) / nullif(sum(${gscQueryPageDaily.impressions}), 0), 0)`,
        })
        .from(gscQueryPageDaily)
        .where(and(gte(gscQueryPageDaily.date, window.start), lte(gscQueryPageDaily.date, window.end)))
        .groupBy(gscQueryPageDaily.query, gscQueryPageDaily.page),
    ]);

    // One article can appear under several URLs (with and without a trailing
    // slash, or the old /artikel-iso/ path); their numbers are combined.
    const perSlug = (pages: Map<string, SearchMetrics>) => {
      const grouped = new Map<string, SearchMetrics[]>();
      for (const [page, totals] of pages) {
        const slug = toSlug(page);
        if (slug) pushTo(grouped, slug, totals);
      }
      return new Map([...grouped].map(([slug, rows]) => [slug, combineTotals(rows)]));
    };
    const current = perSlug(pagesNow);
    const previous = pagesBefore ? perSlug(pagesBefore) : null;

    const queriesPerSlug = new Map<string, Map<string, SearchMetrics[]>>();
    for (const row of queryRows) {
      const slug = toSlug(row.page);
      if (!slug) continue;
      const queries = queriesPerSlug.get(slug) ?? new Map<string, SearchMetrics[]>();
      queriesPerSlug.set(slug, queries);
      pushTo(queries, row.query, row);
    }

    for (const slug of slugs) {
      const totals = current.get(slug) ?? combineTotals([]);
      const prior = previous ? (previous.get(slug) ?? combineTotals([])) : null;
      const topQueries: QueryShare[] = [...(queriesPerSlug.get(slug) ?? [])]
        .map(([query, rows]) => {
          const combined = combineTotals(rows);
          return { query, clicks: combined.clicks, impressions: combined.impressions, position: combined.position ?? 0 };
        })
        .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
        .slice(0, TOP_QUERIES);
      search.set(slug, {
        clicks: totals.clicks,
        impressions: totals.impressions,
        ctr: totals.ctr,
        position: totals.position,
        previousClicks: prior ? prior.clicks : null,
        previousPosition: prior ? prior.position : null,
        topQueries,
      });
    }
  }

  const traffic = new Map<string, ArticleTraffic>();
  let trafficPeriod: Period | null = null;
  if (span) {
    const window = clipWindow(windowEnding(span.end, KEYWORD_WINDOW_DAYS), span.start);
    trafficPeriod = { start: window.start, end: window.end };

    const [landingRows, leadRows] = await Promise.all([
      db
        .select({
          page: ga4LandingDaily.landingPage,
          channel: ga4LandingDaily.channel,
          sessions: sumInt(ga4LandingDaily.sessions),
          engagedSessions: sumInt(ga4LandingDaily.engagedSessions),
          engagementSeconds: sumFloat(ga4LandingDaily.engagementSeconds),
        })
        .from(ga4LandingDaily)
        .where(and(gte(ga4LandingDaily.date, window.start), lte(ga4LandingDaily.date, window.end)))
        .groupBy(ga4LandingDaily.landingPage, ga4LandingDaily.channel),
      db
        .select({ page: ga4EventDaily.landingPage, count: sumInt(ga4EventDaily.eventCount) })
        .from(ga4EventDaily)
        .where(
          and(
            gte(ga4EventDaily.date, window.start),
            lte(ga4EventDaily.date, window.end),
            eq(ga4EventDaily.eventName, 'generate_lead'),
          ),
        )
        .groupBy(ga4EventDaily.landingPage),
    ]);

    const entry = (slug: string): ArticleTraffic => {
      let totals = traffic.get(slug);
      if (!totals) {
        totals = emptyTraffic();
        traffic.set(slug, totals);
      }
      return totals;
    };
    for (const row of landingRows) {
      const slug = toSlug(row.page);
      if (!slug) continue;
      const totals = entry(slug);
      totals.sessions += row.sessions;
      totals.engagedSessions += row.engagedSessions;
      totals.engagementSeconds += row.engagementSeconds;
      if (row.channel === ORGANIC_SEARCH_CHANNEL) totals.organicSessions += row.sessions;
    }
    for (const row of leadRows) {
      const slug = toSlug(row.page);
      if (slug) entry(slug).leadEvents += row.count;
    }
  }

  const rows: ArticleRow[] = stored
    .map((article) => ({
      id: article.id,
      slug: article.slug,
      url: articleUrl(host, article.slug),
      title: article.title,
      status: articleStatus(article.status),
      publishedAt: article.publishedAt,
      modifiedAt: article.modifiedAt,
      authorName: article.authorName,
      categories: article.categories,
      tags: article.tags,
      // The focus keyword says best what an article targets; many articles have
      // none, and then the title names the standard.
      cluster: standardOf(article.seoFocusKeyword ?? '') ?? clusterOf(article.title, settings.brandTerms),
      focusKeyword: article.seoFocusKeyword || null,
      excerpt: article.excerpt,
      readingTimeMinutes: article.readingTimeMinutes,
      wordCount: article.wordCount,
      seoScore: article.seoScore,
      seoChecks: article.seoChecks,
      search: search.get(article.slug) ?? emptySearch(),
      traffic: traffic.get(article.slug) ?? emptyTraffic(),
    }))
    .sort((a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '') || a.title.localeCompare(b.title));

  return {
    syncedAt,
    contentHost: host,
    searchPeriod,
    trafficPeriod,
    today: todayIn(timeZone),
    articles: rows,
  };
}

// ---------------------------------------------------------------------------
// Analytics

interface TrafficSlice {
  totals: TrafficTotals;
  channels: Map<string, number>;
  organicEngagedSessions: number;
  /** Tracked event counts in organic search sessions. */
  organicEvents: Map<string, number>;
}

export async function trafficBetween(db: Db, from: string, to: string): Promise<TrafficSlice> {
  const [channelRows, eventRows] = await Promise.all([
    db
      .select({
        channel: ga4ChannelDaily.channel,
        sessions: sumInt(ga4ChannelDaily.sessions),
        engagedSessions: sumInt(ga4ChannelDaily.engagedSessions),
        engagementSeconds: sumFloat(ga4ChannelDaily.engagementSeconds),
      })
      .from(ga4ChannelDaily)
      .where(and(gte(ga4ChannelDaily.date, from), lte(ga4ChannelDaily.date, to)))
      .groupBy(ga4ChannelDaily.channel),
    db
      .select({
        eventName: ga4EventDaily.eventName,
        channel: ga4EventDaily.channel,
        count: sumInt(ga4EventDaily.eventCount),
      })
      .from(ga4EventDaily)
      .where(and(gte(ga4EventDaily.date, from), lte(ga4EventDaily.date, to)))
      .groupBy(ga4EventDaily.eventName, ga4EventDaily.channel),
  ]);

  const totals = emptyTotals();
  const channels = new Map<string, number>();
  let organicEngagedSessions = 0;
  for (const row of channelRows) {
    totals.sessions += row.sessions;
    totals.engagedSessions += row.engagedSessions;
    totals.engagementSeconds += row.engagementSeconds;
    if (row.channel === ORGANIC_SEARCH_CHANNEL) {
      totals.organicSessions += row.sessions;
      organicEngagedSessions += row.engagedSessions;
    }
    if (SOCIAL_CHANNELS.includes(row.channel)) totals.socialSessions += row.sessions;
    channels.set(row.channel, (channels.get(row.channel) ?? 0) + row.sessions);
  }

  const organicEvents = new Map<string, number>();
  for (const row of eventRows) {
    if (row.eventName === 'generate_lead') totals.leadEvents += row.count;
    if (row.eventName === 'cta_click') totals.ctaClicks += row.count;
    if (row.channel === ORGANIC_SEARCH_CHANNEL) {
      organicEvents.set(row.eventName, (organicEvents.get(row.eventName) ?? 0) + row.count);
    }
  }
  return { totals, channels, organicEngagedSessions, organicEvents };
}

/**
 * Leads counted from the CMS, through today in the site's timezone. The
 * comparison needs the whole previous period to lie after the first lead.
 */
async function leadSummary(db: Db, days: number, timeZone: string): Promise<AnalyticsOverview['leads']> {
  const [rows, syncedAt] = await Promise.all([
    db
      .select({
        day: sql<string>`to_char(${leads.createdAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`,
        service: leads.serviceInquiry,
      })
      .from(leads),
    cmsSyncedAt(db),
  ]);

  const since = rows.reduce<string | null>((first, row) => (first === null || row.day < first ? row.day : first), null);
  const requested = windowEnding(todayIn(timeZone), days);
  const window = clipWindow(requested, since ?? requested.start);
  const between = (from: string, to: string) => rows.filter((row) => row.day >= from && row.day <= to);

  const current = between(window.start, window.end);
  const byService = new Map<string, number>();
  for (const row of current) byService.set(row.service, (byService.get(row.service) ?? 0) + 1);

  return {
    syncedAt,
    since,
    period: { start: window.start, end: window.end },
    current: current.length,
    previous: since && window.previous ? between(window.previous.start, window.previous.end).length : null,
    byService: [...byService].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count),
  };
}

/** Organic search from impression to lead, over the days both Search Console and GA4 cover. */
async function organicFunnel(
  db: Db,
  period: Period,
  searchThrough: string | null,
  settings: SeoSettings,
): Promise<AnalyticsOverview['funnel']> {
  if (!searchThrough) return null;
  const start = period.start < settings.dataStartDate ? settings.dataStartDate : period.start;
  const end = searchThrough < period.end ? searchThrough : period.end;
  if (start > end) return null;

  const [[search], traffic] = await Promise.all([
    db
      .select({ clicks: sumInt(gscDaily.clicks), impressions: sumInt(gscDaily.impressions) })
      .from(gscDaily)
      .where(and(gte(gscDaily.date, start), lte(gscDaily.date, end))),
    trafficBetween(db, start, end),
  ]);
  const events = (name: string): number => traffic.organicEvents.get(name) ?? 0;

  const stages: FunnelStage[] = [
    { label: 'Search impressions', value: search.impressions },
    { label: 'Search clicks', value: search.clicks },
    { label: 'Organic sessions', value: traffic.totals.organicSessions },
    { label: 'Engaged sessions', value: traffic.organicEngagedSessions },
    { label: 'CTA clicks', value: events('cta_click') },
    { label: 'Form or WhatsApp', value: events('form_submit') + events('whatsapp_click') },
    { label: 'Lead events', value: events('generate_lead') },
  ];
  return { start, end, stages };
}

/** Traffic, channels, leads and the organic funnel for a range, compared with the range before it. */
export async function getAnalyticsOverview(
  db: Db,
  range: ChartRange,
  settings: SeoSettings,
  timeZone: string,
): Promise<AnalyticsOverview> {
  const { days } = RANGE_SPECS[range];
  const [span, leadPart, searchThrough] = await Promise.all([
    ga4Span(db),
    leadSummary(db, days, timeZone),
    latestDataDate(db),
  ]);

  if (!span) {
    return {
      range,
      dataSince: null,
      dataThrough: null,
      period: null,
      totals: { current: emptyTotals(), previous: null },
      channels: [],
      leads: leadPart,
      funnel: null,
    };
  }

  const window = clipWindow(windowEnding(span.end, days), span.start);
  const period = { start: window.start, end: window.end };
  const [current, previous, funnel] = await Promise.all([
    trafficBetween(db, window.start, window.end),
    window.previous ? trafficBetween(db, window.previous.start, window.previous.end) : null,
    organicFunnel(db, period, searchThrough, settings),
  ]);

  return {
    range,
    dataSince: span.start,
    dataThrough: span.end,
    period,
    totals: { current: current.totals, previous: previous?.totals ?? null },
    channels: [...current.channels]
      .map(([channel, sessions]) => ({
        channel,
        sessions,
        share: current.totals.sessions ? sessions / current.totals.sessions : 0,
      }))
      .sort((a, b) => b.sessions - a.sessions),
    leads: leadPart,
    funnel,
  };
}
