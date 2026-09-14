import { describe, expect, it } from 'vitest';
import { createSearchConsoleClient, SEARCH_CONSOLE_ROW_LIMIT } from './searchConsole';

const row = (i: number) => ({ keys: [`q${i}`], clicks: 0, impressions: 1, position: 1 });

describe('Search Console client', () => {
  it('follows pagination until a short page', async () => {
    const startRows: number[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      const { startRow } = JSON.parse(String(init.body));
      startRows.push(startRow);
      const count = startRow === 0 ? SEARCH_CONSOLE_ROW_LIMIT : 3;
      return new Response(JSON.stringify({ rows: Array.from({ length: count }, (_, i) => row(i)) }));
    }) as typeof fetch;

    const client = createSearchConsoleClient({
      siteUrl: 'sc-domain:example.com',
      getToken: async () => 'token',
      fetchImpl,
    });
    const rows = await client.query({ startDate: '2026-09-01', endDate: '2026-09-02', dimensions: ['query'] });

    expect(rows).toHaveLength(SEARCH_CONSOLE_ROW_LIMIT + 3);
    expect(startRows).toEqual([0, SEARCH_CONSOLE_ROW_LIMIT]);
  });

  it('treats a response without rows as no data', async () => {
    const fetchImpl = (async () => new Response(JSON.stringify({}))) as typeof fetch;
    const client = createSearchConsoleClient({ siteUrl: 'sc-domain:example.com', getToken: async () => 't', fetchImpl });
    expect(await client.query({ startDate: '2026-09-01', endDate: '2026-09-01', dimensions: ['date'] })).toEqual([]);
  });

  it('surfaces the API error message', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: { message: 'User does not have sufficient permission' } }), {
        status: 403,
      })) as typeof fetch;
    const client = createSearchConsoleClient({ siteUrl: 'sc-domain:example.com', getToken: async () => 't', fetchImpl });
    await expect(
      client.query({ startDate: '2026-09-01', endDate: '2026-09-01', dimensions: ['date'] }),
    ).rejects.toThrow(/sufficient permission/);
  });
});
