import { and, desc, eq, gt, gte, inArray, isNotNull, max } from 'drizzle-orm';
import { articleUrl } from '../../shared/content';
import { addDays, type SeoSettings } from '../../shared/seo';
import type { Db } from '../db/client';
import { articles, gscPageDaily, indexInspections, pagespeedResults, siteCrawls, sitePages } from '../db/schema';
import { runPagespeed } from '../google/pagespeed';
import type { UrlInspectionClient } from '../google/urlInspection';
import { totalsByPage } from '../seo/metrics';
import { batches, cut } from '../seo/sync';
import { crawlSite, type CrawlSeed } from './crawl';
import { internalUrl, parseSitemap } from './html';
import { isSlowPage } from './summary';

const USER_AGENT = 'ContentMachine-SiteCheck/1.0 (TSI marketing dashboard)';

/** The site has about 210 pages in its sitemap; the limit leaves room for pages found only through links. */
export const MAX_CRAWL_PAGES = 600;

/** Crawls kept, so the previous week stays available while a new crawl runs. */
const CRAWLS_KEPT = 2;

/** Pages tested for speed: the home page and the pages with the most search clicks. */
export const PAGESPEED_PAGES = 10;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function recentSearchPages(db: Db): Promise<{ through: string | null; pages: string[] }> {
  const [row] = await db.select({ through: max(gscPageDaily.date) }).from(gscPageDaily);
  if (!row?.through) return { through: null, pages: [] };
  const rows = await db
    .selectDistinct({ page: gscPageDaily.page })
    .from(gscPageDaily)
    .where(and(gte(gscPageDaily.date, addDays(row.through, -27)), gt(gscPageDaily.impressions, 0)));
  return { through: row.through, pages: rows.map((item) => item.page) };
}

/** Crawls the website from its sitemap, the pages Google shows in search, and the CMS articles. */
export async function runSiteCrawl(deps: { db: Db; settings: SeoSettings; fetchImpl?: typeof fetch }) {
  const { db, settings } = deps;
  const host = settings.contentHost;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const home = `https://${host}/`;

  let sitemapUrls: string[] = [];
  let sitemapNote: string | undefined;
  try {
    const response = await fetchImpl(`${home}sitemap.xml`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(30_000),
    });
    if (response.ok) sitemapUrls = parseSitemap(await response.text());
    else sitemapNote = `sitemap.xml returned ${response.status}`;
  } catch (error) {
    sitemapNote = `sitemap.xml could not be read: ${errorText(error)}`;
  }

  const [search, published] = await Promise.all([
    recentSearchPages(db),
    db.select({ slug: articles.slug }).from(articles).where(eq(articles.status, 'publish')),
  ]);
  const seeds: CrawlSeed[] = [
    { url: home, source: 'home' },
    ...sitemapUrls.map((url): CrawlSeed => ({ url, source: 'sitemap' })),
    ...published.map((article): CrawlSeed => ({ url: articleUrl(host, article.slug), source: 'cms' })),
    ...search.pages.map((url): CrawlSeed => ({ url, source: 'search' })),
  ];

  const [crawl] = await db.insert(siteCrawls).values({}).returning({ id: siteCrawls.id });
  const { pages, truncated } = await crawlSite({
    host,
    seeds,
    maxPages: MAX_CRAWL_PAGES,
    userAgent: USER_AGENT,
    fetchImpl,
  });

  await db.transaction(async (tx) => {
    const rows = pages.map((page) => ({
      crawlId: crawl.id,
      url: cut(page.url),
      sources: page.sources,
      status: page.status,
      redirectTo: page.redirectTo ? cut(page.redirectTo) : null,
      contentType: page.contentType,
      responseMs: page.responseMs,
      title: page.signals?.title ?? null,
      description: page.signals?.description ?? null,
      canonical: page.signals?.canonical ? cut(page.signals.canonical) : null,
      noindex: page.signals?.noindex ?? false,
      h1Count: page.signals?.h1Count ?? 0,
      imagesMissingAlt: page.signals?.imagesMissingAlt ?? 0,
      jsonLd: page.signals?.jsonLd ?? [],
      linkedFrom: page.linkedFrom.map(cut),
      error: page.error,
    }));
    for (const batch of batches(rows)) await tx.insert(sitePages).values(batch).onConflictDoNothing();
    await tx
      .update(siteCrawls)
      .set({ finishedAt: new Date(), pagesChecked: pages.length, truncated })
      .where(eq(siteCrawls.id, crawl.id));

    const old = await tx.select({ id: siteCrawls.id }).from(siteCrawls).orderBy(desc(siteCrawls.startedAt)).offset(CRAWLS_KEPT);
    if (old.length > 0) await tx.delete(siteCrawls).where(inArray(siteCrawls.id, old.map((row) => row.id)));
  });

  return {
    pagesChecked: pages.length,
    truncated,
    sitemapUrls: sitemapUrls.length,
    ...(sitemapNote ? { sitemapNote } : {}),
    errors: pages.filter((page) => page.status === 0 || page.status >= 400).length,
    redirects: pages.filter((page) => page.status >= 300 && page.status < 400).length,
  };
}

