import type { ArticleDraft, FlaggedPhrase } from '../../shared/aiContent';
import type { ArticleAiSettings, ArticleLanguage } from '../../shared/brand';
import type { SeoCheck } from '../../shared/content';
import { htmlToText, seoChecklist } from '../cms/checklist';

const RULES = {
  outcome: 'Never promise a certification outcome (impartiality rule 2)',
  superlative: 'No unproven superlatives (tone of voice)',
  consulting: 'TSI does not offer consulting (impartiality rule 1)',
  discount: 'No discounts tied to certification (impartiality rule 8)',
  contact: 'No WhatsApp numbers: visitors use the website chat (CTA rules)',
};

/**
 * Wording the brand rules forbid, caught by plain matching before the AI
 * review. A match is a flag for the reviewer, not proof of a breach.
 */
export const FLAGGED_PATTERNS: ReadonlyArray<{ pattern: RegExp; rule: string }> = [
  { pattern: /\bdijamin\b/i, rule: RULES.outcome },
  { pattern: /\bgaransi\b/i, rule: RULES.outcome },
  { pattern: /\bguarantee(?:s|d)?\b/i, rule: RULES.outcome },
  { pattern: /\bpasti\s+(?:lulus|lolos|tersertifikasi|mendapat(?:kan)?\s+sertifikat)\b/i, rule: RULES.outcome },
  { pattern: /\bsertifika(?:t|si)\s+(?:cepat|kilat|instan|ekspres|express)\b/i, rule: RULES.outcome },
  { pattern: /\btanpa\s+(?:ribet|repot)\b/i, rule: RULES.outcome },
  // "Praktik terbaik" (best practice) is ordinary wording, not a claim.
  { pattern: /(?<!\bprakti[kc]\s)\bterbaik\b/i, rule: RULES.superlative },
  { pattern: /(?:\bnomor\s+1\b|\bno\.\s?1\b|\bsatu-satunya\b|\bpaling\s+terpercaya\b)/i, rule: RULES.superlative },
  { pattern: /\bkonsultasi\s+gratis\b/i, rule: RULES.consulting },
  { pattern: /\bpendampingan\s+(?:hingga|sampai)\s+(?:lulus|tersertifikasi)\b/i, rule: RULES.consulting },
  { pattern: /\b(?:diskon|potongan\s+harga)\b/i, rule: RULES.discount },
  { pattern: /wa\.me\/|api\.whatsapp\.com/i, rule: RULES.contact },
];

const CONTEXT_CHARS = 60;

/** The first match of each forbidden pattern in the article's text and links, with the words around it. */
export function findFlaggedPhrases(html: string): FlaggedPhrase[] {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const text = [htmlToText(html), ...links].join(' ');
  return FLAGGED_PATTERNS.flatMap(({ pattern, rule }) => {
    const match = pattern.exec(text);
    if (!match) return [];
    const start = Math.max(0, match.index - CONTEXT_CHARS);
    const end = Math.min(text.length, match.index + match[0].length + CONTEXT_CHARS);
    const context = `${start > 0 ? '…' : ''}${text.slice(start, end).trim()}${end < text.length ? '…' : ''}`;
    return [{ phrase: match[0], rule, context }];
  });
}

/** The path of a link on the website, or null when it points somewhere else. */
function sitePath(link: string, host: string): string | null {
  if (link.startsWith('/')) return link;
  try {
    const url = new URL(link);
    return url.hostname === host ? url.pathname : null;
  } catch {
    return null;
  }
}

/**
 * Links that point at the wrong language: an Indonesian article links to /id/
 * pages, an English one to the plain paths. Blog articles are the exception,
 * since they exist only under /blog/ and /id/blog/ redirects there.
 */
export function wrongLanguageLinks(html: string, options: { host: string; language: ArticleLanguage }): string[] {
  const links = [...html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)].map((match) => match[1]);
  const wrong = links.filter((link) => {
    const path = sitePath(link, options.host);
    if (path === null) return false;
    if (path.startsWith('/blog/')) return false;
    if (path.startsWith('/id/blog/')) return true;
    return path.startsWith('/id/') !== (options.language === 'id');
  });
  return [...new Set(wrong)];
}

/** Set in the CMS when the article is published, so a draft cannot pass them. */
const PUBLISH_TIME_CHECKS = new Set(['Cover image is set', 'Image alt text is set']);

/**
 * The CMS SEO checklist for a draft, without the image checks, plus the word
 * range from Settings and the article language's own links.
 */
export function draftSeoChecks(
  draft: Pick<ArticleDraft, 'title' | 'slug' | 'html' | 'tags' | 'seoTitle' | 'metaDescription' | 'focusKeyword' | 'wordCount'>,
  ai: Pick<ArticleAiSettings, 'minWords' | 'maxWords' | 'language'>,
  host: string,
): { score: number; checks: SeoCheck[] } {
  const { checks } = seoChecklist({
    title: draft.title,
    slug: draft.slug,
    contentHtml: draft.html,
    featuredImageUrl: null,
    imageAltText: null,
    tags: draft.tags,
    seoTitle: draft.seoTitle,
    seoDescription: draft.metaDescription,
    seoFocusKeyword: draft.focusKeyword,
  });
  const kept = checks.filter((check) => !PUBLISH_TIME_CHECKS.has(check.label));
  kept.push({
    label: `Length is ${ai.minWords}–${ai.maxWords} words`,
    passed: draft.wordCount >= ai.minWords && draft.wordCount <= ai.maxWords,
    note: `${draft.wordCount} words`,
  });
  const wrongLinks = wrongLanguageLinks(draft.html, { host, language: ai.language });
  kept.push({
    label: ai.language === 'id' ? 'Links stay on the Indonesian pages' : 'Links stay on the English pages',
    passed: wrongLinks.length === 0,
    note: wrongLinks.length === 0 ? 'Every website link matches the article language' : wrongLinks.join(', '),
  });
  const score = Math.round((kept.filter((check) => check.passed).length / kept.length) * 100);
  return { score, checks: kept };
}
