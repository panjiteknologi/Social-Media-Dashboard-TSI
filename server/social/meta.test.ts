import { describe, expect, it } from 'vitest';
import { createMetaClient, MetaApiError } from './meta';

/** Answers each request with the first route whose path matches, and records the URLs asked for. */
function fakeGraph(routes: Array<[RegExp, number, unknown]>) {
  const calls: URL[] = [];
  const fetchImpl = (async (input: string | URL) => {
    const url = new URL(String(input));
    calls.push(url);
    const route = routes.find(([pattern]) => pattern.test(url.pathname));
    if (!route) throw new Error(`Unexpected request ${url}`);
    return new Response(JSON.stringify(route[2]), { status: route[1] });
  }) as typeof fetch;
  return { calls, client: createMetaClient({ graphVersion: 'v23.0', fetchImpl }) };
}

const app = { appId: '123', appSecret: 'shh', loginConfigId: null };

describe('Meta client', () => {
  it('asks for the permissions directly, or for the Login for Business configuration', () => {
    const { client } = fakeGraph([]);
    const plain = new URL(client.loginUrl(app, 'http://localhost/cb', 'st', ['pages_show_list', 'instagram_basic']));
    expect(plain.searchParams.get('scope')).toBe('pages_show_list,instagram_basic');
    expect(plain.searchParams.get('config_id')).toBeNull();

    const configured = new URL(client.loginUrl({ ...app, loginConfigId: '999' }, 'http://localhost/cb', 'st', ['x']));
    expect(configured.searchParams.get('config_id')).toBe('999');
    expect(configured.searchParams.get('scope')).toBeNull();
  });

  it('trades the login code for a long-lived token', async () => {
    let step = 0;
    const fetchImpl = (async (input: string) => {
      const url = new URL(input);
      step++;
      if (step === 1) expect(url.searchParams.get('code')).toBe('the-code');
      if (step === 2) expect(url.searchParams.get('fb_exchange_token')).toBe('short');
      return new Response(JSON.stringify({ access_token: step === 1 ? 'short' : 'long' }));
    }) as typeof fetch;
    const client = createMetaClient({ graphVersion: 'v23.0', fetchImpl });
    expect(await client.exchangeCode(app, 'http://localhost/cb', 'the-code')).toBe('long');
  });

  it('lists Pages across result pages, each with its token and linked Instagram account', async () => {
    const { client } = fakeGraph([
      [
        /\/me\/accounts$/,
        200,
        {
          data: [
            {
              id: '1',
              name: 'TSI Sertifikasi',
              access_token: 'page-1',
              followers_count: 1200,
              fan_count: 1100,
              picture: { data: { url: 'https://img/1' } },
              instagram_business_account: { id: '17841', username: 'tsicertification', followers_count: 850 },
            },
          ],
          paging: { next: 'https://graph.facebook.com/v23.0/me/accounts/next' },
        },
      ],
      [/\/me\/accounts\/next$/, 200, { data: [{ id: '2', name: 'Other Page', access_token: 'page-2', fan_count: 40 }] }],
    ]);

    expect(await client.discoverPages('user-token')).toEqual([
      {
        id: '1',
        name: 'TSI Sertifikasi',
        pictureUrl: 'https://img/1',
        followers: 1200,
        accessToken: 'page-1',
        instagram: { id: '17841', username: 'tsicertification', pictureUrl: null, followers: 850 },
      },
      { id: '2', name: 'Other Page', pictureUrl: null, followers: 40, accessToken: 'page-2', instagram: null },
    ]);
  });

  it('reads the Page itself when given a Page token', async () => {
    const { client } = fakeGraph([
      [/\/me\/accounts$/, 400, { error: { message: '(#100) Tried accessing nonexisting field (accounts)', code: 100 } }],
      [/\/me$/, 200, { id: '1', name: 'TSI Sertifikasi', followers_count: 10 }],
    ]);
    const [page] = await client.discoverPages('page-token');
    expect(page).toMatchObject({ id: '1', accessToken: 'page-token', followers: 10 });
  });

  it('still lists the Pages when the app may not read their Instagram accounts', async () => {
    const fetchImpl = (async (input: string) => {
      const fields = new URL(input).searchParams.get('fields') ?? '';
      if (fields.includes('instagram_business_account')) {
        return new Response(JSON.stringify({ error: { message: '(#10) Requires instagram_basic', code: 10 } }), { status: 400 });
      }
      return new Response(JSON.stringify({ data: [{ id: '1', name: 'TSI Sertifikasi', access_token: 'page-1' }] }));
    }) as typeof fetch;
    const client = createMetaClient({ graphVersion: 'v23.0', fetchImpl });
    const pages = await client.discoverPages('user-token');
    expect(pages).toMatchObject([{ id: '1', accessToken: 'page-1', instagram: null }]);
  });

  it('marks an expired token as needing a reconnect, and a rate limit as not', async () => {
    const { client } = fakeGraph([[/\/1$/, 400, { error: { message: 'Session has expired', code: 190, error_subcode: 463 } }]]);
    const error = await client.pageFollowers('1', 'token').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MetaApiError);
    expect((error as MetaApiError).needsReconnect).toBe(true);
    expect(new MetaApiError('busy', 4, null).needsReconnect).toBe(false);
  });
});
