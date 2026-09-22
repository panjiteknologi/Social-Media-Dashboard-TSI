/**
 * Leads from the website's contact form, with the interest signals around them.
 *
 * What a person wrote in the form is personal data belonging to them, so it
 * lives in the CMS only. Content Machine reads a lead's own words while
 * somebody has that lead open, and never stores them.
 */

export interface LeadRow {
  id: number;
  /** The service they asked about, as the form offers it. */
  serviceInquiry: string;
  language: string;
  sourcePage: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** Read from the CMS on demand; never written to Content Machine's database. */
export interface LeadDetail {
  id: number;
  fullName: string | null;
  companyName: string | null;
  jobTitle: string | null;
  email: string | null;
  phone: string | null;
  message: string | null;
}

/** What visitors did on a page, from GA4. GA4 holds counts, never identities. */
export interface SignalRow {
  event: string;
  page: string;
  channel: string;
  count: number;
}

export interface LeadsResponse {
  leads: LeadRow[];
  /** False until the CMS grant for reading a lead's own words is in place. */
  detailsAvailable: boolean;
  /** The days the signals cover. */
  window: { start: string; end: string } | null;
  signals: SignalRow[];
  totals: Record<string, number>;
  byService: Array<{ value: string; count: number }>;
  bySourcePage: Array<{ value: string; count: number }>;
}

export const SIGNAL_EVENTS = ['form_submit', 'generate_lead', 'whatsapp_click', 'cta_click', 'contact_click'] as const;

export const EVENT_LABELS: Record<string, string> = {
  form_submit: 'Form submitted',
  generate_lead: 'Lead event',
  whatsapp_click: 'WhatsApp click',
  cta_click: 'CTA click',
  contact_click: 'Contact click',
  share: 'Shared',
};

export const eventLabel = (event: string): string => EVENT_LABELS[event] ?? event;

export const LEAD_STATUS_LABELS: Record<string, string> = {
  new: 'New',
  contacted: 'Contacted',
  closed: 'Closed',
};

export const leadStatusLabel = (status: string): string => LEAD_STATUS_LABELS[status] ?? status;

/** Counts per value, largest first, with ties in alphabetical order. */
export function countBy<T>(rows: readonly T[], key: (row: T) => string | null): Array<{ value: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const value = key(row);
    if (value === null || value === '') continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return [...counts]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
}

/** One line per event, counts summed across pages and channels. */
export function totalsByEvent(signals: readonly SignalRow[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const signal of signals) totals[signal.event] = (totals[signal.event] ?? 0) + signal.count;
  return totals;
}

/** The pages that produced the most of one event, biggest first. */
export function pagesForEvent(signals: readonly SignalRow[], event: string): Array<{ page: string; count: number }> {
  const pages = new Map<string, number>();
  for (const signal of signals) {
    if (signal.event !== event) continue;
    pages.set(signal.page, (pages.get(signal.page) ?? 0) + signal.count);
  }
  return [...pages]
    .map(([page, count]) => ({ page, count }))
    .sort((a, b) => b.count - a.count || a.page.localeCompare(b.page));
}

export interface Page<T> {
  rows: T[];
  /** The page actually shown, clamped into range. */
  page: number;
  pages: number;
  total: number;
}

/** One page of rows. An out-of-range page shows the nearest real one, never an empty screen. */
export function paginate<T>(rows: readonly T[], page: number, perPage: number): Page<T> {
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / perPage));
  const current = Math.min(Math.max(1, Math.trunc(page) || 1), pages);
  return { rows: rows.slice((current - 1) * perPage, current * perPage), page: current, pages, total };
}

/**
 * Leads that arrived after the last one this person saw, newest first. The CMS
 * gives each lead the next id, so a bigger id means a later lead.
 */
export function newLeadsSince(leads: readonly LeadRow[], lastSeenId: number): LeadRow[] {
  return leads.filter((lead) => lead.id > lastSeenId).sort((a, b) => b.id - a.id);
}

/** The newest lead's id, or the id already seen when there is nothing newer. */
export const latestLeadId = (leads: readonly LeadRow[], fallback = 0): number =>
  leads.reduce((highest, lead) => Math.max(highest, lead.id), fallback);

/** True when the lead has nothing a person can read beyond its category. */
export const detailIsEmpty = (detail: LeadDetail): boolean =>
  [detail.fullName, detail.companyName, detail.jobTitle, detail.email, detail.phone, detail.message].every(
    (value) => value === null || value.trim() === '',
  );
