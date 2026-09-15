export const ANALYTICS_SCOPE = 'https://www.googleapis.com/auth/analytics.readonly';

/** Rows per report request; larger results are paged. */
export const GA4_ROW_LIMIT = 10_000;

export interface Ga4ReportRequest {
  startDate: string;
  endDate: string;
  /** GA4 API names, such as "date" or "sessionDefaultChannelGroup". */
  dimensions: string[];
  metrics: string[];
  /** Keep only rows for these events. */
  eventNames?: readonly string[];
}

export interface Ga4Row {
  /** One value per requested dimension, in request order. */
  dimensions: string[];
  /** One value per requested metric, in request order. */
  metrics: number[];
}

export interface AnalyticsClient {
  report(request: Ga4ReportRequest): Promise<Ga4Row[]>;
}

/** GA4 reports dates as YYYYMMDD. */
export const ga4Date = (value: string): string => `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`;

interface RunReportResponse {
  rows?: Array<{ dimensionValues?: Array<{ value?: string }>; metricValues?: Array<{ value?: string }> }>;
  rowCount?: number;
  error?: { message?: string };
}

/** A client for the GA4 Data API's runReport, for one property. */
export function createAnalyticsClient(options: {
  propertyId: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}): AnalyticsClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  const endpoint = `https://analyticsdata.googleapis.com/v1beta/properties/${encodeURIComponent(options.propertyId)}:runReport`;

  async function fetchPage(request: Ga4ReportRequest, offset: number): Promise<{ rows: Ga4Row[]; rowCount: number }> {
    const body = {
      dateRanges: [{ startDate: request.startDate, endDate: request.endDate }],
      dimensions: request.dimensions.map((name) => ({ name })),
      metrics: request.metrics.map((name) => ({ name })),
      limit: GA4_ROW_LIMIT,
      offset,
      ...(request.eventNames
        ? { dimensionFilter: { filter: { fieldName: 'eventName', inListFilter: { values: [...request.eventNames] } } } }
        : {}),
    };
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${await options.getToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = (await response.json().catch(() => null)) as RunReportResponse | null;
    if (!response.ok) {
      throw new Error(`GA4 request failed (${response.status}): ${json?.error?.message ?? 'no details'}`);
    }
    return {
      rows: (json?.rows ?? []).map((row) => ({
        dimensions: (row.dimensionValues ?? []).map((value) => value.value ?? ''),
        metrics: (row.metricValues ?? []).map((value) => Number(value.value ?? 0)),
      })),
      rowCount: json?.rowCount ?? 0,
    };
  }

  return {
    /** Every row for the request, following pagination. */
    async report(request) {
      const rows: Ga4Row[] = [];
      for (let offset = 0; ; offset += GA4_ROW_LIMIT) {
        const page = await fetchPage(request, offset);
        rows.push(...page.rows);
        if (page.rows.length < GA4_ROW_LIMIT || rows.length >= page.rowCount) return rows;
      }
    },
  };
}
