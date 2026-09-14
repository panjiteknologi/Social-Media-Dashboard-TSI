import { and, eq, gte, lte, max } from 'drizzle-orm';
import { addDays } from '../../shared/seo';
import type { Db } from '../db/client';
import { appSettings, gscDaily, gscPageDaily, gscQueryDaily, gscQueryPageDaily } from '../db/schema';
import type { SearchAnalyticsRow, SearchConsoleClient } from '../google/searchConsole';

/** Search Console keeps about 16 months; asking for more simply returns nothing. */
export const SEARCH_CONSOLE_HISTORY_DAYS = 500;

/** Recent days are fetched again on every sync, because Google keeps adjusting them for a few days. */
export const REFETCH_DAYS = 5;

/** Days fetched per batch. Each batch is stored in one transaction, so a failure never leaves a half-written day. */
export const SYNC_CHUNK_DAYS = 30;

/** Rows per insert statement, well under Postgres' limit on statement parameters. */
const INSERT_BATCH = 1000;

/** Longer query or page strings are cut to keep index entries within Postgres' size limit; strings this long are junk. */
const MAX_KEY_LENGTH = 500;

const SYNC_STATE_KEY = 'gsc_sync';

/** Today's date (YYYY-MM-DD) in the given timezone. */
export function todayIn(timeZone: string, now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const laterOf = (a: string, b: string): string => (a > b ? a : b);

export interface SyncPlan {
  startDate: string;
  endDate: string;
  /** True when history is fetched from the start rather than just the recent days. */
  full: boolean;
}

/**
 * Which days to fetch. The first sync, and any sync after the data start date
 * moves earlier than what is stored, fetches the full history; otherwise only
 * the last few days are fetched again.
 */
export function planSync(input: {
  lastSyncedDate: string | null;
  coveredFrom: string | null;
  today: string;
  dataStartDate: string;
}): SyncPlan {
  const earliest = laterOf(input.dataStartDate, addDays(input.today, -SEARCH_CONSOLE_HISTORY_DAYS));
  if (!input.lastSyncedDate || !input.coveredFrom || input.coveredFrom > earliest) {
    return { startDate: earliest, endDate: input.today, full: true };
  }
  return {
    startDate: laterOf(earliest, addDays(input.lastSyncedDate, -(REFETCH_DAYS - 1))),
    endDate: input.today,
    full: false,
  };
}

export function chunkDates(start: string, end: string, size: number): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  for (let from = start; from <= end; from = addDays(from, size)) {
    const to = addDays(from, size - 1);
    chunks.push({ start: from, end: to < end ? to : end });
  }
  return chunks;
}

function batches<T>(rows: T[]): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < rows.length; i += INSERT_BATCH) result.push(rows.slice(i, i + INSERT_BATCH));
  return result;
}

const cut = (value: string): string => (value.length > MAX_KEY_LENGTH ? value.slice(0, MAX_KEY_LENGTH) : value);

const metrics = (row: SearchAnalyticsRow) => ({
  clicks: row.clicks,
  impressions: row.impressions,
  position: row.position,
});

export interface SyncResult {
  full: boolean;
  startDate: string;
  endDate: string;
  dataThrough: string | null;
  rows: { days: number; queries: number; pages: number; queryPages: number };
}

/**
 * Copies Search Console data into the database. Every fetched day is replaced
 * as a whole, so running it twice is harmless and late corrections from Google
 * overwrite what was stored.
 */
export async function syncSearchConsole(deps: {
  db: Db;
  client: SearchConsoleClient;
  today: string;
  dataStartDate: string;
}): Promise<SyncResult> {
  const { db, client } = deps;

  const [{ lastSyncedDate }] = await db.select({ lastSyncedDate: max(gscDaily.date) }).from(gscDaily);
  const [state] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SYNC_STATE_KEY))
    .limit(1);
  const coveredFrom = (state?.value as { coveredFrom?: string } | undefined)?.coveredFrom ?? null;

  const plan = planSync({ lastSyncedDate, coveredFrom, today: deps.today, dataStartDate: deps.dataStartDate });
  const counts = { days: 0, queries: 0, pages: 0, queryPages: 0 };

  for (const chunk of chunkDates(plan.startDate, plan.endDate, SYNC_CHUNK_DAYS)) {
    const range = { startDate: chunk.start, endDate: chunk.end };
    const [days, queries, pages, queryPages] = await Promise.all([
      client.query({ ...range, dimensions: ['date'] }),
      client.query({ ...range, dimensions: ['date', 'query'] }),
      client.query({ ...range, dimensions: ['date', 'page'] }),
      client.query({ ...range, dimensions: ['date', 'query', 'page'] }),
    ]);

    await db.transaction(async (tx) => {
      await tx.delete(gscDaily).where(and(gte(gscDaily.date, chunk.start), lte(gscDaily.date, chunk.end)));
      await tx.delete(gscQueryDaily).where(and(gte(gscQueryDaily.date, chunk.start), lte(gscQueryDaily.date, chunk.end)));
      await tx.delete(gscPageDaily).where(and(gte(gscPageDaily.date, chunk.start), lte(gscPageDaily.date, chunk.end)));
      await tx
        .delete(gscQueryPageDaily)
        .where(and(gte(gscQueryPageDaily.date, chunk.start), lte(gscQueryPageDaily.date, chunk.end)));

      for (const batch of batches(days)) {
        await tx.insert(gscDaily).values(batch.map((row) => ({ date: row.keys[0], ...metrics(row) })));
      }
      for (const batch of batches(queries)) {
        await tx
          .insert(gscQueryDaily)
          .values(batch.map((row) => ({ date: row.keys[0], query: cut(row.keys[1]), ...metrics(row) })))
          .onConflictDoNothing();
      }
      for (const batch of batches(pages)) {
        await tx
          .insert(gscPageDaily)
          .values(batch.map((row) => ({ date: row.keys[0], page: cut(row.keys[1]), ...metrics(row) })))
          .onConflictDoNothing();
      }
      for (const batch of batches(queryPages)) {
        await tx.insert(gscQueryPageDaily).values(
          batch.map((row) => ({ date: row.keys[0], query: cut(row.keys[1]), page: cut(row.keys[2]), ...metrics(row) })),
        );
      }
    });

    counts.days += days.length;
    counts.queries += queries.length;
    counts.pages += pages.length;
    counts.queryPages += queryPages.length;
  }

  if (plan.full) {
    const value = { coveredFrom: plan.startDate };
    await db
      .insert(appSettings)
      .values({ key: SYNC_STATE_KEY, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  }

  const [{ dataThrough }] = await db.select({ dataThrough: max(gscDaily.date) }).from(gscDaily);
  return { full: plan.full, startDate: plan.startDate, endDate: plan.endDate, dataThrough, rows: counts };
}
