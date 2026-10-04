import { describe, expect, it } from 'vitest';
import { createInstagramClient } from './instagram';
import { MetaApiError } from './meta';

const app = { appId: '555', appSecret: 'shh' };
const now = new Date('2026-10-04T00:00:00Z');

describe('Instagram client', () => {
  it('asks Instagram for the business permissions', () => {
    const client = createInstagramClient({ graphVersion: 'v23.0' });
    const url = new URL(client.loginUrl(app, 'http://localhost/cb', 'st', ['instagram_business_basic']));
    expect(url.origin + url.pathname).toBe('https://www.instagram.com/oauth/authorize');
    expect(url.searchParams.get('scope')).toBe('instagram_business_basic');
    expect(url.searchParams.get('client_id')).toBe('555');
  });

  it('trades the code, without the trailing #_, for a 60-day token', async () => {
    const seen: string[] = [];
    const fetchImpl = (async (input: string, init?: RequestInit) => {
      seen.push(input);
      if (input.startsWith('https://api.instagram.com')) {
        expect(new URLSearchParams(String(init?.body)).get('code')).toBe('abc');
        return new Response(JSON.stringify({ access_token: 'short', user_id: 1 }));
      }
      expect(new URL(input).searchParams.get('access_token')).toBe('short');
      return new Response(JSON.stringify({ access_token: 'long', expires_in: 5_184_000 }));
    }) as typeof fetch;
    const client = createInstagramClient({ graphVersion: 'v23.0', fetchImpl, now: () => now });

    const token = await client.exchangeCode(app, 'http://localhost/cb', 'abc#_');
    expect(token).toEqual({ accessToken: 'long', expiresAt: new Date('2026-12-03T00:00:00Z') });
    expect(seen).toHaveLength(2);
  });

  it("reads the account's own id, so it matches the id a Facebook Page reports", async () => {
    const fetchImpl = (async () =>
      new Response(
        JSON.stringify({ id: 'app-scoped', user_id: '17841400000', username: 'tsicertification', followers_count: 850 }),
      )) as unknown as typeof fetch;
    const client = createInstagramClient({ graphVersion: 'v23.0', fetchImpl });
    expect(await client.profile('token')).toEqual({
      id: '17841400000',
      username: 'tsicertification',
      name: null,
      pictureUrl: null,
      followers: 850,
    });
  });

  it('reports a rejected login code with Instagram’s message', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error_type: 'OAuthException', code: 400, error_message: 'Invalid authorization code' }), {
        status: 400,
      })) as unknown as typeof fetch;
    const client = createInstagramClient({ graphVersion: 'v23.0', fetchImpl });
    const error = await client.exchangeCode(app, 'http://localhost/cb', 'bad').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(MetaApiError);
    expect((error as Error).message).toBe('Instagram: Invalid authorization code');
  });
});
