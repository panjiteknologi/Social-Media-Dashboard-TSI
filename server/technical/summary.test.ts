import { describe, expect, it } from 'vitest';
import { summarizeHealth, type CrawlPageRow } from './summary';

const page = (url: string, overrides: Partial<CrawlPageRow> = {}): CrawlPageRow => ({
  url,
  sources: ['sitemap'],
  status: 200,
  contentType: 'text/html',
  title: `Title of ${url}`,
  description: 'A description',
  canonical: url,
  noindex: false,
  imagesMissingAlt: 0,
  jsonLd: ['WebSite'],
  linkedFrom: [],
  error: null,
  ...overrides,
});

const base = {
  contentHost: 'tsicertification.com',
  crawledAt: new Date('2026-09-13T19:00:00Z'),
  truncated: false,
  inspections: [],
  speeds: [],
  pagespeedConfigured: false,
};

const check = (health: ReturnType<typeof summarizeHealth>, key: string) => health.checks.find((item) => item.key === key)!;

describe('summarizeHealth', () => {
  it('reports every check as not checked before the first crawl', () => {
    const health = summarizeHealth({ ...base, crawledAt: null, pages: [] });
    expect(health.checks.every((item) => item.state === 'not_checked')).toBe(true);
    expect(check(health, 'slowPages').note).toBe('Needs PAGESPEED_API_KEY in .env.');
    expect(health.indexed).toBeNull();
  });

  it('finds broken pages, listing those Google still shows first', () => {
    const health = summarizeHealth({
      ...base,
      pages: [
        page('https://tsicertification.com/'),
        page('https://tsicertification.com/missing/', { status: 404, sources: ['link'], linkedFrom: ['https://tsicertification.com/'], contentType: null }),
        page('https://tsicertification.com/artikel-iso/old/', { status: 404, sources: ['search'], contentType: null }),
      ],
    });
    const broken = check(health, 'brokenLinks');
    expect(broken).toMatchObject({ state: 'issues', count: 2 });
    expect(broken.issues.map((issue) => issue.note)).toEqual([
      'Returns 404; Google still shows it in search',
      'Returns 404; linked from https://tsicertification.com/',
    ]);
  });

  it('checks metadata, duplicate titles, alt text, canonicals and schema on HTML pages only', () => {
    const health = summarizeHealth({
      ...base,
      pages: [
        page('https://tsicertification.com/a/', { title: 'Same', description: null, imagesMissingAlt: 2 }),
        page('https://tsicertification.com/b/', { title: 'same ', canonical: 'https://tsicertification.com/a/', jsonLd: [] }),
        page('https://tsicertification.com/file.pdf', { contentType: 'application/pdf', title: null, jsonLd: [] }),
      ],
    });
    expect(check(health, 'metadata')).toMatchObject({ count: 1, issues: [{ note: 'No meta description' }] });
    expect(check(health, 'duplicateTitles').count).toBe(2);
    expect(check(health, 'altText').issues).toEqual([{ url: 'https://tsicertification.com/a/', note: '2 images without alt text' }]);
    expect(check(health, 'canonical').issues).toEqual([
      { url: 'https://tsicertification.com/b/', note: 'Canonical points to https://tsicertification.com/a/' },
    ]);
    expect(check(health, 'schema')).toMatchObject({ count: 1, issues: [{ note: 'No structured data' }] });
  });

  it('counts indexed pages and slow pages when those checks have run', () => {
    const home = 'https://tsicertification.com/';
    const blog = 'https://tsicertification.com/blog/';
    const health = summarizeHealth({
      ...base,
      pages: [page(home), page(blog)],
      inspections: [
        { url: home, verdict: 'PASS', coverageState: 'Submitted and indexed', googleCanonical: home, userCanonical: home, inspectedAt: new Date() },
        { url: blog, verdict: 'NEUTRAL', coverageState: 'Crawled - currently not indexed', googleCanonical: null, userCanonical: null, inspectedAt: new Date() },
      ],
      speeds: [
        { url: blog, score: 0.66, lcpMs: 6000, fieldCategory: 'SLOW', checkedAt: new Date() },
        { url: home, score: 0.42, lcpMs: 5300, fieldCategory: null, checkedAt: new Date() },
        { url: 'https://tsicertification.com/career/', score: 0.9, lcpMs: 1800, fieldCategory: 'FAST', checkedAt: new Date() },
      ],
    });
    expect(health.indexed).toEqual({ indexed: 1, inspected: 2 });
    expect(check(health, 'index').issues).toEqual([{ url: blog, note: 'Crawled - currently not indexed' }]);
    // A fair lab score still counts as slow when real visitors find the page slow.
    expect(check(health, 'slowPages').issues).toEqual([
      { url: home, note: 'Mobile performance score 42, largest content shows after 5.3 s' },
      { url: blog, note: 'Mobile performance score 66, largest content shows after 6.0 s, real visitors find it slow' },
    ]);
  });
});
