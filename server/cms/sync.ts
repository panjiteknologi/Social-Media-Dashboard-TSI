import pg from 'pg';
import type { Db } from '../db/client';
import { appSettings, articles, leads } from '../db/schema';
import { batches } from '../seo/sync';
import { seoChecklist } from './checklist';

export const CMS_SYNC_STATE_KEY = 'cms_sync';

/**
 * Only columns content_machine_reader may read (server/cms/access.ts). Dates
 * come back as text, so no timezone conversion can shift them.
 */
const ARTICLES_SQL = `
  SELECT id, title, slug, excerpt, content_html, status,
         published_at::text AS published_at, modified_at::text AS modified_at,
         author_name, featured_image_url, image_alt_text, categories, tags, reading_time_minutes,
         seo_title, seo_description, seo_focus_keyword, updated_at
    FROM blog_posts`;

const LEADS_SQL = `
  SELECT id, service_inquiry, language, source_page, status::text AS status, created_at, updated_at
    FROM cms_contact_messages`;

type CmsArticle = {
  id: string | number;
  title: string;
  slug: string;
  excerpt: string | null;
  content_html: string | null;
  status: string;
  published_at: string | null;
  modified_at: string | null;
  author_name: string | null;
  featured_image_url: string | null;
  image_alt_text: string | null;
  categories: string[];
  tags: string[];
  reading_time_minutes: number | null;
  seo_title: string | null;
  seo_description: string | null;
  seo_focus_keyword: string | null;
  updated_at: Date;
};

type CmsLead = {
  id: number;
  service_inquiry: string;
  language: string;
  source_page: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export interface CmsSyncResult {
  articles: number;
  published: number;
  leads: number;
}

/**
 * Replaces the local copy of CMS articles and leads. Both are small, so a full
 * copy on every run is simpler than tracking changes, and an article deleted
 * in the CMS disappears here too.
 */
export async function syncCms(deps: { db: Db; connectionString: string }): Promise<CmsSyncResult> {
  const cms = new pg.Client({ connectionString: deps.connectionString, connectionTimeoutMillis: 20_000 });
  await cms.connect();
  let articleRows: CmsArticle[];
  let leadRows: CmsLead[];
  try {
    articleRows = (await cms.query<CmsArticle>(ARTICLES_SQL)).rows;
    leadRows = (await cms.query<CmsLead>(LEADS_SQL)).rows;
  } finally {
    await cms.end();
  }

  const articleValues = articleRows.map((row) => {
    const { checks, score, wordCount } = seoChecklist({
      title: row.title,
      slug: row.slug,
      contentHtml: row.content_html,
      featuredImageUrl: row.featured_image_url,
      imageAltText: row.image_alt_text,
      tags: row.tags ?? [],
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      seoFocusKeyword: row.seo_focus_keyword,
    });
    return {
      id: Number(row.id),
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      status: row.status,
      publishedAt: row.published_at,
      modifiedAt: row.modified_at,
      authorName: row.author_name,
      categories: row.categories ?? [],
      tags: row.tags ?? [],
      readingTimeMinutes: row.reading_time_minutes,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      seoFocusKeyword: row.seo_focus_keyword,
      featuredImageUrl: row.featured_image_url,
      wordCount,
      seoScore: score,
      seoChecks: checks,
      cmsUpdatedAt: row.updated_at,
    };
  });

  const leadValues = leadRows.map((row) => ({
    id: row.id,
    serviceInquiry: row.service_inquiry,
    language: row.language,
    sourcePage: row.source_page,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const syncedAt = new Date();
  await deps.db.transaction(async (tx) => {
    await tx.delete(articles);
    for (const batch of batches(articleValues)) await tx.insert(articles).values(batch);
    await tx.delete(leads);
    for (const batch of batches(leadValues)) await tx.insert(leads).values(batch);

    const value = { syncedAt: syncedAt.toISOString(), articles: articleValues.length, leads: leadValues.length };
    await tx
      .insert(appSettings)
      .values({ key: CMS_SYNC_STATE_KEY, value })
      .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedAt: syncedAt } });
  });

  return {
    articles: articleValues.length,
    published: articleValues.filter((article) => article.status === 'publish').length,
    leads: leadValues.length,
  };
}
