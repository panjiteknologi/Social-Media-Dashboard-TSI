import { and, gte, lte, max, sql } from 'drizzle-orm';
import {
  bucketSeries,
  classifyKeyword,
  clipWindow,
  clusterOf,
  combineTotals,
  competingPages,
  isBrandQuery,
  isOpportunity,
  KEYWORD_WINDOW_DAYS,
  MIN_POSITION_CHANGE,
  opportunityScore,
  POSITION_BANDS,
  positionBand,
  positionMovement,
  RANGE_SPECS,
  windowEnding,
  type AttentionItem,
  type ChartRange,
  type KeywordRow,
  type SeoKeywords,
  type SeoOverview,
  type SeoSettings,
} from '../../shared/seo';
import type { Db } from '../db/client';
import { gscDaily, gscPageDaily, gscQueryDaily, gscQueryPageDaily } from '../db/schema';

/** A page-1 page with a CTR below this is flagged, once it has three times the minimum impressions. */
const LOW_CTR = 0.01;

const LIMITS = { keywords: 100, movements: 5, cannibalization: 10, opportunities: 6, attention: 6 };

interface Aggregate {
  clicks: number;
  impressions: number;
  position: number;
}

export async function latestDataDate(db: Db): Promise<string | null> {
  const [row] = await db.select({ through: max(gscDaily.date) }).from(gscDaily);
  return row?.through ?? null;
}

const dailyBetween = (db: Db, from: string, to: string) =>
  db
    .select({
      date: gscDaily.date,
      clicks: gscDaily.clicks,
      impressions: gscDaily.impressions,
      position: gscDaily.position,
    })
    .from(gscDaily)
    .where(and(gte(gscDaily.date, from), lte(gscDaily.date, to)));

async function totalsByQuery(db: Db, from: string, to: string): Promise<Map<string, Aggregate>> {
  const rows = await db
    .select({
      key: gscQueryDaily.query,
      clicks: sql<number>`sum(${gscQueryDaily.clicks})::int`,
      impressions: sql<number>`sum(${gscQueryDaily.impressions})::int`,
      position: sql<number>`coalesce(sum(${gscQueryDaily.position} * ${gscQueryDaily.impressions}) / nullif(sum(${gscQueryDaily.impressions}), 0), 0)`,
    })
    .from(gscQueryDaily)
    .where(and(gte(gscQueryDaily.date, from), lte(gscQueryDaily.date, to)))
    .groupBy(gscQueryDaily.query);
  return new Map(rows.map(({ key, ...totals }) => [key, totals]));
}

export async function totalsByPage(db: Db, from: string, to: string): Promise<Map<string, Aggregate>> {
  const rows = await db
    .select({
      key: gscPageDaily.page,
      clicks: sql<number>`sum(${gscPageDaily.clicks})::int`,
      impressions: sql<number>`sum(${gscPageDaily.impressions})::int`,
      position: sql<number>`coalesce(sum(${gscPageDaily.position} * ${gscPageDaily.impressions}) / nullif(sum(${gscPageDaily.impressions}), 0), 0)`,
    })
    .from(gscPageDaily)
    .where(and(gte(gscPageDaily.date, from), lte(gscPageDaily.date, to)))
    .groupBy(gscPageDaily.page);
  return new Map(rows.map(({ key, ...totals }) => [key, totals]));
}

function querySplits(db: Db, from: string, to: string) {
  return db
    .select({
      query: gscQueryPageDaily.query,
      page: gscQueryPageDaily.page,
      impressions: sql<number>`sum(${gscQueryPageDaily.impressions})::int`,
      position: sql<number>`coalesce(sum(${gscQueryPageDaily.position} * ${gscQueryPageDaily.impressions}) / nullif(sum(${gscQueryPageDaily.impressions}), 0), 0)`,
    })
    .from(gscQueryPageDaily)
    .where(and(gte(gscQueryPageDaily.date, from), lte(gscQueryPageDaily.date, to)))
    .groupBy(gscQueryPageDaily.query, gscQueryPageDaily.page);
}

