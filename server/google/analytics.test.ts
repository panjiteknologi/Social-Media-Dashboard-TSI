import { describe, expect, it, vi } from 'vitest';
import { createAnalyticsClient, GA4_ROW_LIMIT, ga4Date } from './analytics';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const row = (date: string, sessions: number) => ({
  dimensionValues: [{ value: date }, { value: 'Organic Search' }],
  metricValues: [{ value: String(sessions) }, { value: '30.5' }],
});

function clientWith(...responses: Response[]) {
  const fetchImpl = vi.fn(async (_url: string, _init?: RequestInit) => responses.shift() ?? json({}));
  const client = createAnalyticsClient({
    propertyId: '495912713',
    getToken: async () => 'token',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, fetchImpl };
}

const request = {
  startDate: '2026-09-14',
  endDate: '2026-09-15',
  dimensions: ['date', 'sessionDefaultChannelGroup'],
  metrics: ['sessions', 'userEngagementDuration'],
};

describe('createAnalyticsClient', () => {
  it('sends a runReport request and parses dimensions and metrics', async () => {
    const { client, fetchImpl } = clientWith(json({ rowCount: 1, rows: [row('20260914', 39)] }));

    const rows = await client.report({ ...request, eventNames: ['generate_lead'] });

    expect(rows).toEqual([{ dimensions: ['20260914', 'Organic Search'], metrics: [39, 30.5] }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/495912713:runReport');
    expect(init?.headers).toMatchObject({ Authorization: 'Bearer token' });
    const body = JSON.parse(String(init?.body));
    expect(body.dateRanges).toEqual([{ startDate: '2026-09-14', endDate: '2026-09-15' }]);
    expect(body.dimensions).toEqual([{ name: 'date' }, { name: 'sessionDefaultChannelGroup' }]);
    expect(body.dimensionFilter.filter).toEqual({ fieldName: 'eventName', inListFilter: { values: ['generate_lead'] } });
    expect(body.offset).toBe(0);
  });

  it('follows pagination until every row is fetched', async () => {
    const fullPage = Array.from({ length: GA4_ROW_LIMIT }, () => row('20260914', 1));
    const { client, fetchImpl } = clientWith(
      json({ rowCount: GA4_ROW_LIMIT + 1, rows: fullPage }),
      json({ rowCount: GA4_ROW_LIMIT + 1, rows: [row('20260915', 2)] }),
    );

    const rows = await client.report(request);

    expect(rows).toHaveLength(GA4_ROW_LIMIT + 1);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(fetchImpl.mock.calls[1][1]?.body)).offset).toBe(GA4_ROW_LIMIT);
  });

  it('returns no rows for a period without data', async () => {
    const { client } = clientWith(json({ rowCount: 0 }));
    expect(await client.report(request)).toEqual([]);
  });

  it("reports Google's error message", async () => {
    const { client } = clientWith(json({ error: { message: 'User does not have sufficient permissions' } }, 403));
    await expect(client.report(request)).rejects.toThrow(
      'GA4 request failed (403): User does not have sufficient permissions',
    );
  });
});

describe('ga4Date', () => {
  it('turns YYYYMMDD into an ISO date', () => {
    expect(ga4Date('20260914')).toBe('2026-09-14');
  });
});
