import { and, eq, gte, lte, max } from 'drizzle-orm';
import { TRACKED_EVENTS } from '../../shared/content';
import { addDays } from '../../shared/seo';
import type { Db } from '../db/client';
import { appSettings, ga4ChannelDaily, ga4EventDaily, ga4LandingDaily } from '../db/schema';
import { ga4Date, type AnalyticsClient, type Ga4Row } from '../google/analytics';
import { batches, chunkDates, cut, planSync, SYNC_CHUNK_DAYS } from '../seo/sync';

/** GA4 keeps adding late hits to recent days, so the last three are fetched again on every sync. */
export const GA4_REFETCH_DAYS = 3;

const SYNC_STATE_KEY = 'ga4_sync';

const SESSION_METRICS = ['sessions', 'engagedSessions', 'userEngagementDuration'];

const sessionMetrics = (row: Ga4Row) => ({
  sessions: Math.round(row.metrics[0]),
  engagedSessions: Math.round(row.metrics[1]),
  engagementSeconds: row.metrics[2],
});

export interface Ga4SyncResult {
  full: boolean;
  startDate: string;
  endDate: string;
  dataThrough: string | null;
  rows: { channels: number; landingPages: number; events: number };
}

/**
 * Copies GA4 sessions and the website's tracked events through yesterday;
 * today is still being collected. Every fetched day is replaced as a whole,
 * like the Search Console sync, so running it twice is harmless.
 */
export async function syncAnalytics(deps: {
  db: Db;
  client: AnalyticsClient;
  today: string;
  dataStartDate: string;
}): Promise<Ga4SyncResult> {
  const { db, client } = deps;

  const [{ lastSyncedDate }] = await db.select({ lastSyncedDate: max(ga4ChannelDaily.date) }).from(ga4ChannelDaily);
  const [state] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SYNC_STATE_KEY))
    .limit(1);
  const coveredFrom = (state?.value as { coveredFrom?: string } | undefined)?.coveredFrom ?? null;

  const plan = planSync({
    lastSyncedDate,
    coveredFrom,
    today: addDays(deps.today, -1),
    dataStartDate: deps.dataStartDate,
    refetchDays: GA4_REFETCH_DAYS,
  });
  const counts = { channels: 0, landingPages: 0, events: 0 };

  for (const chunk of chunkDates(plan.startDate, plan.endDate, SYNC_CHUNK_DAYS)) {
    const range = { startDate: chunk.start, endDate: chunk.end };
    const [channels, landingPages, events] = await Promise.all([
      client.report({ ...range, dimensions: ['date', 'sessionDefaultChannelGroup'], metrics: SESSION_METRICS }),
      client.report({
        ...range,
        dimensions: ['date', 'landingPage', 'sessionDefaultChannelGroup'],
        metrics: SESSION_METRICS,
      }),
      client.report({
        ...range,
        dimensions: ['date', 'eventName', 'sessionDefaultChannelGroup', 'landingPage'],
        metrics: ['eventCount'],
        eventNames: TRACKED_EVENTS,
      }),
    ]);

    await db.transaction(async (tx) => {
      await tx
        .delete(ga4ChannelDaily)
        .where(and(gte(ga4ChannelDaily.date, chunk.start), lte(ga4ChannelDaily.date, chunk.end)));
      await tx
        .delete(ga4LandingDaily)
        .where(and(gte(ga4LandingDaily.date, chunk.start), lte(ga4LandingDaily.date, chunk.end)));
      await tx.delete(ga4EventDaily).where(and(gte(ga4EventDaily.date, chunk.start), lte(ga4EventDaily.date, chunk.end)));

      for (const batch of batches(channels)) {
        await tx
          .insert(ga4ChannelDaily)
          .values(batch.map((row) => ({ date: ga4Date(row.dimensions[0]), channel: row.dimensions[1], ...sessionMetrics(row) })))
          .onConflictDoNothing();
      }
      for (const batch of batches(landingPages)) {
        await tx
          .insert(ga4LandingDaily)
          .values(
            batch.map((row) => ({
              date: ga4Date(row.dimensions[0]),
              landingPage: cut(row.dimensions[1]),
              channel: row.dimensions[2],
              ...sessionMetrics(row),
            })),
          )
          .onConflictDoNothing();
      }
      for (const batch of batches(events)) {
        await tx
          .insert(ga4EventDaily)
          .values(
            batch.map((row) => ({
              date: ga4Date(row.dimensions[0]),
              eventName: row.dimensions[1],
              channel: row.dimensions[2],
              landingPage: cut(row.dimensions[3]),
              eventCount: Math.round(row.metrics[0]),
            })),
          )
          .onConflictDoNothing();
      }
    });

    counts.channels += channels.length;
    counts.landingPages += landingPages.length;
    counts.events += events.length;
  }

  if (plan.full) {
    const value = { coveredFrom: plan.startDate };
    await db
      .insert(appSettings)
      .values({ key: SYNC_STATE_KEY, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: new Date() } });
  }

  const [{ dataThrough }] = await db.select({ dataThrough: max(ga4ChannelDaily.date) }).from(ga4ChannelDaily);
  return { full: plan.full, startDate: plan.startDate, endDate: plan.endDate, dataThrough, rows: counts };
}