/** Headline totals and the trend for a chart range, compared with the range before it. */
export async function getOverview(db: Db, range: ChartRange, settings: SeoSettings): Promise<SeoOverview> {
  const { days, bucketDays } = RANGE_SPECS[range];
  const dataThrough = await latestDataDate(db);
  if (!dataThrough) {
    return {
      dataThrough: null,
      dataStartDate: settings.dataStartDate,
      range,
      window: null,
      shownFrom: null,
      totals: { current: combineTotals([]), previous: null },
      series: { bucketDays, current: [], previous: null },
    };
  }

  const window = windowEnding(dataThrough, days);
  const clipped = clipWindow(window, settings.dataStartDate);
  const rows = await dailyBetween(db, clipped.previous?.start ?? clipped.start, window.end);
  const within = (from: string, to: string) => rows.filter((row) => row.date >= from && row.date <= to);

  return {
    dataThrough,
    dataStartDate: settings.dataStartDate,
    range,
    window,
    shownFrom: clipped.start,
    totals: {
      current: combineTotals(within(clipped.start, window.end)),
      previous: clipped.previous ? combineTotals(within(clipped.previous.start, clipped.previous.end)) : null,
    },
    series: {
      bucketDays,
      current: bucketSeries(rows, clipped.start, window.end, bucketDays),
      previous: clipped.previous ? bucketSeries(rows, clipped.previous.start, clipped.previous.end, bucketDays) : null,
    },
  };
}

