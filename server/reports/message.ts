import { z } from 'zod';
import type { Period } from '../../shared/content';
import type { Comparison, ReportData, ReportKind, ReportSummary } from '../../shared/reports';
import { formatDate } from '../../shared/seo';
import type { AiMessage } from '../ai/gateway';

/** Telegram allows 4096 characters per message; this leaves room for the alert prefix. */
const MESSAGE_LIMIT = 4000;

const numberFormat = new Intl.NumberFormat('en-US');
const count = (value: number): string => numberFormat.format(Math.round(value));

const periodLabel = (period: Period): string =>
  period.start === period.end ? formatDate(period.end) : `${formatDate(period.start, false)} – ${formatDate(period.end)}`;

const COMPARED_WITH: Record<ReportKind, string> = {
  daily: 'a week earlier',
  weekly: 'the week before',
  monthly: 'the month before',
};

/** " (+12% vs the week before)", or nothing when there is no comparison. */
export function changeNote(value: Comparison, against: string): string {
  if (value.previous === null) return '';
  if (value.previous === 0) return value.current === 0 ? ` (same as ${against})` : ` (none ${against})`;
  const change = ((value.current - value.previous) / value.previous) * 100;
  if (Math.abs(change) < 0.5) return ` (same as ${against})`;
  return ` (${change > 0 ? '+' : '−'}${Math.abs(change).toFixed(0)}% vs ${against})`;
}

/** The lead count, or why there is none: the CMS holds leads only from the first one on. */
function leadsLine(data: ReportData, against: string): string {
  const { since, count: leadCount, byService } = data.leads;
  if (!since) return 'Leads: none stored in the CMS yet.';
  if (data.period.end < since) {
    return `Leads: none stored in the CMS for this period; the first lead is from ${formatDate(since)}.`;
  }
  const partial = data.period.start < since ? `, counted from ${formatDate(since)}` : '';
  const services = byService.map((item) => `${item.service} ${item.count}`).join(', ');
  return `Leads: ${count(leadCount.current)} from the contact form${partial}${changeNote(leadCount, against)}${services ? `: ${services}` : ''}`;
}

/** The report as the plain-text Telegram message. */
export function formatReportMessage(
  title: string,
  data: ReportData,
  summary: ReportSummary | null,
  appBaseUrl: string,
): string {
  const against = COMPARED_WITH[data.kind];
  const lines = [title, ''];

  if (data.traffic) {
    const { sessions, organicSessions, leadEvents, ctaClicks, covered } = data.traffic;
    lines.push(
      `Visits: ${count(sessions.current)} sessions${changeNote(sessions, against)}, ${count(organicSessions.current)} from Google search${changeNote(organicSessions, against)}`,
    );
    if (!covered) lines.push('GA4 data covers only part of this period.');
    lines.push(`Lead events in GA4: ${count(leadEvents.current)}, CTA clicks: ${count(ctaClicks.current)}`);
  } else {
    lines.push('Visits: no GA4 data for this period yet.');
  }

  lines.push(leadsLine(data, against));

  if (data.search) {
    const { period, clicks, impressions, position } = data.search;
    const searchAgainst = data.kind === 'monthly' ? 'the same days the month before' : 'the 7 days before';
    lines.push(
      `Search, ${periodLabel(period)}: ${count(clicks.current)} clicks${changeNote(clicks, searchAgainst)}, ${count(impressions.current)} impressions, average position ${position.current?.toFixed(1) ?? '—'}`,
    );
  } else {
    lines.push('Search: no Search Console data for this period yet.');
  }

  if (data.topPages.length > 0) {
    lines.push('', 'Top pages in search:');
    for (const page of data.topPages) {
      lines.push(`• ${page.title}: ${count(page.clicks)} clicks, ${count(page.impressions)} impressions`);
    }
  }

  if (data.articlesPublished.length > 0) {
    const n = data.articlesPublished.length;
    lines.push('', `Published: ${n} article${n === 1 ? '' : 's'}`);
    for (const article of data.articlesPublished) lines.push(`• ${article.title}`);
  }

  if (data.failedJobs > 0) {
    lines.push('', `Background jobs that failed: ${data.failedJobs}. Check Workflow Logs.`);
  }

  if (summary) {
    lines.push('', 'Summary', summary.summary);
    if (summary.focus.length > 0) {
      lines.push('', 'Focus next');
      for (const item of summary.focus) lines.push(`• ${item}`);
    }
  }

  lines.push('', `${appBaseUrl.replace(/\/$/, '')}/reports`);
  const text = lines.join('\n');
  return text.length > MESSAGE_LIMIT ? `${text.slice(0, MESSAGE_LIMIT - 1)}…` : text;
}

const SYSTEM_PROMPT = [
  'You write the executive summary of a website marketing report for the marketing team of PT TSI Sertifikasi Internasional, an ISO certification body in Indonesia.',
  'Write in English, in plain sentences.',
  'Use only the numbers in the report data. Never invent numbers, causes or events.',
  'A comparison whose previous value is null has nothing to compare with: do not describe it as growth or decline.',
  'The comparison period is previousPeriod: for a daily report that is the same weekday a week earlier, not the day before.',
  'Search numbers cover search.period, which lags a few days behind the report period; say which days they cover.',
  'leads.since is the day of the first lead ever stored, not the start of this period; lead counts cover the report period.',
  'The site has small volumes, so say when a change is too small to mean much.',
  'Reply with JSON only, without a code fence:',
  '{"summary": "3 to 5 sentences", "focus": ["up to 3 short, concrete actions for the next period"]}',
].join(' ');

export function buildSummaryMessages(title: string, data: ReportData): AiMessage[] {
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `${title}\n\nReport data as JSON:\n${JSON.stringify(data)}` },
  ];
}

const SummarySchema = z.object({
  summary: z.string().trim().min(1),
  focus: z.array(z.string()).default([]),
});

/** The model's JSON answer; plain text becomes the summary when the model ignored the format. */
export function parseSummary(text: string): ReportSummary {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  try {
    const parsed = SummarySchema.safeParse(JSON.parse(cleaned));
    if (parsed.success) {
      return {
        summary: parsed.data.summary,
        focus: parsed.data.focus.map((item) => item.trim()).filter(Boolean).slice(0, 3),
      };
    }
  } catch {
    // Not JSON: fall through to plain text.
  }
  return { summary: text.trim(), focus: [] };
}
