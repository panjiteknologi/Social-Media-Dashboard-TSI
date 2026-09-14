import { describe, expect, it } from 'vitest';
import { DEFAULT_SEO_SETTINGS, type KeywordRow, type SeoKeywords } from '../../shared/seo';
import { buildPriorityDigest, priorityKeywordChanges } from './digest';

const row = (overrides: Partial<KeywordRow>): KeywordRow => ({
  query: 'sertifikasi iso',
  cluster: 'Other',
  isBrand: false,
  clicks: 0,
  impressions: 48,
  ctr: 0,
  position: 21.2,
  previousImpressions: 40,
  previousPosition: 17.5,
  movement: -3.7,
  status: 'Dropping',
  opportunityScore: 81,
  landingPage: 'https://tsicertification.com/certification-process/',
  ...overrides,
});

const data = (keywords: KeywordRow[], comparable = true): SeoKeywords => ({
  dataThrough: '2026-09-12',
  window: { start: '2026-08-16', end: '2026-09-12', previousStart: '2026-07-19', previousEnd: '2026-08-15' },
  comparable,
  settings: DEFAULT_SEO_SETTINGS,
  queryCoverage: 0.58,
  counts: { top3: { current: 5, previous: 5 }, top10: { current: 18, previous: 17 } },
  keywords,
  movements: [],
  distribution: [],
  cannibalization: [],
  opportunities: [],
  attention: [],
});

describe('priorityKeywordChanges', () => {
  it('reports dropped priority keywords worst first, matching case-insensitively', () => {
    const result = priorityKeywordChanges(
      data([
        row({ query: 'sertifikasi iso', movement: -3.7 }),
        row({ query: 'tsi group', movement: -13, status: 'Dropping' }),
        row({ query: 'logo tsi', movement: 7, status: 'Rising' }),
      ]),
      ['Sertifikasi ISO', 'tsi group', 'logo tsi', 'iso 9001 indonesia'],
    );
    expect(result.dropped.map((keyword) => keyword.query)).toEqual(['tsi group', 'sertifikasi iso']);
    expect(result.missing).toEqual(['iso 9001 indonesia']);
  });
});

describe('buildPriorityDigest', () => {
  it('lists each dropped keyword with its change and page', () => {
    const message = buildPriorityDigest(
      data([row({}), row({ query: 'iso 22301', position: 11.4, previousPosition: 8.9, status: 'At Risk', landingPage: null })]),
      ['sertifikasi iso', 'iso 22301', 'iso 9001 indonesia'],
      'https://cm.tsicertification.com/',
    );
    expect(message).toContain('Weekly SEO check: 2 priority keywords dropped');
    expect(message).toContain('16 Aug 2026 – 12 Sep 2026');
    expect(message).toContain('• sertifikasi iso: position 17.5 → 21.2 (48 impressions)');
    expect(message).toContain('• iso 22301: position 8.9 → 11.4, left page 1');
    expect(message).toContain('No search data this period for: iso 9001 indonesia');
    expect(message).toContain('Details: https://cm.tsicertification.com/seo');
  });

  it('sends nothing when no priority keyword dropped', () => {
    expect(buildPriorityDigest(data([row({ status: 'Stable', movement: 0.5 })]), ['sertifikasi iso'], 'http://x')).toBeNull();
  });

  it('sends nothing when the previous window cannot be compared', () => {
    expect(buildPriorityDigest(data([row({})], false), ['sertifikasi iso'], 'http://x')).toBeNull();
  });
});
