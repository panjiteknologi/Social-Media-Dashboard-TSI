import type { SeoCheck } from '../../shared/content';

const NAMED_ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** Visible text of an HTML fragment: tags dropped, common entities decoded, whitespace collapsed. */
export function htmlToText(html: string | null): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(#\d+|#x[\da-f]+|[a-z]+);/gi, (entity, code: string) => {
      if (code.startsWith('#')) {
        const point = /^#x/i.test(code) ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
        return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : entity;
      }
      return NAMED_ENTITIES[code.toLowerCase()] ?? entity;
    })
    .replace(/\s+/g, ' ')
    .trim();
}

export interface ChecklistInput {
  title: string;
  slug: string;
  contentHtml: string | null;
  featuredImageUrl: string | null;
  imageAltText: string | null;
  tags: string[];
  seoTitle: string | null;
  seoDescription: string | null;
  seoFocusKeyword: string | null;
}

/**
 * The CMS editor's SEO checklist (buildSeoChecklist in cms-tsicertification,
 * src/app/articles/actions.ts), repeated here so an article scores the same in
 * Content Machine as in the CMS. Change both together.
 */
export function seoChecklist(input: ChecklistInput): { checks: SeoCheck[]; score: number; wordCount: number } {
  const text = htmlToText(input.contentHtml);
  const lowerText = text.toLowerCase();
  const focus = (input.seoFocusKeyword ?? '').toLowerCase();
  const headings = input.contentHtml?.match(/<h[1-4][^>]*>/gi)?.length ?? 0;
  const wordCount = text ? text.split(' ').length : 0;
  const titleLength = input.seoTitle?.length ?? 0;
  const descriptionLength = input.seoDescription?.length ?? 0;

  const checks: SeoCheck[] = [
    {
      label: 'SEO title is 45-60 characters',
      passed: titleLength >= 45 && titleLength <= 60,
      note: `${titleLength} characters`,
    },
    {
      label: 'Meta description is 120-160 characters',
      passed: descriptionLength >= 120 && descriptionLength <= 160,
      note: `${descriptionLength} characters`,
    },
    {
      label: 'Focus keyword is set',
      passed: Boolean(input.seoFocusKeyword),
      note: input.seoFocusKeyword || 'Not set',
    },
    {
      label: 'Focus keyword appears in title',
      passed: Boolean(focus) && input.title.toLowerCase().includes(focus),
      note: focus ? 'Checked against article title' : 'No focus keyword',
    },
    {
      label: 'Focus keyword appears in opening content',
      passed: Boolean(focus) && lowerText.slice(0, 700).includes(focus),
      note: 'Checked in opening content',
    },
    {
      label: 'Slug is readable and under 80 characters',
      passed: input.slug.length > 0 && input.slug.length <= 80 && !/[A-Z\s]/.test(input.slug),
      note: `${input.slug.length} characters`,
    },
    {
      label: 'Article has at least 600 words',
      passed: wordCount >= 600,
      note: `${wordCount} words`,
    },
    {
      label: 'Article uses headings',
      passed: headings >= 2,
      note: `${headings} headings`,
    },
    {
      label: 'Cover image is set',
      passed: Boolean(input.featuredImageUrl),
      note: input.featuredImageUrl ? 'Cover image set' : 'Missing cover image',
    },
    {
      label: 'Image alt text is set',
      passed: Boolean(input.imageAltText),
      note: input.imageAltText ? 'Image alt set' : 'Missing image alt',
    },
    {
      label: 'Tags are set',
      passed: input.tags.length >= 3,
      note: `${input.tags.length} tags`,
    },
  ];

  const score = Math.round((checks.filter((check) => check.passed).length / checks.length) * 100);
  return { checks, score, wordCount };
}
