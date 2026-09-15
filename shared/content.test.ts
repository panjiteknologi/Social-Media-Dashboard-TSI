import { describe, expect, it } from 'vitest';
import { articleStatus, articleUrl, countPublished, slugFromPage } from './content';

const host = 'tsicertification.com';

describe('slugFromPage', () => {
  it('reads the slug from article URLs with or without a trailing slash', () => {
    expect(slugFromPage('https://tsicertification.com/blog/monitoring-haccp/', host)).toBe('monitoring-haccp');
    expect(slugFromPage('https://tsicertification.com/blog/monitoring-haccp', host)).toBe('monitoring-haccp');
  });

  it('maps the old /artikel-iso/ path and GA4 landing paths to the same article', () => {
    expect(slugFromPage('https://tsicertification.com/artikel-iso/monitoring-haccp/', host)).toBe('monitoring-haccp');
    expect(slugFromPage('/blog/monitoring-haccp', host)).toBe('monitoring-haccp');
  });

  it('ignores listing pages, other pages, other hosts and GA4 placeholders', () => {
    expect(slugFromPage('https://tsicertification.com/blog/?page=3', host)).toBeNull();
    expect(slugFromPage('https://tsicertification.com/contact-us/', host)).toBeNull();
    expect(slugFromPage('https://erp.tsicertification.com/blog/monitoring-haccp/', host)).toBeNull();
    expect(slugFromPage('(not set)', host)).toBeNull();
    expect(slugFromPage('', host)).toBeNull();
  });
});

describe('articleStatus', () => {
  it('translates the CMS status', () => {
    expect(articleStatus('publish')).toBe('Published');
    expect(articleStatus('scheduling')).toBe('Scheduled');
    expect(articleStatus('draft')).toBe('Draft');
  });
});

describe('countPublished', () => {
  const articles = [
    { status: 'Published', publishedAt: '2026-09-15' },
    { status: 'Published', publishedAt: '2026-08-17' },
    { status: 'Published', publishedAt: '2026-08-16' },
    { status: 'Published', publishedAt: null },
    { status: 'Draft', publishedAt: '2026-09-10' },
  ] as const;

  it('counts every published article for All, without a comparison', () => {
    expect(countPublished(articles, '2026-09-15', 'All')).toEqual({ current: 4, previous: null, period: null, days: null });
  });

  it('counts the last 30 days including today and compares with the 30 days before', () => {
    expect(countPublished(articles, '2026-09-15', '30D')).toEqual({
      current: 2,
      previous: 1,
      period: { start: '2026-08-17', end: '2026-09-15' },
      days: 30,
    });
  });
});

describe('articleUrl', () => {
  it('builds the canonical blog URL', () => {
    expect(articleUrl(host, 'monitoring-haccp')).toBe('https://tsicertification.com/blog/monitoring-haccp/');
  });
});
