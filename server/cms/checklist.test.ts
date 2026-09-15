import { describe, expect, it } from 'vitest';
import { htmlToText, seoChecklist, type ChecklistInput } from './checklist';

describe('htmlToText', () => {
  it('drops tags, scripts and styles, decodes entities and collapses whitespace', () => {
    const html = '<h2>ISO&nbsp;9001 &amp; ISO 14001</h2>\n<style>p{}</style><p>Biaya &#8211; <b>jelas</b></p><script>x()</script>';
    expect(htmlToText(html)).toBe('ISO 9001 & ISO 14001 Biaya – jelas');
  });

  it('returns an empty string for missing content', () => {
    expect(htmlToText(null)).toBe('');
  });
});

describe('seoChecklist', () => {
  const words = Array.from({ length: 600 }, () => 'kata').join(' ');
  const complete: ChecklistInput = {
    title: 'Panduan ISO 9001 untuk Perusahaan',
    slug: 'panduan-iso-9001',
    contentHtml: `<p>ISO 9001 adalah standar mutu.</p><h2>Manfaat</h2><p>${words}</p><h2>Proses</h2>`,
    featuredImageUrl: 'https://example.com/cover.jpg',
    imageAltText: 'Sertifikat ISO 9001',
    tags: ['iso 9001', 'mutu', 'sertifikasi'],
    seoTitle: 'Panduan ISO 9001 untuk Perusahaan di Indonesia 2026',
    seoDescription: 'x'.repeat(130),
    seoFocusKeyword: 'ISO 9001',
  };

  it('scores 100 when every check passes', () => {
    const result = seoChecklist(complete);
    expect(result.checks.filter((check) => !check.passed)).toEqual([]);
    expect(result.score).toBe(100);
    expect(result.wordCount).toBe(607);
  });

  it('fails the keyword checks when no focus keyword is set', () => {
    const result = seoChecklist({ ...complete, seoFocusKeyword: null });
    const failed = result.checks.filter((check) => !check.passed).map((check) => check.label);
    expect(failed).toEqual([
      'Focus keyword is set',
      'Focus keyword appears in title',
      'Focus keyword appears in opening content',
    ]);
    expect(result.score).toBe(73);
  });

  it('checks title and description lengths as the CMS does', () => {
    const result = seoChecklist({ ...complete, seoTitle: 'Too short', seoDescription: null });
    expect(result.checks[0]).toEqual({ label: 'SEO title is 45-60 characters', passed: false, note: '9 characters' });
    expect(result.checks[1]).toMatchObject({ passed: false, note: '0 characters' });
  });
});
