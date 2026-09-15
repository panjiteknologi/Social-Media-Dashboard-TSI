import { extractPageSignals, internalUrl, type PageSignals } from './html';

/** Where the crawler learned of a page. */
export type PageSource = 'home' | 'sitemap' | 'cms' | 'search' | 'link';

export interface CrawlSeed {
  url: string;
  source: PageSource;
}

export interface CrawledPage {
  url: string;
  sources: PageSource[];
  /** HTTP status; 0 when the request itself failed. */
  status: number;
  redirectTo: string | null;
  contentType: string | null;
  responseMs: number;
  /** Signals of an HTML page that returned 200; null otherwise. */
  signals: Omit<PageSignals, 'links'> | null;
  /** A few of the pages that link here. */
  linkedFrom: string[];
  error: string | null;
}

const MAX_LINKED_FROM = 5;

/**
 * Checks the seed pages and every page they link to on the same host, one
 * request at a time so the website never notices. Redirects are not followed
 * automatically: each hop is recorded, and its target checked as its own page.
 */
export async function crawlSite(options: {
  host: string;
  seeds: CrawlSeed[];
  maxPages: number;
  userAgent: string;
  delayMs?: number;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<{ pages: CrawledPage[]; truncated: boolean }> {
  const { host, maxPages, userAgent } = options;
  const fetchImpl = options.fetchImpl ?? fetch;
  const delayMs = options.delayMs ?? 250;
  const timeoutMs = options.timeoutMs ?? 20_000;
  const base = `https://${host}/`;

  const known = new Map<string, { sources: Set<PageSource>; linkedFrom: Set<string> }>();
  const order: string[] = [];
  const enqueue = (href: string, source: PageSource, from?: string) => {
    const url = internalUrl(href, from ?? base, host);
    if (!url) return;
    let entry = known.get(url);
    if (!entry) {
      entry = { sources: new Set(), linkedFrom: new Set() };
      known.set(url, entry);
      order.push(url);
    }
    entry.sources.add(source);
    if (from && from !== url && entry.linkedFrom.size < MAX_LINKED_FROM) entry.linkedFrom.add(from);
  };
  for (const seed of options.seeds) enqueue(seed.url, seed.source);

  const results: Array<Omit<CrawledPage, 'sources' | 'linkedFrom'>> = [];
  for (let index = 0; index < order.length && index < maxPages; index++) {
    const url = order[index];
    if (index > 0 && delayMs > 0) await new Promise((resolve) => setTimeout(resolve, delayMs));

    const started = Date.now();
    const result: Omit<CrawledPage, 'sources' | 'linkedFrom'> = {
      url,
      status: 0,
      redirectTo: null,
      contentType: null,
      responseMs: 0,
      signals: null,
      error: null,
    };
    try {
      const response = await fetchImpl(url, {
        redirect: 'manual',
        headers: { 'User-Agent': userAgent, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      result.status = response.status;
      result.contentType = response.headers.get('content-type');
      const location = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && location) {
        result.redirectTo = new URL(location, url).href;
        enqueue(result.redirectTo, 'link', url);
      }
      if (response.status === 200 && result.contentType?.includes('text/html')) {
        const { links, ...signals } = extractPageSignals(await response.text(), url);
        result.signals = signals;
        for (const href of links) enqueue(href, 'link', url);
      } else {
        await response.body?.cancel().catch(() => undefined);
      }
    } catch (error) {
      result.error = error instanceof Error ? error.message : String(error);
    }
    result.responseMs = Date.now() - started;
    results.push(result);
  }

  // Sources and referrers are read at the end: a page can be linked from pages checked after it.
  const pages = results.map((result) => {
    const entry = known.get(result.url);
    return { ...result, sources: [...(entry?.sources ?? [])], linkedFrom: [...(entry?.linkedFrom ?? [])] };
  });
  return { pages, truncated: order.length > maxPages };
}
