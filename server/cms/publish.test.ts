import { describe, expect, it } from 'vitest';
import type { ArticleDraft } from '../../shared/aiContent';
import { articleUrl, buildCmsPayload, freeSlug } from './publish';
import { writerSetupSql } from './writeAccess';

const draft: ArticleDraft = {
  title: 'Sertifikasi ISO: Pengertian dan Tahapannya',
  seoTitle: 'Sertifikasi ISO: Pengertian, Jenis, dan Tahapannya',
  metaDescription: 'Pahami sertifikasi ISO sebagai penilaian pihak ketiga.',
  slug: 'Sertifikasi ISO: Pengertian!',
  excerpt: '  Ringkasan singkat.  ',
  focusKeyword: 'sertifikasi iso',
  tags: ['Sertifikasi ISO', 'Audit'],
  html: '<p>Isi</p>',
  wordCount: 1428,
  model: 'anthropic/claude-opus-5',
  writtenAt: '2026-09-16T01:00:00Z',
};

describe('buildCmsPayload', () => {
  it('maps the draft onto the CMS fields, as a draft in the articles category', () => {
    expect(buildCmsPayload(draft)).toEqual({
      title: draft.title,
      slug: 'sertifikasi-iso-pengertian',
      excerpt: 'Ringkasan singkat.',
      contentHtml: '<p>Isi</p>',
      status: 'draft',
      categories: ['Artikel ISO'],
      tags: ['Sertifikasi ISO', 'Audit'],
      readingTimeMinutes: 7,
      seoTitle: draft.seoTitle,
      seoDescription: draft.metaDescription,
      seoFocusKeyword: 'sertifikasi iso',
    });
  });

  it('never reports less than a minute, and drops an empty excerpt', () => {
    const short = buildCmsPayload({ ...draft, wordCount: 40, excerpt: '   ' });
    expect(short.readingTimeMinutes).toBe(1);
    expect(short.excerpt).toBeNull();
  });
});

describe('freeSlug', () => {
  const held = (slugs: Record<string, number>) => async (slug: string) => slugs[slug] ?? null;

  it('keeps the wanted slug when it is free', async () => {
    expect(await freeSlug(held({}), 'panduan-iso', null)).toBe('panduan-iso');
  });

  it('keeps its own slug when the holder is this content', async () => {
    expect(await freeSlug(held({ 'panduan-iso': 12 }), 'panduan-iso', 12)).toBe('panduan-iso');
  });

  it("does not take over somebody else's slug", async () => {
    expect(await freeSlug(held({ 'panduan-iso': 99, 'panduan-iso-2': 98 }), 'panduan-iso', 12)).toBe('panduan-iso-3');
  });

  it('gives up rather than guessing forever', async () => {
    const everything = async () => 99;
    await expect(freeSlug(everything, 'panduan-iso', null)).rejects.toThrow('Every slug');
  });
});

describe('articleUrl', () => {
  it('points at the website article', () => {
    expect(articleUrl('tsicertification.com', 'panduan-iso')).toBe('https://tsicertification.com/blog/panduan-iso/');
  });
});

describe('writerSetupSql', () => {
  it('grants writing on articles only, and no DELETE anywhere', () => {
    const sql = writerSetupSql('A'.repeat(32));
    expect(sql).toContain('GRANT INSERT (wordpress_id, title, slug');
    expect(sql).toContain('ON public.blog_posts TO content_machine_writer;');
    expect(sql).toContain('GRANT USAGE ON SEQUENCE public.blog_posts_id_seq');
    // The word DELETE appears in the explanation on top; what matters is that nothing grants it.
    expect(sql).not.toMatch(/GRANT[^;]*DELETE/i);
    expect(sql).not.toMatch(/GRANT[^;]*cms_contact_messages/i);
  });

  it('refuses a weak password', () => {
    expect(() => writerSetupSql('short')).toThrow('at least 24 letters and digits');
  });
});
