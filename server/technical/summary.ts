import type {
  HealthCheck,
  HealthCheckKey,
  HealthIssue,
  HealthSeverity,
  TechnicalHealth,
} from '../../shared/technical';

export interface CrawlPageRow {
  url: string;
  sources: string[];
  status: number;
  contentType: string | null;
  title: string | null;
  description: string | null;
  canonical: string | null;
  noindex: boolean;
  imagesMissingAlt: number;
  jsonLd: string[];
  linkedFrom: string[];
  error: string | null;
}

export interface InspectionRow {
  url: string;
  verdict: string;
  coverageState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  inspectedAt: Date;
}

export interface SpeedRow {
  url: string;
  score: number | null;
  lcpMs: number | null;
  /** Chrome UX Report rating from real visitors: FAST, AVERAGE or SLOW. */
  fieldCategory: string | null;
  checkedAt: Date;
}

/** Affected pages listed per check. */
const MAX_ISSUES = 25;

/** Below this mobile performance score (0–1) Google rates a page poor. */
export const SLOW_SCORE = 0.5;

/**
 * Slow when the lab test rates the page poor, or when real visitors on Chrome
 * experience it as slow. Field data counts even with a fair lab score: it is
 * what people actually wait for.
 */
export const isSlowPage = (row: { score: number | null; fieldCategory: string | null }): boolean =>
  (row.score !== null && row.score < SLOW_SCORE) || row.fieldCategory === 'SLOW';

const CHECKS: Record<HealthCheckKey, { label: string; severity: HealthSeverity }> = {
  index: { label: 'Index Issues', severity: 'High' },
  brokenLinks: { label: 'Broken Links', severity: 'High' },
  metadata: { label: 'Missing Metadata', severity: 'Medium' },
  duplicateTitles: { label: 'Duplicate Titles', severity: 'Medium' },
  slowPages: { label: 'Slow Pages', severity: 'Medium' },
  altText: { label: 'Missing Alt Text', severity: 'Low' },
  canonical: { label: 'Canonical Issues', severity: 'Medium' },
  schema: { label: 'Schema Issues', severity: 'Low' },
};

function toCheck(key: HealthCheckKey, issues: HealthIssue[] | null, notCheckedNote: string): HealthCheck {
  const { label, severity } = CHECKS[key];
  if (issues === null) return { key, label, state: 'not_checked', count: 0, severity, note: notCheckedNote, issues: [] };
  return {
    key,
    label,
    state: issues.length > 0 ? 'issues' : 'ok',
    count: new Set(issues.map((issue) => issue.url)).size,
    severity,
    note: '',
    issues: issues.slice(0, MAX_ISSUES),
  };
}

const sameUrl = (a: string, b: string): boolean => a.replace(/\/$/, '') === b.replace(/\/$/, '');

const isHtmlPage = (page: CrawlPageRow): boolean => page.status === 200 && (page.contentType ?? '').includes('text/html');

/** Pages Google shows in search come first: they cost visits today. */
const visibility = (page: CrawlPageRow): number =>
  page.sources.includes('search') ? 0 : page.sources.includes('sitemap') || page.sources.includes('home') ? 1 : 2;

function brokenNote(page: CrawlPageRow): string {
  const status = page.status === 0 ? `No response (${page.error ?? 'request failed'})` : `Returns ${page.status}`;
  if (page.sources.includes('search')) return `${status}; Google still shows it in search`;
  if (page.sources.includes('sitemap')) return `${status}; listed in the sitemap`;
  if (page.linkedFrom.length > 0) {
    const more = page.linkedFrom.length > 1 ? ` and ${page.linkedFrom.length - 1} more` : '';
    return `${status}; linked from ${page.linkedFrom[0]}${more}`;
  }
  return `${status}; an article in the CMS`;
}