/** Everything keyword-level for the latest 28 days, compared with the 28 days before. */
export async function getKeywords(db: Db, settings: SeoSettings): Promise<SeoKeywords> {
  const dataThrough = await latestDataDate(db);
  const min = settings.minImpressions;
  if (!dataThrough) {
    return {
      dataThrough: null,
      window: null,
      comparable: false,
      settings,
      queryCoverage: null,
      counts: { top3: { current: 0, previous: null }, top10: { current: 0, previous: null } },
      keywords: [],
      movements: [],
      distribution: POSITION_BANDS.map((band) => ({ band: band.label, count: 0 })),
      cannibalization: [],
      opportunities: [],
      attention: [],
    };
  }

  const window = windowEnding(dataThrough, KEYWORD_WINDOW_DAYS);
  const { start, end, previous } = clipWindow(window, settings.dataStartDate);
  const none = Promise.resolve(new Map<string, Aggregate>());

  const [current, before, splits, pagesNow, pagesBefore, days] = await Promise.all([
    totalsByQuery(db, start, end),
    previous ? totalsByQuery(db, previous.start, previous.end) : none,
    querySplits(db, start, end),
    totalsByPage(db, start, end),
    previous ? totalsByPage(db, previous.start, previous.end) : none,
    dailyBetween(db, start, end),
  ]);

  const pagesByQuery = new Map<string, Array<{ page: string; impressions: number; position: number }>>();
  for (const split of splits) {
    const pages = pagesByQuery.get(split.query) ?? [];
    pages.push({ page: split.page, impressions: split.impressions, position: split.position });
    pagesByQuery.set(split.query, pages);
  }

  const rows: KeywordRow[] = [...current].map(([query, now]) => {
    const prior = before.get(query);
    const performance = {
      impressions: now.impressions,
      position: now.position,
      previousImpressions: prior?.impressions ?? 0,
      previousPosition: prior?.position ?? null,
    };
    const isBrand = isBrandQuery(query, settings.brandTerms);
    const landing = (pagesByQuery.get(query) ?? []).reduce<{ page: string; impressions: number } | null>(
      (best, page) => (!best || page.impressions > best.impressions ? page : best),
      null,
    );
    return {
      query,
      cluster: clusterOf(query, settings.brandTerms),
      isBrand,
      clicks: now.clicks,
      impressions: now.impressions,
      ctr: now.impressions ? now.clicks / now.impressions : null,
      position: now.position,
      previousImpressions: performance.previousImpressions,
      previousPosition: performance.previousPosition,
      movement: positionMovement(performance, min),
      status: classifyKeyword(performance, { minImpressions: min, isBrand }),
      opportunityScore: null,
      landingPage: landing?.page ?? null,
    };
  });

  const opportunityRows = rows.filter((row) => isOpportunity(row, { minImpressions: min, isBrand: row.isBrand }));
  const largestOpportunity = Math.max(0, ...opportunityRows.map((row) => row.impressions));
  for (const row of opportunityRows) row.opportunityScore = opportunityScore(row, largestOpportunity);

  const byImpressions = (a: { impressions: number }, b: { impressions: number }) => b.impressions - a.impressions;
  const priority = new Set(settings.priorityKeywords);
  const qualifying = rows.filter((row) => row.impressions >= min);

  const countWithin = (totals: Iterable<Aggregate>, maxPosition: number): number => {
    let count = 0;
    for (const total of totals) if (total.impressions >= min && total.position <= maxPosition) count++;
    return count;
  };

  const cannibalization: SeoKeywords['cannibalization'] = [];
  for (const [query, pages] of pagesByQuery) {
    if (isBrandQuery(query, settings.brandTerms)) continue;
    const impressions = pages.reduce((sum, page) => sum + page.impressions, 0);
    const competing = impressions >= min ? competingPages(pages) : null;
    if (competing) cannibalization.push({ query, impressions, pages: competing });
  }
  cannibalization.sort(byImpressions);

  const isContentPage = (page: string): boolean => {
    try {
      return new URL(page).hostname === settings.contentHost;
    } catch {
      return false;
    }
  };

  const attention: AttentionItem[] = [];
  for (const [page, now] of pagesNow) {
    if (!isContentPage(page)) continue;
    const prior = pagesBefore.get(page);
    if (
      prior &&
      now.impressions >= min &&
      prior.impressions >= min &&
      now.position - prior.position >= MIN_POSITION_CHANGE
    ) {
      attention.push({
        page,
        reason: 'Ranking declining',
        detail: `Average position ${prior.position.toFixed(1)} → ${now.position.toFixed(1)}`,
        impressions: now.impressions,
      });
    }
    const ctr = now.impressions ? now.clicks / now.impressions : 0;
    if (now.position <= 10 && now.impressions >= 3 * min && ctr < LOW_CTR) {
      attention.push({
        page,
        reason: 'Low CTR',
        detail: `${(ctr * 100).toFixed(1)}% CTR at average position ${now.position.toFixed(1)}`,
        impressions: now.impressions,
      });
    }
  }
  for (const item of cannibalization.slice(0, LIMITS.cannibalization)) {
    const others = item.pages.length - 1;
    for (const page of item.pages) {
      attention.push({
        page: page.page,
        reason: 'Keyword cannibalization',
        detail: `Splits "${item.query}" with ${others} other page${others === 1 ? '' : 's'}`,
        impressions: page.impressions,
      });
    }
  }

  const siteImpressions = combineTotals(days).impressions;
  const queryImpressions = [...current.values()].reduce((sum, total) => sum + total.impressions, 0);

  return {
    dataThrough,
    window,
    comparable: previous !== null,
    settings,
    queryCoverage: siteImpressions ? queryImpressions / siteImpressions : null,
    counts: {
      top3: { current: countWithin(current.values(), 3), previous: previous ? countWithin(before.values(), 3) : null },
      top10: {
        current: countWithin(current.values(), 10),
        previous: previous ? countWithin(before.values(), 10) : null,
      },
    },
    keywords: rows
      .filter((row) => row.impressions >= min || priority.has(row.query.toLowerCase()))
      .sort(byImpressions)
      .slice(0, LIMITS.keywords),
    movements: rows
      .filter((row) => row.movement !== null && Math.abs(row.movement) >= MIN_POSITION_CHANGE)
      .sort((a, b) => Math.abs(b.movement ?? 0) - Math.abs(a.movement ?? 0) || b.impressions - a.impressions)
      .slice(0, LIMITS.movements),
    distribution: POSITION_BANDS.map((band) => ({
      band: band.label,
      count: qualifying.filter((row) => positionBand(row.position) === band.label).length,
    })),
    cannibalization: cannibalization.slice(0, LIMITS.cannibalization),
    opportunities: opportunityRows
      .sort((a, b) => (b.opportunityScore ?? 0) - (a.opportunityScore ?? 0))
      .slice(0, LIMITS.opportunities),
    attention: attention.sort(byImpressions).slice(0, LIMITS.attention),
  };
}
