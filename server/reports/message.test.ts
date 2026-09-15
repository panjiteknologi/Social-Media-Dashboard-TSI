import { describe, expect, it } from 'vitest';
import type { ReportData } from '../../shared/reports';
import { buildSummaryMessages, changeNote, formatReportMessage, parseSummary } from './message';

const data: ReportData = {
  kind: 'weekly',
  period: { start: '2026-09-07', end: '2026-09-13' },
  previousPeriod: { start: '2026-08-31', end: '2026-09-06' },
  traffic: {
    covered: true,
    sessions: { current: 520, previous: 480 },
    organicSessions: { current: 260, previous: 250 },
    engagedSessions: { current: 300, previous: null },
    leadEvents: { current: 6, previous: 4 },
    ctaClicks: { current: 40, previous: 35 },
  },
  leads: {
    since: '2026-09-01',
    count: { current: 5, previous: null },
    byService: [{ service: 'ISPO Certification', count: 2 }],
  },
  search: {
    period: { start: '2026-09-06', end: '2026-09-12' },
    clicks: { current: 130, previous: 100 },
    impressions: { current: 2400, previous: 2300 },
    position: { current: 11.24, previous: 12 },
  },
  topPages: [{ title: 'Monitoring HACCP', url: 'https://tsicertification.com/blog/monitoring-haccp/', clicks: 5, impressions: 133 }],
  articlesPublished: [{ title: 'ISO 37001:2025', slug: 'iso-37001-2025', publishedAt: '2026-09-08' }],
  failedJobs: 0,
};

describe('changeNote', () => {
  it('describes the change, or nothing without a comparison', () => {
    expect(changeNote({ current: 130, previous: 100 }, 'the week before')).toBe(' (+30% vs the week before)');
    expect(changeNote({ current: 80, previous: 100 }, 'the week before')).toBe(' (−20% vs the week before)');
    expect(changeNote({ current: 5, previous: null }, 'the week before')).toBe('');
    expect(changeNote({ current: 3, previous: 0 }, 'a week earlier')).toBe(' (none a week earlier)');
  });
});

describe('formatReportMessage', () => {
  it('lists the numbers, the summary and a link', () => {
    const message = formatReportMessage(
      'Weekly report, 7 Sep – 13 Sep 2026',
      data,
      { summary: 'Traffic grew slightly.', focus: ['Add focus keywords'] },
      'https://cm.example.com/',
    );
    expect(message).toContain('Visits: 520 sessions (+8% vs the week before), 260 from Google search (+4% vs the week before)');
    expect(message).toContain('Leads: 5 from the contact form: ISPO Certification 2');
    expect(message).toContain('Search, 6 Sep – 12 Sep 2026: 130 clicks (+30% vs the 7 days before), 2,400 impressions, average position 11.2');
    expect(message).toContain('• Monitoring HACCP: 5 clicks, 133 impressions');
    expect(message).toContain('Published: 1 article\n• ISO 37001:2025');
    expect(message).toContain('Summary\nTraffic grew slightly.\n\nFocus next\n• Add focus keywords');
    expect(message.endsWith('https://cm.example.com/reports')).toBe(true);
    expect(message).not.toContain('Background jobs');
  });

  it('does not report zero leads for days before the CMS stored any', () => {
    const before = formatReportMessage('Monthly report', { ...data, leads: { ...data.leads, since: '2026-09-13' }, period: { start: '2026-08-01', end: '2026-08-31' } }, null, 'https://cm.example.com');
    expect(before).toContain('Leads: none stored in the CMS for this period; the first lead is from 13 Sep 2026.');

    const partly = formatReportMessage('Weekly report', { ...data, leads: { ...data.leads, since: '2026-09-13' } }, null, 'https://cm.example.com');
    expect(partly).toContain('Leads: 5 from the contact form, counted from 13 Sep 2026: ISPO Certification 2');
  });

  it('says when a source has no data', () => {
    const message = formatReportMessage('Daily report', { ...data, traffic: null, search: null }, null, 'https://cm.example.com');
    expect(message).toContain('Visits: no GA4 data for this period yet.');
    expect(message).toContain('Search: no Search Console data for this period yet.');
    expect(message).not.toContain('Summary');
  });
});

describe('parseSummary', () => {
  it('reads the JSON answer, with or without a code fence', () => {
    const answer = '{"summary": "Steady week.", "focus": ["One", " Two ", "", "Three", "Four"]}';
    expect(parseSummary(answer)).toEqual({ summary: 'Steady week.', focus: ['One', 'Two', 'Three'] });
    expect(parseSummary(`\`\`\`json\n${answer}\n\`\`\``).summary).toBe('Steady week.');
  });

  it('keeps plain text as the summary when the model ignored the format', () => {
    expect(parseSummary('Traffic was steady.')).toEqual({ summary: 'Traffic was steady.', focus: [] });
  });
});

describe('buildSummaryMessages', () => {
  it('sends the numbers and forbids inventing any', () => {
    const [system, user] = buildSummaryMessages('Weekly report', data);
    expect(system.content).toContain('Never invent numbers');
    expect(user.content).toContain('"clicks":{"current":130,"previous":100}');
  });
});