/** The eight health checks from the latest crawl, inspections and speed tests. */
export function summarizeHealth(input: {
  contentHost: string;
  crawledAt: Date | null;
  truncated: boolean;
  pages: CrawlPageRow[];
  inspections: InspectionRow[];
  speeds: SpeedRow[];
  pagespeedConfigured: boolean;
}): TechnicalHealth {
  const crawled = input.crawledAt !== null;
  const pages = [...input.pages].sort((a, b) => visibility(a) - visibility(b));
  const html = pages.filter(isHtmlPage);
  const crawledUrls = new Set(pages.map((page) => page.url));
  const inspections = input.inspections.filter((row) => crawledUrls.has(row.url));
  const notCrawled = 'Runs every Sunday with the site-crawl job.';

  const broken = crawled
    ? pages.filter((page) => page.status === 0 || page.status >= 400).map((page) => ({ url: page.url, note: brokenNote(page) }))
    : null;

  const index =
    inspections.length === 0
      ? null
      : [
          ...inspections
            .filter((row) => row.verdict !== 'PASS')
            .map((row) => ({ url: row.url, note: row.coverageState ?? row.verdict })),
          ...html
            .filter((page) => page.noindex && page.sources.includes('sitemap'))
            .map((page) => ({ url: page.url, note: 'Has a noindex tag but is listed in the sitemap' })),
        ];

  const metadata = crawled
    ? html
        .filter((page) => !page.title || !page.description)
        .map((page) => ({
          url: page.url,
          note: !page.title && !page.description ? 'No title and no meta description' : !page.title ? 'No title' : 'No meta description',
        }))
    : null;

  const byTitle = new Map<string, CrawlPageRow[]>();
  for (const page of html) {
    if (!page.title) continue;
    const key = page.title.trim().toLowerCase();
    byTitle.set(key, [...(byTitle.get(key) ?? []), page]);
  }
  const duplicateTitles = crawled
    ? [...byTitle.values()]
        .filter((group) => group.length > 1)
        .flatMap((group) =>
          group.map((page) => ({
            url: page.url,
            note: `Same title as ${group.length - 1} other page${group.length === 2 ? '' : 's'}: "${page.title}"`,
          })),
        )
    : null;

  const altText = crawled
    ? html
        .filter((page) => page.imagesMissingAlt > 0)
        .map((page) => ({
          url: page.url,
          note: `${page.imagesMissingAlt} image${page.imagesMissingAlt === 1 ? '' : 's'} without alt text`,
        }))
    : null;

  const canonical = crawled
    ? [
        ...html.filter((page) => !page.canonical).map((page) => ({ url: page.url, note: 'No canonical tag' })),
        ...html
          .filter((page) => page.canonical && !sameUrl(page.canonical, page.url))
          .map((page) => ({ url: page.url, note: `Canonical points to ${page.canonical}` })),
        ...inspections
          .filter((row) => row.googleCanonical && row.userCanonical && !sameUrl(row.googleCanonical, row.userCanonical))
          .map((row) => ({ url: row.url, note: `Google chose ${row.googleCanonical} as the canonical instead` })),
      ]
    : null;

  const schema = crawled
    ? html
        .filter((page) => page.jsonLd.length === 0 || page.jsonLd.includes('invalid'))
        .map((page) => ({ url: page.url, note: page.jsonLd.length === 0 ? 'No structured data' : 'Invalid JSON-LD block' }))
    : null;

  const slowPages =
    input.speeds.length === 0
      ? null
      : input.speeds
          .filter(isSlowPage)
          .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
          .map((row) => ({
            url: row.url,
            note: [
              row.score !== null ? `Mobile performance score ${Math.round(row.score * 100)}` : 'No performance score',
              row.lcpMs ? `largest content shows after ${(row.lcpMs / 1000).toFixed(1)} s` : null,
              row.fieldCategory === 'SLOW' ? 'real visitors find it slow' : null,
            ]
              .filter(Boolean)
              .join(', '),
          }));

  const latest = (dates: Date[]): string | null =>
    dates.length > 0 ? new Date(Math.max(...dates.map((date) => date.getTime()))).toISOString() : null;

  return {
    contentHost: input.contentHost,
    crawledAt: input.crawledAt?.toISOString() ?? null,
    pagesCrawled: input.pages.length,
    truncated: input.truncated,
    inspectedAt: latest(inspections.map((row) => row.inspectedAt)),
    pagespeedAt: latest(input.speeds.map((row) => row.checkedAt)),
    indexed:
      inspections.length > 0
        ? { indexed: inspections.filter((row) => row.verdict === 'PASS').length, inspected: inspections.length }
        : null,
    checks: [
      toCheck('index', index, crawled ? 'Runs every Sunday after the crawl, with the index-inspection job.' : notCrawled),
      toCheck('brokenLinks', broken, notCrawled),
      toCheck('metadata', metadata, notCrawled),
      toCheck('duplicateTitles', duplicateTitles, notCrawled),
      toCheck(
        'slowPages',
        slowPages,
        input.pagespeedConfigured ? 'Runs every Sunday with the pagespeed-check job.' : 'Needs PAGESPEED_API_KEY in .env.',
      ),
      toCheck('altText', altText, notCrawled),
      toCheck('canonical', canonical, notCrawled),
      toCheck('schema', schema, notCrawled),
    ],
  };
}
