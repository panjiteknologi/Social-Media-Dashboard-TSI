import { and, desc, gte, inArray, sql } from 'drizzle-orm';
import pg from 'pg';
import { countBy, SIGNAL_EVENTS, type LeadDetail, type LeadsResponse, type SignalRow } from '../../shared/leads';
import type { Db } from '../db/client';
import { ga4EventDaily, leads } from '../db/schema';
import { addDays } from '../../shared/seo';
import { CMS_LEAD_DETAIL_COLUMNS } from './access';

/** How far back the interest signals reach. */
export const SIGNAL_DAYS = 30;

/** The most recent leads; the contact form has produced a handful a week. */
const MAX_LEADS = 200;

/**
 * Everything the Leads screen shows without touching personal data: the leads
 * themselves, and what visitors did on the pages around them.
 */
export async function getLeads(db: Db, today: string): Promise<Omit<LeadsResponse, 'detailsAvailable'>> {
  const from = addDays(today, -SIGNAL_DAYS);
  const [rows, signalRows] = await Promise.all([
    db.select().from(leads).orderBy(desc(leads.createdAt)).limit(MAX_LEADS),
    db
      .select({
        event: ga4EventDaily.eventName,
        page: ga4EventDaily.landingPage,
        channel: ga4EventDaily.channel,
        count: sql<number>`sum(${ga4EventDaily.eventCount})::int`,
      })
      .from(ga4EventDaily)
      .where(and(gte(ga4EventDaily.date, from), inArray(ga4EventDaily.eventName, [...SIGNAL_EVENTS])))
      .groupBy(ga4EventDaily.eventName, ga4EventDaily.landingPage, ga4EventDaily.channel),
  ]);

  const leadRows = rows.map((row) => ({
    id: row.id,
    serviceInquiry: row.serviceInquiry,
    language: row.language,
    sourcePage: row.sourcePage,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
  const signals: SignalRow[] = signalRows.sort((a, b) => b.count - a.count);

  return {
    leads: leadRows,
    window: signals.length > 0 ? { start: from, end: today } : null,
    signals,
    totals: {
      leads: leadRows.length,
      ...Object.fromEntries(
        SIGNAL_EVENTS.map((event) => [
          event,
          signals.filter((signal) => signal.event === event).reduce((sum, signal) => sum + signal.count, 0),
        ]),
      ),
    },
    byService: countBy(leadRows, (row) => row.serviceInquiry),
    bySourcePage: countBy(leadRows, (row) => row.sourcePage),
  };
}

/** Whether the CMS lets this role read what a person wrote. */
export async function leadDetailsAvailable(connectionString: string): Promise<boolean> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
  await client.connect();
  try {
    const { rows } = await client.query<{ readable: boolean }>(
      `SELECT bool_and(has_column_privilege('public.cms_contact_messages', column_name, 'SELECT')) AS readable
         FROM unnest($1::text[]) AS column_name`,
      [[...CMS_LEAD_DETAIL_COLUMNS]],
    );
    return rows[0]?.readable === true;
  } catch {
    return false;
  } finally {
    await client.end();
  }
}

/**
 * One lead's own words, read straight from the CMS for the person looking at
 * it. Nothing here is written to Content Machine's database or logged.
 */
export async function getLeadDetail(connectionString: string, id: number): Promise<LeadDetail | null> {
  const client = new pg.Client({ connectionString, connectionTimeoutMillis: 15_000 });
  await client.connect();
  try {
    const { rows } = await client.query<{
      id: number;
      full_name: string | null;
      company_name: string | null;
      job_title: string | null;
      email: string | null;
      phone: string | null;
      message: string | null;
    }>(
      `SELECT id, ${CMS_LEAD_DETAIL_COLUMNS.join(', ')} FROM cms_contact_messages WHERE id = $1 LIMIT 1`,
      [id],
    );
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      fullName: row.full_name,
      companyName: row.company_name,
      jobTitle: row.job_title,
      email: row.email,
      phone: row.phone,
      message: row.message,
    };
  } finally {
    await client.end();
  }
}
