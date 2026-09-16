import { describe, expect, it } from 'vitest';
import { buildBrandContext } from './context';
import { DEFAULT_BRAND_KNOWLEDGE } from './defaults';
import { BrandKnowledgeSchema } from './settings';

describe('DEFAULT_BRAND_KNOWLEDGE', () => {
  it('is valid, and ships the impartiality rules as a draft', () => {
    expect(BrandKnowledgeSchema.safeParse(DEFAULT_BRAND_KNOWLEDGE).success).toBe(true);
    expect(DEFAULT_BRAND_KNOWLEDGE.impartialityStatus).toBe('draft');
    expect(DEFAULT_BRAND_KNOWLEDGE.exampleArticles.length).toBeGreaterThanOrEqual(5);
  });
});

describe('BrandKnowledgeSchema', () => {
  it('rejects a minimum word count above the maximum', () => {
    const invalid = { ...DEFAULT_BRAND_KNOWLEDGE, ai: { ...DEFAULT_BRAND_KNOWLEDGE.ai, minWords: 2000, maxWords: 1000 } };
    expect(BrandKnowledgeSchema.safeParse(invalid).success).toBe(false);
  });

  it('requires who approved the impartiality rules and when', () => {
    const approvedWithoutName = { ...DEFAULT_BRAND_KNOWLEDGE, impartialityStatus: 'approved' as const };
    expect(BrandKnowledgeSchema.safeParse(approvedWithoutName).success).toBe(false);
    expect(
      BrandKnowledgeSchema.safeParse({
        ...approvedWithoutName,
        impartialityApprovedBy: 'Compliance Manager',
        impartialityApprovedOn: '2026-09-20',
      }).success,
    ).toBe(true);
  });

  it('rejects an example article without a full URL', () => {
    const invalid = { ...DEFAULT_BRAND_KNOWLEDGE, exampleArticles: [{ url: '/blog/x/', title: 'X', reason: '' }] };
    expect(BrandKnowledgeSchema.safeParse(invalid).success).toBe(false);
  });
});

describe('buildBrandContext', () => {
  const context = buildBrandContext(DEFAULT_BRAND_KNOWLEDGE);

  it('puts the impartiality rules first and marks a draft as binding', () => {
    expect(context.indexOf('## Impartiality rules')).toBeLessThan(context.indexOf('## Company profile'));
    expect(context).toContain('a draft awaiting compliance approval, binding all the same');
  });

  it('includes the article settings and the examples', () => {
    expect(context).toContain('- Language: Indonesian.');
    expect(context).toContain('- Length: 800–1500 words.');
    expect(context).toContain('https://tsicertification.com/blog/monitoring-haccp-langkah-krusial-keamanan-pangan/');
  });

  it('names who approved the rules once they are approved', () => {
    const approved = buildBrandContext({
      ...DEFAULT_BRAND_KNOWLEDGE,
      impartialityStatus: 'approved',
      impartialityApprovedBy: 'Compliance Manager',
      impartialityApprovedOn: '2026-09-20',
    });
    expect(approved).toContain('## Impartiality rules (approved by Compliance Manager on 2026-09-20)');
  });
});
