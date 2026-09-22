import { describe, expect, it } from 'vitest';
import { DuplicateArticleError, findDuplicate, keywordCovered, normalizeText } from './duplicates';

const articles = [
  {
    id: 176,
    title: 'Sertifikasi ISO: Pengertian, Jenis Standar, dan Tahapan Prosesnya',
    slug: 'sertifikasi-iso-pengertian-jenis-standar-dan-tahapan-prosesnya',
    focusKeyword: 'sertifikasi iso',
    status: 'publish',
  },
  {
    id: 170,
    title: 'Monitoring HACCP: Langkah Krusial Keamanan Pangan',
    slug: 'monitoring-haccp-langkah-krusial-keamanan-pangan',
    focusKeyword: 'Monitoring HACCP',
    status: 'publish',
  },
];

describe('normalizeText', () => {
  it('keeps words only', () => {
    expect(normalizeText('Sertifikasi ISO: Pengertian, Jenis!')).toBe('sertifikasi iso pengertian jenis');
  });
});

describe('keywordCovered', () => {
  it('finds the article that already targets the keyword', () => {
    expect(keywordCovered(articles, 'Sertifikasi ISO')?.id).toBe(176);
    expect(keywordCovered(articles, 'monitoring haccp')?.id).toBe(170);
  });

  it('counts a title that opens with the keyword', () => {
    const covered = keywordCovered([{ title: 'Audit ISO 9001 dan Persiapannya' }], 'audit iso 9001');
    expect(covered?.title).toBe('Audit ISO 9001 dan Persiapannya');
  });

  it('leaves a more specific keyword open', () => {
    expect(keywordCovered(articles, 'sertifikasi iso 9001 untuk fintech')).toBeNull();
    expect(keywordCovered(articles, 'biaya sertifikasi iso')).toBeNull();
    expect(keywordCovered(articles, '')).toBeNull();
  });
});

describe('findDuplicate', () => {
  const target = {
    title: 'Sertifikasi ISO: Pengertian, Jenis Standar, dan Tahapan Prosesnya',
    slug: 'sertifikasi-iso-pengertian-jenis-standar-dan-tahapan-proses',
    ownPostId: null,
  };

  it('catches the same title even when the slug differs by a word', () => {
    expect(findDuplicate(articles, target)?.id).toBe(176);
  });

  it('catches the same slug under a different title', () => {
    expect(findDuplicate(articles, { title: 'Judul lain', slug: 'monitoring-haccp-langkah-krusial-keamanan-pangan', ownPostId: null })?.id).toBe(170);
  });

  it('does not count the row this content already owns', () => {
    expect(findDuplicate(articles, { ...target, ownPostId: 176 })).toBeNull();
  });

  it('lets a genuinely new article through', () => {
    expect(findDuplicate(articles, { title: 'Checklist Audit ISO 45001', slug: 'checklist-audit-iso-45001', ownPostId: null })).toBeNull();
  });
});

describe('DuplicateArticleError', () => {
  it('names the article that is in the way', () => {
    const error = new DuplicateArticleError(articles[0]);
    expect(error.message).toContain('"Sertifikasi ISO: Pengertian, Jenis Standar, dan Tahapan Prosesnya"');
    expect(error.message).toContain('publish, /blog/sertifikasi-iso-pengertian-jenis-standar-dan-tahapan-prosesnya/');
    expect(error.message).toContain('send this anyway');
  });
});
