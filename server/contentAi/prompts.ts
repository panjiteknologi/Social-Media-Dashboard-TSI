import type { ArticleDraft, ContentBrief, QaResult } from '../../shared/aiContent';
import type { BrandKnowledge } from '../../shared/brand';
import type { AiMessage } from '../ai/gateway';
import { buildBrandContext } from '../brand/context';

const LANGUAGE_NAMES = { id: 'Indonesian', en: 'English' } as const;

const JSON_ONLY = 'Reply with JSON only, without a code fence and without any text around it.';

export interface SearchQueryData {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface KnownArticle {
  url: string;
  title: string;
  focusKeyword: string | null;
}

// ---------------------------------------------------------------------------
// Topic recommendations

export interface TopicContext {
  window: { start: string; end: string } | null;
  opportunities: Array<SearchQueryData & { opportunityScore: number | null; cluster: string; landingPage: string | null }>;
  articles: KnownArticle[];
  /** Keywords and titles already in the Content Planner. */
  planned: string[];
  /** Keywords the team dismissed before. */
  dismissed: string[];
  maxTopics: number;
}

export function buildTopicMessages(brand: BrandKnowledge, context: TopicContext): AiMessage[] {
  const language = LANGUAGE_NAMES[brand.ai.language];
  const rules = [
    'You are the SEO content strategist for this website.',
    `Recommend up to ${context.maxTopics} article topics, best first, from the search opportunities in the data.`,
    'Each topic must use one keyword from the opportunities list, copied exactly. Never invent keywords, numbers or URLs.',
    'Opportunities are real Google searches where the site already appears, but below the top results.',
    'Choose "update_article" when an existing article already covers the keyword, or is its landing page: set existingUrl to that URL from the article list. Otherwise choose "new_article" with existingUrl null.',
    'Skip keywords already in the planner or dismissed, brand searches, job searches, and searches unrelated to certification, standards or training.',
    'Prefer standards TSI certifies according to the company profile. A topic about another standard is allowed only as an educational article, and its reason must say so.',
    'Give one topic per search intent: merge keywords that one article would answer, and name the strongest keyword.',
    'intent is one of: informational, commercial, transactional, navigational.',
    `Write title, angle and reason in ${language}. title: an article title that follows the tone of voice. angle: one or two sentences on what the article covers. reason: one sentence citing the keyword's impressions and position.`,
    JSON_ONLY,
    '{"topics": [{"keyword": "", "title": "", "intent": "", "action": "new_article", "existingUrl": null, "angle": "", "reason": ""}]}',
  ];
  return [
    { role: 'system', content: `${buildBrandContext(brand)}\n\n## Task\n${rules.join('\n')}` },
    { role: 'user', content: `Data as JSON:\n${JSON.stringify(context)}` },
  ];
}

// ---------------------------------------------------------------------------
// Brief

export interface BriefContext {
  item: { title: string; keyword: string | null; campaign: string | null; notes: string | null };
  search: {
    window: { start: string; end: string } | null;
    /** Searches that contain the focus keyword's words, most impressions first. */
    queries: SearchQueryData[];
  };
  /** Articles the brief may link to, same topic first. */
  articles: KnownArticle[];
}

export function buildBriefMessages(brand: BrandKnowledge, context: BriefContext): AiMessage[] {
  const language = LANGUAGE_NAMES[brand.ai.language];
  const rules = [
    'Write the content brief a writer follows for one article.',
    'Use the article structure described in the tone of voice. The last outline section is the conclusion, which carries the single call to action.',
    'Base the focus keyword and headings on the real searches in the data when they fit; the item title is a working title only.',
    'Keep the brief concise: it gives the writer direction, it is not the article. targetReader and angle: one or two sentences each.',
    'outline: 5–8 sections, each with a heading and 2–4 points; each point is a short phrase of at most 15 words.',
    'mustCover: at most 8 facts or requirements the article must explain, one sentence each. Name the standard and clause only when you are sure; otherwise describe the requirement in general terms.',
    'internalLinks: 2–4 articles from the article list, with their exact URLs, and why each fits. Never invent a URL.',
    brand.ai.includeFaq ? 'faq: 3–5 questions readers ask about this topic.' : 'faq: an empty list.',
    'cta: the call to action for the conclusion, following the CTA rules, with its link.',
    'impartialityNotes: at most 5 specific impartiality risks of this topic and how the article avoids them, one sentence each. Do not repeat the general rules.',
    'searchIntent is one of: informational, commercial, transactional, navigational.',
    'Follow the team notes unless they would break a rule; say so in impartialityNotes if they do.',
    `Write every text field in ${language}.`,
    JSON_ONLY,
    '{"workingTitle": "", "focusKeyword": "", "searchIntent": "", "targetReader": "", "angle": "", "outline": [{"heading": "", "points": [""]}], "mustCover": [""], "internalLinks": [{"url": "", "title": "", "reason": ""}], "faq": [""], "cta": "", "impartialityNotes": [""]}',
  ];
  return [
    { role: 'system', content: `${buildBrandContext(brand)}\n\n## Task\n${rules.join('\n')}` },
    { role: 'user', content: `Data as JSON:\n${JSON.stringify(context)}` },
  ];
}

// ---------------------------------------------------------------------------
// Draft

export function buildDraftMessages(
  brand: BrandKnowledge,
  context: { brief: ContentBrief; notes: string | null; contactUrl: string },
): AiMessage[] {
  const { ai } = brand;
  const language = LANGUAGE_NAMES[ai.language];
  const rules = [
    'Write the complete article from the brief.',
    `Write in ${language}, ${context.brief.wordTarget.min}–${context.brief.wordTarget.max} words in the article body.`,
    'Follow the outline in order. You may polish heading wording; keep the focus keyword in at least one H2.',
    'Put the focus keyword in the first paragraph, naturally.',
    'The article HTML is the body only: no H1, no html, head, body or style tags. Use p, h2, h3, ul, ol, li, strong, em and a.',
    'Link only to the URLs in brief.internalLinks and to the call-to-action link. Name official sources such as ISO or Codex Alimentarius without linking to them.',
    `The conclusion carries the one call to action from the brief. The contact page is ${context.contactUrl}.`,
    ai.includeFaq && context.brief.faq.length > 0
      ? 'After the conclusion, add an FAQ section: an h2, then each question as an h3 followed by a short answer.'
      : 'Do not add an FAQ section.',
    ai.authorLine ? `End with <p><em>${ai.authorLine}</em></p>.` : 'Do not add a byline.',
    'Never invent statistics, clause numbers, quotes, client names or facts about TSI that are not in the company profile.',
    'seoTitle: 45–60 characters, containing the focus keyword. metaDescription: 120–160 characters, containing the focus keyword. slug: lowercase words joined by hyphens, under 80 characters. tags: 3–6. excerpt: one or two sentences.',
    'Reply in exactly this format and nothing else: a ```json block with the details, then a ```html block with the article.',
    '```json\n{"title": "", "seoTitle": "", "metaDescription": "", "slug": "", "excerpt": "", "focusKeyword": "", "tags": [""]}\n```',
    '```html\n<p>…</p>\n```',
  ];
  const notes = context.notes ? `\n\nTeam notes:\n${context.notes}` : '';
  return [
    { role: 'system', content: `${buildBrandContext(brand)}\n\n## Task\n${rules.join('\n')}` },
    { role: 'user', content: `Brief as JSON:\n${JSON.stringify(context.brief)}${notes}` },
  ];
}

// ---------------------------------------------------------------------------
// Revision, after an approver sent the draft back

export function buildRevisionMessages(
  brand: BrandKnowledge,
  context: { brief: ContentBrief | null; draft: ArticleDraft; qa: QaResult | null; note: string; contactUrl: string },
): AiMessage[] {
  const { ai } = brand;
  const language = LANGUAGE_NAMES[ai.language];
  const rules = [
    'An approver sent the article back. Rewrite it so it answers their request and fixes the QA issues.',
    'Change only what the request and the issues call for. Keep the rest of the article, its structure and its wording as they are.',
    `Write in ${language}. Keep the length between ${context.draft.wordCount > 0 ? 'the brief’s word target' : 'the word target'} in the settings.`,
    'The article HTML is the body only: no H1, no html, head, body or style tags. Use p, h2, h3, ul, ol, li, strong, em and a.',
    `Keep the existing links, and use ${context.contactUrl} for the call to action.`,
    'Never invent statistics, clause numbers, quotes, client names or facts about TSI that are not in the company profile.',
    'Update seoTitle, metaDescription, slug, tags and excerpt only where the change makes them wrong.',
    'Reply in exactly this format and nothing else: a ```json block with the details, then a ```html block with the whole revised article.',
    '```json\n{"title": "", "seoTitle": "", "metaDescription": "", "slug": "", "excerpt": "", "focusKeyword": "", "tags": [""]}\n```',
    '```html\n<p>…</p>\n```',
  ];
  const issues = context.qa?.review?.issues ?? [];
  const flagged = context.qa?.flaggedPhrases ?? [];
  const { html, model: _model, writtenAt: _writtenAt, ...details } = context.draft;
  return [
    { role: 'system', content: `${buildBrandContext(brand)}\n\n## Task\n${rules.join('\n')}` },
    {
      role: 'user',
      content: [
        `The approver's request:\n${context.note}`,
        issues.length > 0 ? `QA issues to fix:\n${JSON.stringify(issues)}` : 'QA found no issues.',
        flagged.length > 0 ? `Wording the rules forbid:\n${JSON.stringify(flagged)}` : '',
        context.brief ? `The brief:\n${JSON.stringify(context.brief)}` : '',
        `Current details as JSON:\n${JSON.stringify(details)}`,
        `Current article HTML:\n${html}`,
      ]
        .filter(Boolean)
        .join('\n\n'),
    },
  ];
}

// ---------------------------------------------------------------------------
// QA review

export function buildReviewMessages(
  brand: BrandKnowledge,
  context: { brief: ContentBrief | null; draft: ArticleDraft },
): AiMessage[] {
  const language = LANGUAGE_NAMES[brand.ai.language];
  const rules = [
    'You are the compliance and brand reviewer. Check the draft article against every rule above before a person approves it.',
    'impartiality: "fail" when any sentence breaks an impartiality rule, otherwise "pass".',
    'brandScore: 0–100 for tone of voice, structure, language rules and CTA rules together.',
    'issues, most serious first:',
    '- high: breaks an impartiality rule or a forbidden CTA, states a fact about TSI missing from the company profile, or makes a claim about a standard or regulation that is likely wrong or invented (clause numbers, statistics, dates).',
    '- medium: tone, structure, CTA placement, internal links or SEO problems the reviewer should fix before publishing.',
    '- low: polish.',
    'quote: the exact words from the draft. problem: what is wrong and which rule, in English. fix: the replacement text in ' +
      `${language}, ready to paste.`,
    'Do not report the missing cover image or image alt text: they are added in the CMS.',
    'summary: two or three sentences in English for the approver.',
    JSON_ONLY,
    '{"impartiality": "pass", "brandScore": 0, "summary": "", "issues": [{"severity": "high", "category": "impartiality", "quote": "", "problem": "", "fix": ""}]}',
  ];
  const { html, model: _model, writtenAt: _writtenAt, ...details } = context.draft;
  return [
    { role: 'system', content: `${buildBrandContext(brand)}\n\n## Task\n${rules.join('\n')}` },
    {
      role: 'user',
      content: [
        context.brief ? `Brief as JSON:\n${JSON.stringify(context.brief)}` : 'There is no brief.',
        `Draft details as JSON:\n${JSON.stringify(details)}`,
        `Draft article HTML:\n${html}`,
      ].join('\n\n'),
    },
  ];
}
