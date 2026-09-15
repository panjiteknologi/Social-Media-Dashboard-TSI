import { and, eq, gte, lte, sql } from 'drizzle-orm';
import { slugFromPage, type Period, type TrafficTotals } from '../../shared/content';
import { reportPeriods, type Comparison, type ReportData, type ReportKind } from '../../shared/reports';
import { addDays, combineTotals, daysBetween, windowEnding, type SearchMetrics, type SeoSettings } from '../../shared/seo';
import { ga4Span, trafficBetween } from '../content/metrics';
import type { Db } from '../db/client';
import { articles, gscDaily, jobRuns, leads } from '../db/schema';
import { latestDataDate, totalsByPage } from '../seo/metrics';

const TOP_PAGES = 3;

/** Days of Search Console data in daily and weekly reports. */
const SEARCH_DAYS = 7;

const within = (day: string, period: Period): boolean => day >= period.start && day <= period.end;

async function trafficPart(db: Db, current: Period, previous: Period): Promise<ReportData['traffic']> {
  const span = await ga4Span(db);
  if (!span || current.end < span.start || current.start > span.end) return null;

  const [now, before] = await Promise.all([
    trafficBetween(db, current.start, current.end),
    previous.start >= span.start ? trafficBetween(db, previous.start, previous.end) : null,
  ]);
  const compare = (pick: (totals: TrafficTotals) => number): Comparison => ({
    current: pick(now.totals),
    previous: before ? pick(before.totals) : null,
  });
  return {
    covered: current.start >= span.start && current.end <= span.end,
    sessions: compare((t) => t.sessions),
    organicSessions: compare((t) => t.organicSessions),
    engagedSessions: compare((t) => t.engagedSessions),
    leadEvents: compare((t) => t.leadEvents),
    ctaClicks: compare((t) => t.ctaClicks),
  };
}

async function leadsPart(db: Db, current: Period, previous: Period, timeZone: string): Promise<ReportData['leads']> {
  const rows = await db
    .select({
      day: sql<string>`to_char(${leads.createdAt} AT TIME ZONE ${timeZone}, 'YYYY-MM-DD')`,
      service: leads.serviceInquiry,
    })
    .from(leads);

  const firstLead = rows.reduce<string | null>((first, row) => (first === null || row.day < first ? row.day : first), null);
  const inCurrent = rows.filter((row) => within(row.day, current));
  const byService = new Map<string, number>();
  for (const row of inCurrent) byService.set(row.service, (byService.get(row.service) ?? 0) + 1);

  return {
    since: firstLead,
    count: {
      current: inCurrent.length,
      // Before the first lead there is no telling whether the form stored anything.
      previous: firstLead && previous.start >= firstLead ? rows.filter((row) => within(row.day, previous)).length : null,
    },
    byService: [...byService].map(([service, count]) => ({ service, count })).sort((a, b) => b.count - a.count),
  };
}

async function searchPart(
  db: Db,
  kind: ReportKind,
  current: Period,
  previous: Period,
  settings: SeoSettings,
): Promise<Pick<ReportData, 'search' | 'topPages'>> {
  const through = await latestDataDate(db);
  if (!through) return { search: null, topPages: [] };

  let window: Period;
  let before: Period | null;
  if (kind === 'monthly') {
    window = { start: current.start, end: through < current.end ? through : current.end };
    // As many days of the month before, so a month still missing its last days is compared fairly.
    before = { start: previous.start, end: addDays(previous.start, daysBetween(window.start, window.end)) };
  } else {
    const days = windowEnding(through, SEARCH_DAYS);
    window = { start: days.start, end: days.end };
    before = { start: days.previousStart, end: days.previousEnd };
  }
  if (window.start < settings.dataStartDate) window = { start: settings.dataStartDate, end: window.end };
  if (window.start > window.end) return { search: null, topPages: [] };
  if (before.start < settings.dataStartDate) before = null;

  const searchWindow = window;
  const priorWindow = before;
  const [days, pages, stored] = await Promise.all([
    db
      .select({ date: gscDaily.date, clicks: gscDaily.clicks, impressions: gscDaily.impressions, position: gscDaily.position })
      .from(gscDaily)
      .where(and(gte(gscDaily.date, priorWindow?.start ?? searchWindow.start), lte(gscDaily.date, searchWindow.end))),
    totalsByPage(db, searchWindow.start, searchWindow.end),
    db.select({ slug: articles.slug, title: articles.title }).from(articles),
  ]);

  const now = combineTotals(days.filter((day) => within(day.date, searchWindow)));
  const prior = priorWindow ? combineTotals(days.filter((day) => within(day.date, priorWindow))) : null;

  // Group URL variants of the same page (trailing slash, old article path) before ranking.
  const titles = new Map(stored.map((article) => [article.slug, article.title]));
  const grouped = new Map<string, { url: string; title: string; rows: SearchMetrics[] }>();
  for (const [page, totals] of pages) {
    let url: URL;
    try {
      url = new URL(page);
    } catch {
      continue;
    }
    if (url.hostname !== settings.contentHost) continue;
    const slug = slugFromPage(page, settings.contentHost);
    const key = slug ?? url.pathname.replace(/\/$/, '');
    const entry = grouped.get(key) ?? {
      url: page,
      title: (slug && titles.get(slug)) || (url.pathname === '/' ? 'Home page' : url.pathname),
      rows: [],
    };
    entry.rows.push(totals);
    grouped.set(key, entry);
  }
  const topPages = [...grouped.values()]
    .map((entry) => {
      const totals = combineTotals(entry.rows);
      return { title: entry.title, url: entry.url, clicks: totals.clicks, impressions: totals.impressions };
    })
    .filter((page) => page.clicks > 0)
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, TOP_PAGES);

  return {
    search: {
      period: searchWindow,
      clicks: { current: now.clicks, previous: prior ? prior.clicks : null },
      impressions: { current: now.impressions, previous: prior ? prior.impressions : null },
      position: { current: now.position, previous: prior ? prior.position : null },
    },
    topPages,
  };
}

/** Every number a report shows, worked out from the synced data. */
export async function collectReportData(deps: {
  db: Db;
  kind: ReportKind;
  today: string;
  settings: SeoSettings;
  timeZone: string;
}): Promise<ReportData> {
  const { db, kind, settings, timeZone } = deps;
  const { current, previous } = reportPeriods(kind, deps.today);

  const [traffic, leadCounts, search, published, [failed]] = await Promise.all([
    trafficPart(db, current, previous),
    leadsPart(db, current, previous, timeZone),
    searchPart(db, kind, current, previous, settings),
    db
      .select({ title: articles.title, slug: articles.slug, publishedAt: articles.publishedAt })
      .from(articles)
      .where(
        and(eq(articles.status, 'publish'), gte(articles.publishedAt, current.start), lte(articles.publishedAt, current.end)),
      ),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(jobRuns)
      .where(
        and(
          eq(jobRuns.status, 'failed'),
          sql`(${jobRuns.startedAt} AT TIME ZONE ${timeZone})::date BETWEEN ${current.start}::date AND ${current.end}::date`,
        ),
      ),
  ]);

  return {
    kind,
    period: current,
    previousPeriod: previous,
    traffic,
    leads: leadCounts,
    search: search.search,
    topPages: search.topPages,
    articlesPublished: published
      .filter((article): article is { title: string; slug: string; publishedAt: string } => article.publishedAt !== null)
      .sort((a, b) => a.publishedAt.localeCompare(b.publishedAt)),
    failedJobs: failed?.count ?? 0,
  };
}