async function latestCrawlId(db: Db): Promise<string | null> {
  const [crawl] = await db
    .select({ id: siteCrawls.id })
    .from(siteCrawls)
    .where(isNotNull(siteCrawls.finishedAt))
    .orderBy(desc(siteCrawls.startedAt))
    .limit(1);
  return crawl?.id ?? null;
}

/** Asks Google for the index status of every page in the sitemap that loaded in the latest crawl. */
export async function runIndexInspection(deps: { db: Db; client: UrlInspectionClient; limit?: number }) {
  const { db, client } = deps;
  const crawlId = await latestCrawlId(db);
  if (!crawlId) return { inspected: 0, reason: 'No finished site crawl yet. Run site-crawl first.' };

  const pages = await db
    .select({ url: sitePages.url, sources: sitePages.sources })
    .from(sitePages)
    .where(and(eq(sitePages.crawlId, crawlId), eq(sitePages.status, 200)));
  const urls = pages
    .filter((page) => page.sources.includes('sitemap') || page.sources.includes('home'))
    .map((page) => page.url)
    .slice(0, deps.limit ?? 500);

  let notIndexed = 0;
  let failures = 0;
  let lastError: string | undefined;
  for (const url of urls) {
    try {
      const result = await client.inspect(url);
      const values = {
        ...result,
        lastCrawlTime: result.lastCrawlTime ? new Date(result.lastCrawlTime) : null,
        inspectedAt: new Date(),
      };
      await db
        .insert(indexInspections)
        .values({ url, ...values })
        .onConflictDoUpdate({ target: indexInspections.url, set: values });
      if (result.verdict !== 'PASS') notIndexed++;
    } catch (error) {
      failures++;
      lastError = errorText(error);
    }
    // Well under the 600 inspections a minute Google allows.
    await pause(150);
  }

  if (urls.length > 0 && failures === urls.length) throw new Error(`Every inspection failed. Last error: ${lastError}`);
  return { inspected: urls.length - failures, notIndexed, failures, ...(lastError ? { lastError } : {}) };
}

/** Adds a trailing slash to page paths, as the website redirects to them, so the test measures the final page. */
function pageUrl(url: string): string {
  const parsed = new URL(url);
  if (!parsed.pathname.endsWith('/') && !/\.[a-z0-9]+$/i.test(parsed.pathname)) parsed.pathname += '/';
  return parsed.href;
}

/** Tests mobile speed for the home page and the pages with the most search clicks in the last 28 days. */
export async function runPagespeedCheck(deps: {
  db: Db;
  apiKey: string | undefined;
  settings: SeoSettings;
  fetchImpl?: typeof fetch;
}) {
  const { db, apiKey, settings } = deps;
  if (!apiKey) return { checked: 0, reason: 'PAGESPEED_API_KEY is not set.' };

  const host = settings.contentHost;
  const home = `https://${host}/`;
  const { through } = await recentSearchPages(db);
  const totals = through ? await totalsByPage(db, addDays(through, -27), through) : new Map();

  const ranked = [...totals]
    .sort(([, a], [, b]) => b.clicks - a.clicks || b.impressions - a.impressions)
    .map(([page]) => internalUrl(page, home, host))
    // Documents such as PDFs are not pages Lighthouse can load.
    .filter((url): url is string => url !== null && !/\.[a-z0-9]+$/i.test(new URL(url).pathname))
    .map(pageUrl);
  const urls = [...new Set([home, ...ranked])].slice(0, PAGESPEED_PAGES);

  let slow = 0;
  let failures = 0;
  let lastError: string | undefined;
  for (const url of urls) {
    try {
      const result = await runPagespeed(url, apiKey, deps.fetchImpl);
      const values = { ...result, checkedAt: new Date() };
      await db
        .insert(pagespeedResults)
        .values({ url, ...values })
        .onConflictDoUpdate({ target: pagespeedResults.url, set: values });
      if (isSlowPage(result)) slow++;
    } catch (error) {
      failures++;
      lastError = errorText(error);
    }
  }

  if (urls.length > 0 && failures === urls.length) throw new Error(`Every speed test failed. Last error: ${lastError}`);
  return { checked: urls.length - failures, slow, failures, ...(lastError ? { lastError } : {}) };
}
