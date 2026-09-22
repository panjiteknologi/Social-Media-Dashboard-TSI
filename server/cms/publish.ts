import pg from 'pg';
import type { ArticleDraft } from '../../shared/aiContent';
import { toSlug } from '../contentAi/parse';
import { DuplicateArticleError, findDuplicate } from './duplicates';
import { CONTENT_MACHINE_SOURCE } from './writeAccess';

/**
 * Turning an approved AI draft into a row in the CMS's blog_posts table. The
 * article arrives as a draft: a person adds the cover image in the CMS and
 * presses Publish, which is also the moment it appears on the website.
 */

/** Every article on this site sits in this category; "News Update" is for announcements. */
export const DEFAULT_CATEGORY = 'Artikel ISO';

/** Reading speed used for the CMS's reading time, in words per minute. */
const WORDS_PER_MINUTE = 200;

export interface CmsArticlePayload {
  title: string;
  slug: string;
  excerpt: string | null;
  contentHtml: string;
  /** Content Machine writes drafts; a person publishes in the CMS. */
  status: 'draft';
  categories: string[];
  tags: string[];
  readingTimeMinutes: number;
  seoTitle: string;
  seoDescription: string;
  seoFocusKeyword: string;
}

export function buildCmsPayload(draft: ArticleDraft, category = DEFAULT_CATEGORY): CmsArticlePayload {
  return {
    title: draft.title,
    slug: toSlug(draft.slug || draft.title),
    excerpt: draft.excerpt.trim() || null,
    contentHtml: draft.html,
    status: 'draft',
    categories: [category],
    tags: draft.tags,
    readingTimeMinutes: Math.max(1, Math.round(draft.wordCount / WORDS_PER_MINUTE)),
    seoTitle: draft.seoTitle,
    seoDescription: draft.metaDescription,
    seoFocusKeyword: draft.focusKeyword,
  };
}

/** Where the article will live once someone publishes it. */
export const articleUrl = (host: string, slug: string): string => `https://${host}/blog/${slug}/`;

/**
 * A slug no other article uses. A slug already held by an article somebody else
 * wrote is never taken over: the copy gets -2, -3 and so on.
 */
export async function freeSlug(
  taken: (slug: string) => Promise<number | null>,
  wanted: string,
  ownPostId: number | null,
): Promise<string> {
  for (let suffix = 1; suffix <= 20; suffix += 1) {
    const candidate = suffix === 1 ? wanted : `${wanted.slice(0, 76)}-${suffix}`;
    const holder = await taken(candidate);
    if (holder === null || holder === ownPostId) return candidate;
  }
  throw new Error(`Every slug from ${wanted} to ${wanted}-20 is taken in the CMS.`);
}

export interface CmsWriteResult {
  postId: number;
  slug: string;
  created: boolean;
}

/**
 * Writes one article into the CMS: a new row, or the row this content wrote
 * before. An update only touches rows Content Machine created.
 */
export async function writeArticleToCms(deps: {
  connectionString: string;
  payload: CmsArticlePayload;
  contentItemId: string;
  /** The CMS row this content already became, when it has one. */
  postId: number | null;
  /** Write a second copy even though the CMS already holds this article. */
  force?: boolean;
}): Promise<CmsWriteResult> {
  const client = new pg.Client({ connectionString: deps.connectionString, connectionTimeoutMillis: 20_000 });
  await client.connect();
  try {
    const { rows: existing } = await client.query<{ id: string; title: string; slug: string; status: string }>(
      'SELECT id, title, slug, status FROM blog_posts',
    );
    const known = existing.map((row) => ({ id: Number(row.id), title: row.title, slug: row.slug, status: row.status }));

    // Only a new article can duplicate something; updating the row this content
    // already owns is never blocked by another article's title. The CMS is asked
    // itself, not the hourly copy, so an article pasted in by hand a minute ago
    // still counts as already there.
    if (deps.postId === null && !deps.force) {
      const duplicate = findDuplicate(known, {
        title: deps.payload.title,
        slug: deps.payload.slug,
        ownPostId: deps.postId,
      });
      if (duplicate) throw new DuplicateArticleError(duplicate);
    }

    const bySlug = new Map(known.map((article) => [article.slug, article.id]));
    const slug = await freeSlug(async (candidate) => bySlug.get(candidate) ?? null, deps.payload.slug, deps.postId);
    const { payload } = deps;
    const rawMeta = JSON.stringify({
      source: CONTENT_MACHINE_SOURCE,
      contentItemId: deps.contentItemId,
      writtenAt: new Date().toISOString(),
    });
    const values = [
      payload.title,
      slug,
      payload.excerpt,
      payload.contentHtml,
      payload.status,
      payload.categories,
      payload.tags,
      payload.readingTimeMinutes,
      payload.seoTitle,
      payload.seoDescription,
      payload.seoFocusKeyword,
      rawMeta,
    ];

    if (deps.postId === null) {
      // wordpress_id is required and unique; the CMS itself stores a negative
      // placeholder from the table's own sequence for articles it creates.
      const { rows } = await client.query<{ id: string; slug: string }>(
        `INSERT INTO blog_posts (
           wordpress_id, title, slug, excerpt, content_html, status,
           categories, tags, reading_time_minutes,
           seo_title, seo_description, seo_focus_keyword,
           raw_meta, modified_at, created_at, updated_at
         ) VALUES (
           -(nextval('blog_posts_id_seq')::int), $1, $2, $3, $4, $5,
           $6, $7, $8, $9, $10, $11, $12::jsonb, current_date, now(), now()
         ) RETURNING id, slug`,
        values,
      );
      return { postId: Number(rows[0].id), slug: rows[0].slug, created: true };
    }

    const { rows } = await client.query<{ id: string; slug: string }>(
      `UPDATE blog_posts SET
         title = $1, slug = $2, excerpt = $3, content_html = $4, status = $5,
         categories = $6, tags = $7, reading_time_minutes = $8,
         seo_title = $9, seo_description = $10, seo_focus_keyword = $11,
         raw_meta = $12::jsonb, modified_at = current_date, updated_at = now()
       WHERE id = $13 AND raw_meta->>'source' = $14
       RETURNING id, slug`,
      [...values, deps.postId, CONTENT_MACHINE_SOURCE],
    );
    if (rows.length === 0) {
      throw new Error(
        `CMS article ${deps.postId} was not written by Content Machine, or no longer exists. It has been left alone.`,
      );
    }
    return { postId: Number(rows[0].id), slug: rows[0].slug, created: false };
  } finally {
    await client.end();
  }
}
