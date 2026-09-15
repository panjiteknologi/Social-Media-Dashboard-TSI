/** Technical SEO health of the website, from the weekly crawl, URL Inspection and PageSpeed. */

export const HEALTH_CHECK_KEYS = [
  'index',
  'brokenLinks',
  'metadata',
  'duplicateTitles',
  'slowPages',
  'altText',
  'canonical',
  'schema',
] as const;

export type HealthCheckKey = (typeof HEALTH_CHECK_KEYS)[number];

export type HealthSeverity = 'High' | 'Medium' | 'Low';

export interface HealthIssue {
  url: string;
  note: string;
}

export interface HealthCheck {
  key: HealthCheckKey;
  label: string;
  state: 'ok' | 'issues' | 'not_checked';
  /** Pages with the issue. */
  count: number;
  /** How much the issue matters when it occurs. */
  severity: HealthSeverity;
  /** Why the check has not run, when it has not. */
  note: string;
  /** The first affected pages, most visible first. */
  issues: HealthIssue[];
}

export interface TechnicalHealth {
  contentHost: string;
  /** When the latest crawl finished; null before the first one. */
  crawledAt: string | null;
  pagesCrawled: number;
  /** True when the crawl stopped at its page limit. */
  truncated: boolean;
  inspectedAt: string | null;
  pagespeedAt: string | null;
  /** Sitemap pages Google has indexed, out of those inspected; null before the first inspection. */
  indexed: { indexed: number; inspected: number } | null;
  checks: HealthCheck[];
}
