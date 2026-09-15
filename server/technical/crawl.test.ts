import { describe, expect, it } from 'vitest';
import { crawlSite } from './crawl';

const html = (body: string) =>
  new Response(`<html><head><title>Page</title></head><body>${body}</body></html>`, {
    status: 200,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

const SITE: Record<string, () => Response> = {
  'https://tsicertification.com/': () => html('<a href="/blog/">Blog</a><a href="/old/">Old</a><a href="https://other.com/">x</a>'),
  'https://tsicertification.com/blog/': () => html('<a href="/missing/">Missing</a><a href="/">Home</a>'),
  'https://tsicertification.com/old/': () => new Response(null, { status: 301, headers: { location: '/blog/' } }),
  'https://tsicertification.com/missing/': () => new Response('Not found', { status: 404 }),
};

const fetchImpl = (async (input: string | URL | Request) => {
  const url = String(input);
  return SITE[url]?.() ?? new Response('Not found', { status: 404 });
}) as typeof fetch;

describe('crawlSite', () => {
  it('follows internal links, records redirects and broken pages with their referrers', async () => {
    const { pages, truncated } = await crawlSite({
      host: 'tsicertification.com',
      seeds: [{ url: 'https://tsicertification.com/', source: 'home' }],
      maxPages: 50,
      userAgent: 'test',
      delayMs: 0,
      fetchImpl,
    });

    expect(truncated).toBe(false);
    const byUrl = Object.fromEntries(pages.map((page) => [page.url, page]));
    expect(Object.keys(byUrl)).toEqual([
      'https://tsicertification.com/',
      'https://tsicertification.com/blog/',
      'https://tsicertification.com/old/',
      'https://tsicertification.com/missing/',
    ]);
    expect(byUrl['https://tsicertification.com/'].linkedFrom).toEqual(['https://tsicertification.com/blog/']);
    expect(byUrl['https://tsicertification.com/old/']).toMatchObject({ status: 301, redirectTo: 'https://tsicertification.com/blog/' });
    expect(byUrl['https://tsicertification.com/missing/']).toMatchObject({
      status: 404,
      signals: null,
      sources: ['link'],
      linkedFrom: ['https://tsicertification.com/blog/'],
    });
    expect(byUrl['https://tsicertification.com/blog/'].signals?.title).toBe('Page');
  });

  it('stops at the page limit and says so', async () => {
    const { pages, truncated } = await crawlSite({
      host: 'tsicertification.com',
      seeds: [{ url: 'https://tsicertification.com/', source: 'home' }],
      maxPages: 2,
      userAgent: 'test',
      delayMs: 0,
      fetchImpl,
    });
    expect(pages).toHaveLength(2);
    expect(truncated).toBe(true);
  });

  it('records a request that failed outright', async () => {
    const failing = (async () => {
      throw new Error('ECONNRESET');
    }) as typeof fetch;
    const { pages } = await crawlSite({
      host: 'tsicertification.com',
      seeds: [{ url: 'https://tsicertification.com/', source: 'sitemap' }],
      maxPages: 5,
      userAgent: 'test',
      delayMs: 0,
      fetchImpl: failing,
    });
    expect(pages[0]).toMatchObject({ status: 0, error: 'ECONNRESET' });
  });
});
