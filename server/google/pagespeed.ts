export interface PagespeedResult {
  /** Lighthouse mobile performance score, 0–1. */
  score: number | null;
  lcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  /** Chrome UX Report rating from real visitors (FAST, AVERAGE, SLOW), when Google has enough of them. */
  fieldCategory: string | null;
}

interface RunPagespeedResponse {
  lighthouseResult?: {
    categories?: { performance?: { score?: number } };
    audits?: Record<string, { numericValue?: number }>;
  };
  loadingExperience?: { overall_category?: string };
  error?: { message?: string };
}

const numberOrNull = (value: unknown): number | null => (typeof value === 'number' ? value : null);

/** One mobile performance test through the PageSpeed Insights API. A test takes 10–30 seconds. */
export async function runPagespeed(url: string, apiKey: string, fetchImpl: typeof fetch = fetch): Promise<PagespeedResult> {
  const params = new URLSearchParams({ url, key: apiKey, strategy: 'mobile', category: 'performance' });
  const response = await fetchImpl(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`, {
    signal: AbortSignal.timeout(120_000),
  });
  const body = (await response.json().catch(() => null)) as RunPagespeedResponse | null;
  if (!response.ok) {
    throw new Error(`PageSpeed request failed (${response.status}): ${body?.error?.message ?? 'no details'}`);
  }
  const audits = body?.lighthouseResult?.audits ?? {};
  return {
    score: numberOrNull(body?.lighthouseResult?.categories?.performance?.score),
    lcpMs: numberOrNull(audits['largest-contentful-paint']?.numericValue),
    cls: numberOrNull(audits['cumulative-layout-shift']?.numericValue),
    tbtMs: numberOrNull(audits['total-blocking-time']?.numericValue),
    fieldCategory: body?.loadingExperience?.overall_category ?? null,
  };
}
