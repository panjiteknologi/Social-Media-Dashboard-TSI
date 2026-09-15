import { describe, expect, it } from 'vitest';
import type { SeoAction, SeoActionsResponse } from './actions';
import { buildFixPrompt } from './fixPrompt';
import type { TechnicalHealth } from './technical';

const action = (overrides: Partial<SeoAction>): SeoAction => ({
  id: overrides.kind ?? 'id',
  kind: 'low_ctr',
  priority: 'P2',
  issue: 'Low CTR',
  target: 'https://tsicertification.com/company-profile/',
  action: 'Rewrite the title and meta description.',
  detail: '0.7% CTR at average position 7.6',
  status: 'open',
  firstSeenAt: '2026-09-15T00:00:00Z',
  lastSeenAt: '2026-09-15T00:00:00Z',
  resolvedAt: null,
  resolvedBy: null,
  ...overrides,
});

const actions: SeoActionsResponse = {
  contentHost: 'tsicertification.com',
  actions: [
    action({ id: 'ctr' }),
    action({
      id: 'broken',
      kind: 'broken_page',
      priority: 'P1',
      issue: 'Broken page',
      target: 'https://tsicertification.com/download/privacy-policy/',
      action: 'Fix or remove the link on the page that links here.',
      detail: 'Returns 404; linked from https://tsicertification.com/id/privacy-policy/',
    }),
    action({
      id: 'index',
      kind: 'technical_index',
      issue: '30 pages not indexed by Google',
      target: 'tsicertification.com',
      action: 'Request indexing.',
      detail: 'For example /id/',
    }),
    action({ id: 'opp', kind: 'opportunity', priority: 'P3', issue: 'SEO opportunity', target: 'sertifikasi iso' }),
    action({ id: 'done', kind: 'cannibalization', issue: 'Keyword cannibalization', target: 'iso 22301', status: 'done' }),
  ],
};

const technical: TechnicalHealth = {
  contentHost: 'tsicertification.com',
  crawledAt: '2026-09-15T04:57:00Z',
  pagesCrawled: 247,
  truncated: false,
  inspectedAt: '2026-09-15T06:09:00Z',
  pagespeedAt: null,
  indexed: { indexed: 70, inspected: 100 },
  checks: [
    {
      key: 'index',
      label: 'Index Issues',
      state: 'issues',
      count: 30,
      severity: 'High',
      note: '',
      issues: Array.from({ length: 25 }, (_, index) => ({
        url: `https://tsicertification.com/id/page-${index}/`,
        note: 'Discovered - currently not indexed',
      })),
    },
  ],
};

describe('buildFixPrompt', () => {
  const prompt = buildFixPrompt({ actions, technical, generatedOn: '2026-09-15' })!;

  it('sets the context and the working rules', () => {
    expect(prompt.startsWith('# Fix SEO issues on tsicertification.com')).toBe(true);
    expect(prompt).toContain(
      'found these issues on 15 Sep 2026, from a crawl of 247 URLs, Google URL Inspection and Google Search Console data for the last 28 days.',
    );
    const olderCrawl = buildFixPrompt({ actions, technical, generatedOn: '2026-09-20' })!;
    expect(olderCrawl).toContain('from a crawl of 247 URLs on 15 Sep 2026, Google URL Inspection and');
    expect(prompt).toContain('Do not push until I say so.');
    expect(prompt).toContain('## Issues (4 tasks, most urgent first)');
  });

  it('groups tasks by where they are fixed, broken pages first, with evidence and action', () => {
    expect(prompt.indexOf('### 1. Broken pages')).toBeLessThan(prompt.indexOf('### 2. Pages with a low click-through rate'));
    expect(prompt).toContain(
      '- Broken page: https://tsicertification.com/download/privacy-policy/\n  Evidence: Returns 404; linked from https://tsicertification.com/id/privacy-policy/\n  Recommended action: Fix or remove the link on the page that links here.',
    );
    expect(prompt).toContain('- SEO opportunity: the Google search "sertifikasi iso"');
  });

  it('lists every affected page of a site-wide task, counting the rest', () => {
    expect(prompt).toContain('  - https://tsicertification.com/id/page-24/: Discovered - currently not indexed');
    expect(prompt).toContain('  - …and 5 more, listed under Technical SEO Health in Content Machine');
  });

  it('leaves out done tasks and task statuses', () => {
    expect(prompt).not.toContain('iso 22301');
    expect(prompt).not.toMatch(/\b(Open|In Progress|Done)\b/);
  });

  it('follows the tasks: sections without tasks are left out, numbering closes up, new kinds are not lost', () => {
    const current = buildFixPrompt({
      actions: {
        ...actions,
        actions: [
          actions.actions[3],
          action({ id: 'new', kind: 'technical_hreflang', issue: '4 pages with hreflang problems', target: 'tsicertification.com' }),
        ],
      },
      technical,
      generatedOn: '2026-09-15',
    })!;
    expect(current).toContain('## Issues (2 tasks, most urgent first)');
    expect(current).toContain('### 1. SEO opportunities');
    expect(current).toContain('### 2. Other issues');
    expect(current).toContain('- 4 pages with hreflang problems');
    expect(current).not.toContain('Broken pages');
    expect(current).not.toContain('Low CTR');
  });

  it('returns null when nothing is open', () => {
    expect(
      buildFixPrompt({ actions: { ...actions, actions: [actions.actions[4]] }, technical, generatedOn: '2026-09-15' }),
    ).toBeNull();
  });

  it('falls back to the task examples without technical data', () => {
    const withoutTechnical = buildFixPrompt({ actions, technical: null, generatedOn: '2026-09-15' })!;
    expect(withoutTechnical).toContain('  Examples: For example /id/');
    expect(withoutTechnical).toContain('from Google Search Console data for the last 28 days.');
  });
});
