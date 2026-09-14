export const SEARCH_CONSOLE_SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly';

/** The most rows Search Console returns per request; larger results are paged. */
export const SEARCH_CONSOLE_ROW_LIMIT = 25_000;

export type SearchDimension = 'date' | 'query' | 'page';

export interface SearchAnalyticsRequest {
  startDate: string;
  endDate: string;
  dimensions: SearchDimension[];
}

export interface SearchAnalyticsRow {
  /** One value per requested dimension, in request order. */
  keys: string[];
  clicks: number;
  impressions: number;
  position: number;
}

export interface SearchConsoleClient {
  query(request: SearchAnalyticsRequest): Promise<SearchAnalyticsRow[]>;
}

export function createSearchConsoleClient(options: {
  siteUrl: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}): SearchConsoleClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(options.siteUrl)}/searchAnalytics/query`;

  async function fetchPage(request: SearchAnalyticsRequest, startRow: number): Promise<SearchAnalyticsRow[]> {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await options.getToken()}`, 'Content-Type': 'application/json' },
      // Web search only. Without dataState, Google returns final data, so the
      // newest two or three days appear only once they stop changing.
      body: JSON.stringify({ ...request, type: 'web', rowLimit: SEARCH_CONSOLE_ROW_LIMIT, startRow }),
    });
    const body = (await response.json().catch(() => null)) as {
      rows?: SearchAnalyticsRow[];
      error?: { message?: string };
    } | null;
    if (!response.ok) {
      throw new Error(`Search Console request failed (${response.status}): ${body?.error?.message ?? 'no details'}`);
    }
    return body?.rows ?? [];
  }

  return {
    /** Every row for the request, following pagination. */
    async query(request) {
      const rows: SearchAnalyticsRow[] = [];
      for (let startRow = 0; ; startRow += SEARCH_CONSOLE_ROW_LIMIT) {
        const page = await fetchPage(request, startRow);
        rows.push(...page);
        if (page.length < SEARCH_CONSOLE_ROW_LIMIT) return rows;
      }
    },
  };
}
