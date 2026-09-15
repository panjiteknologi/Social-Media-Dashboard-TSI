import { describe, expect, it } from 'vitest';
import type { KeywordRow, SeoKeywords } from '../../shared/seo';
import type { HealthCheck, TechnicalHealth } from '../../shared/technical';
import { buildActionCandidates, planActionSync, type ActionCandidate, type StoredAction } from './actions';

const keyword = (overrides: Partial<KeywordRow>): KeywordRow => ({
  query: 'sertifikasi iso',
  cluster: 'Other',
  isBrand: false,
  clicks: 3,
  impressions: 120,
  ctr: 0.025,
  position: 12.4,
  previousImpressions: 110,
  previousPosition: 8.1,
  movement: -4.3,
  status: 'Stable',
  opportunityScore: null,
  landingPage: 'https://tsicertification.com/iso-9001-qms/',
  ...overrides,
});

const keywords = {
  keywords: [
    keyword({ query: 'iso 9001', status: 'At Risk' }),
    keyword({ query: 'iso 14001', status: 'Dropping', position: 25, previousPosition: 19 }),
    keyword({ query: 'tsi certification', status: 'Dropping', isBrand: true }),
    keyword({ query: 'iso 27001', status: 'Stable' }),
  ],
  attention: [
    { page: 'https://tsicertification.com/company-profile/', reason: 'Low CTR', detail: '0.8% CTR at average position 6.2', impressions: 1955 },
    { page: 'https://tsicertification.com/a/', reason: 'Keyword cannibalization', detail: 'Splits', impressions: 40 },
  ],
  cannibalization: [
    {
      query: 'iso 37001',
      impressions: 90,
      pages: [
        { page: 'https://tsicertification.com/iso-37001-abms/', impressions: 60, position: 9, share: 0.667 },
        { page: 'https://tsicertification.com/blog/iso-37001/', impressions: 30, position: 14, share: 0.333 },
      ],
    },
  ],
  opportunities: [keyword({ query: 'haccp adalah', status: 'Opportunity', position: 15, opportunityScore: 71 })],
} as unknown as SeoKeywords;

const check = (overrides: Partial<HealthCheck>): HealthCheck => ({
  key: 'metadata',
  label: 'Missing Metadata',
  state: 'ok',
  count: 0,
  severity: 'Medium',
  note: '',
  issues: [],
  ...overrides,
});

const health: TechnicalHealth = {
  contentHost: 'tsicertification.com',
  crawledAt: '2026-09-15T04:57:00Z',
  pagesCrawled: 247,
  truncated: false,
  inspectedAt: null,
  pagespeedAt: null,
  indexed: null,
  checks: [
    check({
      key: 'brokenLinks',
      state: 'issues',
      count: 2,
      issues: [
        { url: 'https://tsicertification.com/artikel-iso/old/', note: 'Returns 404; Google still shows it in search' },
        { url: 'https://tsicertification.com/download/privacy-policy/', note: 'Returns 404; linked from https://tsicertification.com/privacy-policy/' },
      ],
    }),
    check({
      key: 'index',
      state: 'issues',
      count: 5,
      issues: ['/id/', '/id/appeal/', '/id/blog/', '/id/career/', '/id/event/'].map((path) => ({
        url: `https://tsicertification.com${path}`,
        note: 'Discovered - currently not indexed',
      })),
    }),
    check({ key: 'metadata', state: 'ok' }),
    check({ key: 'slowPages', state: 'not_checked' }),
  ],
};

