import { describe, expect, it } from 'vitest';
import { qaVerdict, type QaResult } from '../../shared/aiContent';
import { draftSeoChecks, findFlaggedPhrases, wrongLanguageLinks } from './checks';

const HOST = 'tsicertification.com';

describe('findFlaggedPhrases', () => {
  it('flags promised outcomes, superlatives and WhatsApp links with the words around them', () => {
    const flagged = findFlaggedPhrases(
      '<p>Dengan kami, sertifikat Anda dijamin terbit. Kami lembaga terbaik.</p><a href="https://wa.me/62811">Chat</a>',
    );
    expect(flagged.map((entry) => entry.phrase)).toEqual(['dijamin', 'terbaik', 'wa.me/']);
    expect(flagged[0].context).toContain('sertifikat Anda dijamin terbit');
  });

  it('leaves ordinary wording alone', () => {
    expect(findFlaggedPhrases('<p>Praktik terbaik HACCP membantu menunjukkan komitmen keamanan pangan.</p>')).toEqual([]);
  });
});

describe('wrongLanguageLinks', () => {
  const html = [
    '<a href="https://tsicertification.com/id/contact-us/">kontak</a>',
    '<a href="https://tsicertification.com/iso-certification-process/">proses</a>',
    '<a href="https://tsicertification.com/blog/monitoring-haccp-langkah-krusial-keamanan-pangan/">artikel</a>',
    '<a href="https://tsicertification.com/id/blog/monitoring-haccp-langkah-krusial-keamanan-pangan/">artikel id</a>',
    '<a href="/id/iso-9001-qms/">layanan</a>',
    '<a href="https://www.iso.org/standard.html">ISO</a>',
  ].join('');

  it('flags English pages and /id/blog links in an Indonesian article', () => {
    expect(wrongLanguageLinks(html, { host: HOST, language: 'id' })).toEqual([
      'https://tsicertification.com/iso-certification-process/',
      'https://tsicertification.com/id/blog/monitoring-haccp-langkah-krusial-keamanan-pangan/',
    ]);
  });

  it('flags /id/ pages in an English article and leaves other sites alone', () => {
    expect(wrongLanguageLinks(html, { host: HOST, language: 'en' })).toEqual([
      'https://tsicertification.com/id/contact-us/',
      'https://tsicertification.com/id/blog/monitoring-haccp-langkah-krusial-keamanan-pangan/',
      '/id/iso-9001-qms/',
    ]);
  });
});

describe('draftSeoChecks', () => {
  const words = (count: number) => Array.from({ length: count }, () => 'kata').join(' ');
  const draft = {
    title: 'Checklist Audit ISO 9001 untuk Organisasi',
    slug: 'checklist-audit-iso-9001',
    html: `<p>checklist audit iso 9001 ${words(900)}</p><h2>A</h2><h2>B</h2>`,
    tags: ['ISO 9001', 'Audit', 'Mutu'],
    seoTitle: 'Checklist Audit ISO 9001: Panduan untuk Tim Mutu Anda',
    metaDescription: 'Checklist audit ISO 9001 membantu tim mutu menyiapkan audit internal dan audit sertifikasi dengan runtut, dari dokumen sampai tindak lanjut.',
    focusKeyword: 'checklist audit iso 9001',
    wordCount: 904,
  };

  it('leaves out the image checks the CMS handles and adds the word range', () => {
    const result = draftSeoChecks(draft, { minWords: 800, maxWords: 1500, language: 'id' }, HOST);
    expect(result.checks.map((check) => check.label)).not.toContain('Cover image is set');
    expect(result.checks).toContainEqual({ label: 'Length is 800–1500 words', passed: true, note: '904 words' });
    expect(result.checks).toContainEqual({
      label: 'Links stay on the Indonesian pages',
      passed: true,
      note: 'Every website link matches the article language',
    });
    expect(result.score).toBe(100);
  });

  it('fails the word range when the draft is short', () => {
    const result = draftSeoChecks({ ...draft, wordCount: 500 }, { minWords: 800, maxWords: 1500, language: 'id' }, HOST);
    expect(result.checks.find((check) => check.label.startsWith('Length'))?.passed).toBe(false);
    expect(result.score).toBeLessThan(100);
  });

  it('fails when an Indonesian draft links to an English page', () => {
    const html = `${draft.html}<a href="https://tsicertification.com/iso-certification-process/">proses</a>`;
    const result = draftSeoChecks({ ...draft, html }, { minWords: 800, maxWords: 1500, language: 'id' }, HOST);
    const links = result.checks.find((check) => check.label.startsWith('Links'));
    expect(links?.passed).toBe(false);
    expect(links?.note).toBe('https://tsicertification.com/iso-certification-process/');
  });
});

describe('qaVerdict', () => {
  const base: QaResult = {
    checkedAt: '2026-09-16T00:00:00Z',
    seo: { score: 90, checks: [] },
    flaggedPhrases: [],
    review: { model: 'm', brandScore: 90, impartiality: 'pass', summary: 'Good', issues: [] },
    reviewNote: null,
  };

  it('passes a clean draft, asks for attention on smaller problems, and fails on impartiality', () => {
    expect(qaVerdict(base)).toBe('pass');
    expect(qaVerdict({ ...base, flaggedPhrases: [{ phrase: 'terbaik', rule: 'r', context: 'c' }] })).toBe('attention');
    expect(qaVerdict({ ...base, review: null, reviewNote: 'No key' })).toBe('attention');
    expect(qaVerdict({ ...base, review: { ...base.review!, impartiality: 'fail' } })).toBe('fail');
    expect(
      qaVerdict({ ...base, review: { ...base.review!, issues: [{ severity: 'high', category: 'cta', quote: '', problem: 'p', fix: '' }] } }),
    ).toBe('fail');
  });
});
