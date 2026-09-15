/** Google's index status for one URL of a Search Console property. */
export interface IndexInspection {
  /** PASS, PARTIAL, FAIL or NEUTRAL. */
  verdict: string;
  coverageState: string | null;
  indexingState: string | null;
  pageFetchState: string | null;
  robotsTxtState: string | null;
  googleCanonical: string | null;
  userCanonical: string | null;
  lastCrawlTime: string | null;
}

export interface UrlInspectionClient {
  inspect(url: string): Promise<IndexInspection>;
}

interface InspectResponse {
  inspectionResult?: { indexStatusResult?: Partial<Record<keyof IndexInspection, string>> };
  error?: { message?: string };
}

/**
 * The URL Inspection API. It reports the version in Google's index, not a live
 * test, and allows 2,000 inspections a day per property.
 */
export function createUrlInspectionClient(options: {
  siteUrl: string;
  getToken: () => Promise<string>;
  fetchImpl?: typeof fetch;
}): UrlInspectionClient {
  const fetchImpl = options.fetchImpl ?? fetch;
  return {
    async inspect(url) {
      const response = await fetchImpl('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST',
        headers: { Authorization: `Bearer ${await options.getToken()}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionUrl: url, siteUrl: options.siteUrl }),
      });
      const body = (await response.json().catch(() => null)) as InspectResponse | null;
      if (!response.ok) {
        throw new Error(`URL Inspection failed (${response.status}): ${body?.error?.message ?? 'no details'}`);
      }
      const result = body?.inspectionResult?.indexStatusResult ?? {};
      return {
        verdict: result.verdict ?? 'VERDICT_UNSPECIFIED',
        coverageState: result.coverageState ?? null,
        indexingState: result.indexingState ?? null,
        pageFetchState: result.pageFetchState ?? null,
        robotsTxtState: result.robotsTxtState ?? null,
        googleCanonical: result.googleCanonical ?? null,
        userCanonical: result.userCanonical ?? null,
        lastCrawlTime: result.lastCrawlTime ?? null,
      };
    },
  };
}