describe('buildActionCandidates', () => {
  const candidates = buildActionCandidates(keywords, health);
  const byKey = Object.fromEntries(candidates.map((candidate) => [candidate.key, candidate]));

  it('turns keyword and page problems into tasks, leaving brand drops out', () => {
    expect(byKey['keyword-at-risk:iso 9001']).toMatchObject({
      priority: 'P1',
      action: 'Refresh /iso-9001-qms/ and link to it from related pages.',
      detail: 'Position 8.1 → 12.4, 120 impressions in 28 days',
    });
    expect(byKey['keyword-drop:iso 14001']).toMatchObject({ priority: 'P2', issue: 'Ranking decline' });
    expect(byKey['keyword-drop:tsi certification']).toBeUndefined();
    expect(byKey['low-ctr:https://tsicertification.com/company-profile/']).toMatchObject({ priority: 'P2' });
    expect(byKey['cannibalization:iso 37001'].detail).toBe('/iso-37001-abms/ 67%, /blog/iso-37001/ 33%');
    const acrossHosts = buildActionCandidates(
      {
        ...keywords,
        cannibalization: [
          {
            query: 'certification body indonesia',
            impressions: 60,
            pages: [
              { page: 'https://tsicertification.com/', impressions: 40, position: 4, share: 0.667 },
              { page: 'https://erp.tsicertification.com/', impressions: 20, position: 9, share: 0.333 },
            ],
          },
        ],
      },
      health,
    );
    expect(acrossHosts.find((candidate) => candidate.kind === 'cannibalization')?.detail).toBe(
      '/ 67%, erp.tsicertification.com 33%',
    );
    expect(byKey['opportunity:haccp adalah']).toMatchObject({ priority: 'P3' });
  });

  it('makes one task per broken page and one per other technical check with issues', () => {
    expect(byKey['broken:https://tsicertification.com/artikel-iso/old/'].action).toContain('Redirect it (301)');
    expect(byKey['broken:https://tsicertification.com/download/privacy-policy/'].action).toBe(
      'Fix or remove the link on the page that links here.',
    );
    expect(byKey['technical:index']).toMatchObject({
      priority: 'P2',
      issue: '5 pages not indexed by Google',
      target: 'tsicertification.com',
      detail: 'For example /id/, /id/appeal/, /id/blog/ and 2 more. The full list is in Technical SEO Health.',
    });
    expect(byKey['technical:metadata']).toBeUndefined();
    expect(byKey['technical:slowPages']).toBeUndefined();
  });
});

describe('planActionSync', () => {
  const now = new Date('2026-09-30T00:00:00Z');
  const candidate = (key: string): ActionCandidate => ({
    key,
    kind: 'low_ctr',
    priority: 'P2',
    issue: 'Low CTR',
    target: key,
    action: 'Rewrite',
    detail: 'detail',
  });
  const stored = (key: string, overrides: Partial<StoredAction> = {}): StoredAction => ({
    id: `id-${key}`,
    key,
    status: 'open',
    resolvedAt: null,
    resolvedBy: null,
    ...overrides,
  });

  it('creates new tasks, refreshes found ones and closes those no longer found', () => {
    const plan = planActionSync([stored('a'), stored('gone'), stored('old-done', { status: 'done', resolvedBy: 'system' })], [candidate('a'), candidate('new')], now);
    expect(plan.inserts.map((item) => item.key)).toEqual(['new']);
    expect(plan.updates).toEqual([{ id: 'id-a', candidate: candidate('a'), reopen: false }]);
    expect(plan.resolves).toEqual(['id-gone']);
  });

  it('reopens a system-closed task at once, but a person-closed one only after two weeks', () => {
    const plan = planActionSync(
      [
        stored('system', { status: 'done', resolvedBy: 'system', resolvedAt: new Date('2026-09-29T00:00:00Z') }),
        stored('recent', { status: 'done', resolvedBy: 'user', resolvedAt: new Date('2026-09-25T00:00:00Z') }),
        stored('stale', { status: 'done', resolvedBy: 'user', resolvedAt: new Date('2026-09-10T00:00:00Z') }),
      ],
      [candidate('system'), candidate('recent'), candidate('stale')],
      now,
    );
    expect(Object.fromEntries(plan.updates.map((update) => [update.candidate.key, update.reopen]))).toEqual({
      system: true,
      recent: false,
      stale: true,
    });
  });
});
