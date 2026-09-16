import { z } from 'zod';
import {
  QA_SEVERITIES,
  SEARCH_INTENTS,
  TOPIC_ACTIONS,
  type ArticleDraft,
  type ContentBrief,
  type QaResult,
} from '../../shared/aiContent';
import { htmlToText } from '../cms/checklist';

/** A reply the AI gave in the wrong shape. Retrying usually fixes it. */
export class AiReplyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiReplyError';
  }
}

/** The JSON object in a model's reply, inside a code fence or with text around it. */
export function extractJson(text: string): unknown {
  const fenced = /```(?:json)?[ \t]*\r?\n([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end <= start) throw new AiReplyError('The AI reply held no JSON object.');
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new AiReplyError('The AI reply was not valid JSON.');
  }
}

/** Strings only, trimmed, blanks dropped, at most `max`; anything else becomes an empty list. */
const stringList = (max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, max),
    );

/** The entries of a list that match the schema, the rest dropped. */
const validEntries = <T extends z.ZodType>(schema: T, max: number) =>
  z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items
        .flatMap((item) => {
          const parsed = schema.safeParse(item);
          return parsed.success ? [parsed.data as z.infer<T>] : [];
        })
        .slice(0, max),
    );

// ---------------------------------------------------------------------------
// Topic recommendations

const TopicSchema = z.object({
  keyword: z.string().trim().min(1).max(200),
  title: z.string().trim().min(1).max(200),
  intent: z.enum(SEARCH_INTENTS).catch('informational'),
  action: z.enum(TOPIC_ACTIONS).catch('new_article'),
  existingUrl: z.string().trim().nullable().catch(null),
  angle: z.string().trim().max(1500).catch(''),
  reason: z.string().trim().max(1500).catch(''),
});

export type ParsedTopic = z.infer<typeof TopicSchema>;

export function parseTopics(text: string): ParsedTopic[] {
  const body = extractJson(text) as { topics?: unknown } | null;
  if (!Array.isArray(body?.topics)) throw new AiReplyError('The AI reply had no topics list.');
  return validEntries(TopicSchema, 50).parse(body.topics);
}

// ---------------------------------------------------------------------------
// Brief

const BriefSchema = z.object({
  workingTitle: z.string().trim().min(1).max(200),
  focusKeyword: z.string().trim().min(1).max(120),
  searchIntent: z.enum(SEARCH_INTENTS).catch('informational'),
  targetReader: z.string().trim().max(800).catch(''),
  angle: z.string().trim().max(1500).catch(''),
  outline: z
    .array(z.object({ heading: z.string().trim().min(1).max(200), points: stringList(10) }))
    .min(2, 'The outline needs at least two sections.')
    .max(15),
  mustCover: stringList(15),
  internalLinks: validEntries(
    z.object({
      url: z.string().trim().min(1),
      title: z.string().trim().catch(''),
      reason: z.string().trim().catch(''),
    }),
    10,
  ),
  faq: stringList(8),
  cta: z.string().trim().max(800).catch(''),
  impartialityNotes: stringList(10),
});

/**
 * The brief, keeping only internal links to articles that exist: the model
 * sees the list of real articles and must not invent URLs.
 */
export function parseBrief(
  text: string,
  options: { knownUrls: ReadonlyMap<string, string>; wordTarget: ContentBrief['wordTarget'] },
): ContentBrief {
  const parsed = BriefSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new AiReplyError(`The brief was incomplete: ${z.prettifyError(parsed.error)}`);
  const internalLinks = parsed.data.internalLinks
    .filter((link) => options.knownUrls.has(link.url))
    .map((link) => ({ ...link, title: options.knownUrls.get(link.url) ?? link.title }))
    .slice(0, 6);
  return { ...parsed.data, internalLinks, wordTarget: options.wordTarget };
}

// ---------------------------------------------------------------------------
// Draft

const DraftMetaSchema = z.object({
  title: z.string().trim().min(1).max(200),
  seoTitle: z.string().trim().min(1).max(120),
  metaDescription: z.string().trim().min(1).max(320),
  slug: z.string().trim().min(1).max(200),
  excerpt: z.string().trim().max(800).catch(''),
  focusKeyword: z.string().trim().min(1).max(120),
  tags: stringList(10),
});

/** Lowercase words joined by hyphens, at most 80 characters, as the CMS expects. */
export function toSlug(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/**
 * Removes anything but article markup: scripts, embeds, forms, event handlers
 * and javascript: links. H1 becomes H2, since the page title is the only H1.
 */
export function sanitizeArticleHtml(html: string): string {
  return html
    .replace(/<(script|style|iframe|object|embed|form|noscript)\b[\s\S]*?<\/\1\s*>/gi, '')
    .replace(/<\/?(script|style|iframe|object|embed|form|noscript|link|meta|base)\b[^>]*>/gi, '')
    .replace(/\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '')
    .replace(/(href|src)\s*=\s*(["'])\s*(?:javascript|data|vbscript):[^"']*\2/gi, '$1="#"')
    .replace(/<(\/?)h1\b/gi, '<$1h2')
    .trim();
}

export function countWords(html: string): number {
  const text = htmlToText(html);
  return text ? text.split(' ').length : 0;
}

/** The draft reply: a JSON block with the article's details, then the article in an html block. */
export function parseDraft(text: string): Omit<ArticleDraft, 'model' | 'writtenAt'> {
  const meta = DraftMetaSchema.safeParse(extractJson(text));
  if (!meta.success) throw new AiReplyError(`The draft's details were incomplete: ${z.prettifyError(meta.error)}`);
  const raw = /```html[ \t]*\r?\n([\s\S]*?)```/i.exec(text)?.[1];
  if (!raw?.trim()) throw new AiReplyError('The draft reply held no article HTML.');
  const html = sanitizeArticleHtml(raw);
  return { ...meta.data, slug: toSlug(meta.data.slug), html, wordCount: countWords(html) };
}

// ---------------------------------------------------------------------------
// QA review

const IssueSchema = z.object({
  severity: z.enum(QA_SEVERITIES).catch('medium'),
  category: z.string().trim().max(60).catch('other'),
  quote: z.string().trim().max(800).catch(''),
  problem: z.string().trim().min(1).max(1200),
  fix: z.string().trim().max(1200).catch(''),
});

const ReviewSchema = z.object({
  brandScore: z.coerce
    .number()
    .catch(0)
    .transform((value) => Math.max(0, Math.min(100, Math.round(value)))),
  // An unclear verdict counts as a failure: a person must look.
  impartiality: z.enum(['pass', 'fail']).catch('fail'),
  summary: z.string().trim().min(1).max(2500),
  issues: validEntries(IssueSchema, 30),
});

export function parseReview(text: string, model: string): NonNullable<QaResult['review']> {
  const parsed = ReviewSchema.safeParse(extractJson(text));
  if (!parsed.success) throw new AiReplyError(`The QA review was incomplete: ${z.prettifyError(parsed.error)}`);
  return { model, ...parsed.data };
}
