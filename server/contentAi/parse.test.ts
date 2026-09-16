import { describe, expect, it } from 'vitest';
import {
  AiReplyError,
  extractJson,
  parseBrief,
  parseDraft,
  parseReview,
  parseTopics,
  sanitizeArticleHtml,
  toSlug,
} from './parse';

describe('extractJson', () => {
  it('reads JSON inside a code fence or surrounded by text', () => {
    expect(extractJson('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
    expect(extractJson('Here it is: {"a": {"b": 2}} Hope that helps.')).toEqual({ a: { b: 2 } });
  });

  it('fails clearly without JSON', () => {
    expect(() => extractJson('No JSON here')).toThrow(AiReplyError);
    expect(() => extractJson('{"a": ')).toThrow('The AI reply held no JSON object.');
  });
});

describe('parseTopics', () => {
  it('keeps valid topics, fills safe defaults, and drops broken ones', () => {
    const topics = parseTopics(
      JSON.stringify({
        topics: [
          { keyword: 'iso 9001 adalah', title: 'Apa Itu ISO 9001', intent: 'informational', action: 'new_article', angle: 'Dasar', reason: 'Posisi 18' },
          { keyword: 'haccp', title: 'HACCP', intent: 'weird', action: 'something' },
          { title: 'No keyword' },
        ],
      }),
    );
    expect(topics).toHaveLength(2);
    expect(topics[1]).toMatchObject({ intent: 'informational', action: 'new_article', existingUrl: null, angle: '' });
  });

  it('refuses a reply without a topics list', () => {
    expect(() => parseTopics('{"ideas": []}')).toThrow('The AI reply had no topics list.');
  });
});

describe('parseBrief', () => {
  const reply = {
    workingTitle: 'Checklist Audit ISO 9001',
    focusKeyword: 'checklist audit iso 9001',
    searchIntent: 'informational',
    targetReader: 'Manajer mutu',
    angle: 'Praktis',
    outline: [
      { heading: 'Mengenal audit', points: ['Definisi'] },
      { heading: 'Kesimpulan', points: [] },
    ],
    mustCover: ['Klausul 9.2'],
    internalLinks: [
      { url: 'https://tsicertification.com/blog/real/', title: 'x', reason: 'Related' },
      { url: 'https://tsicertification.com/blog/invented/', title: 'Invented', reason: 'Made up' },
    ],
    faq: ['Berapa lama audit?'],
    cta: 'Hubungi tim kami',
    impartialityNotes: ['Jangan menjanjikan kelulusan'],
  };

  it('keeps only internal links to real articles, with their real titles, and the word target from Settings', () => {
    const brief = parseBrief(JSON.stringify(reply), {
      knownUrls: new Map([['https://tsicertification.com/blog/real/', 'Real Article']]),
      wordTarget: { min: 800, max: 1500 },
    });
    expect(brief.internalLinks).toEqual([
      { url: 'https://tsicertification.com/blog/real/', title: 'Real Article', reason: 'Related' },
    ]);
    expect(brief.wordTarget).toEqual({ min: 800, max: 1500 });
  });

  it('refuses an outline with fewer than two sections', () => {
    expect(() =>
      parseBrief(JSON.stringify({ ...reply, outline: [{ heading: 'Only', points: [] }] }), {
        knownUrls: new Map(),
        wordTarget: { min: 800, max: 1500 },
      }),
    ).toThrow('The brief was incomplete');
  });
});

describe('parseDraft', () => {
  const meta = {
    title: 'Checklist Audit ISO 9001',
    seoTitle: 'Checklist Audit ISO 9001: Panduan Lengkap untuk Organisasi',
    metaDescription: 'Pelajari checklist audit ISO 9001.',
    slug: 'Checklist Audit ISO 9001!',
    excerpt: 'Ringkasan',
    focusKeyword: 'checklist audit iso 9001',
    tags: ['ISO 9001', 'Audit'],
  };

  it('reads the details and the article, cleaning the slug and the HTML', () => {
    const text = `\`\`\`json\n${JSON.stringify(meta)}\n\`\`\`\n\n\`\`\`html\n<h1>Judul</h1><p onclick="x()">Satu dua tiga</p><script>alert(1)</script>\n\`\`\``;
    const draft = parseDraft(text);
    expect(draft.slug).toBe('checklist-audit-iso-9001');
    expect(draft.html).toBe('<h2>Judul</h2><p>Satu dua tiga</p>');
    expect(draft.wordCount).toBe(4);
  });

  it('fails when the article is missing', () => {
    expect(() => parseDraft(`\`\`\`json\n${JSON.stringify(meta)}\n\`\`\``)).toThrow('The draft reply held no article HTML.');
  });
});

describe('sanitizeArticleHtml and toSlug', () => {
  it('neutralises javascript links and embeds', () => {
    expect(sanitizeArticleHtml('<a href="javascript:alert(1)">x</a><iframe src="y"></iframe>')).toBe('<a href="#">x</a>');
  });

  it('builds CMS slugs', () => {
    expect(toSlug('Penerapan HACCP di Dapur MBG — Panduan')).toBe('penerapan-haccp-di-dapur-mbg-panduan');
  });
});

describe('parseReview', () => {
  it('clamps the score and treats an unclear impartiality verdict as a failure', () => {
    const review = parseReview(
      JSON.stringify({ brandScore: 140, impartiality: 'unclear', summary: 'Ok', issues: [{ severity: 'high', problem: 'Promise' }, { nope: 1 }] }),
      'anthropic/claude-opus-5',
    );
    expect(review).toMatchObject({ brandScore: 100, impartiality: 'fail', model: 'anthropic/claude-opus-5' });
    expect(review.issues).toEqual([{ severity: 'high', category: 'other', quote: '', problem: 'Promise', fix: '' }]);
  });
});
