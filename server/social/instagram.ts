/**
 * Instagram API with Instagram Login: an Instagram professional account
 * connects on its own, with no Facebook Page in between.
 *
 * Its tokens last 60 days and can be renewed once they are a day old, so the
 * daily sync renews them and nobody has to log in again while it runs.
 */
import { MetaApiError } from './meta';

export interface InstagramAppCredentials {
  appId: string;
  appSecret: string;
}

export interface InstagramProfile {
  id: string;
  username: string;
  name: string | null;
  pictureUrl: string | null;
  followers: number | null;
}

export interface InstagramToken {
  accessToken: string;
  expiresAt: Date;
}

const PROFILE_FIELDS = 'user_id,username,name,profile_picture_url,followers_count';

interface RawProfile {
  id: string;
  user_id?: string | number;
  username?: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
}

export const toProfile = (raw: RawProfile): InstagramProfile => ({
  // user_id is the professional account's own id, the same one a Facebook Page
  // reports, so one account connected both ways stays one row.
  id: String(raw.user_id ?? raw.id),
  username: raw.username ?? String(raw.user_id ?? raw.id),
  name: raw.name ?? null,
  pictureUrl: raw.profile_picture_url ?? null,
  followers: raw.followers_count ?? null,
});

export function createInstagramClient({
  graphVersion,
  fetchImpl = fetch,
  now = () => new Date(),
}: {
  graphVersion: string;
  fetchImpl?: typeof fetch;
  now?: () => Date;
}) {
  async function call<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetchImpl(url, { ...init, signal: AbortSignal.timeout(20_000) });
    const body = (await response.json().catch(() => null)) as
      | (T & {
          error?: { message?: string; code?: number; error_subcode?: number } | string;
          error_message?: string;
          code?: number;
        })
      | null;
    if (!response.ok || !body || body.error) {
      // Graph errors are an object; the login endpoint answers with error_message and a code.
      const error = typeof body?.error === 'object' ? body.error : undefined;
      const message = error?.message ?? body?.error_message ?? `${response.status} ${response.statusText}`;
      throw new MetaApiError(`Instagram: ${message}`, error?.code ?? body?.code ?? null, error?.error_subcode ?? null);
    }
    return body;
  }

  const toToken = (raw: { access_token: string; expires_in?: number }): InstagramToken => ({
    accessToken: raw.access_token,
    // Instagram says 60 days; assume that if it leaves the number out.
    expiresAt: new Date(now().getTime() + (raw.expires_in ?? 60 * 24 * 3600) * 1000),
  });

  return {
    loginUrl(app: InstagramAppCredentials, redirectUri: string, state: string, permissions: readonly string[]): string {
      const url = new URL('https://www.instagram.com/oauth/authorize');
      url.searchParams.set('client_id', app.appId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('response_type', 'code');
      url.searchParams.set('scope', permissions.join(','));
      url.searchParams.set('state', state);
      return url.toString();
    },

    /** Trades the login code for a 60-day token. */
    async exchangeCode(app: InstagramAppCredentials, redirectUri: string, code: string): Promise<InstagramToken> {
      const short = await call<{ access_token?: string; data?: Array<{ access_token: string }> }>(
        'https://api.instagram.com/oauth/access_token',
        {
          method: 'POST',
          body: new URLSearchParams({
            client_id: app.appId,
            client_secret: app.appSecret,
            grant_type: 'authorization_code',
            redirect_uri: redirectUri,
            // Instagram appends "#_" to the code in the redirect; it is not part of it.
            code: code.replace(/#_$/, ''),
          }),
        },
      );
      const shortToken = short.access_token ?? short.data?.[0]?.access_token;
      if (!shortToken) throw new MetaApiError('Instagram: the login returned no token.', null, null);

      const url = new URL('https://graph.instagram.com/access_token');
      url.searchParams.set('grant_type', 'ig_exchange_token');
      url.searchParams.set('client_secret', app.appSecret);
      url.searchParams.set('access_token', shortToken);
      return toToken(await call(url.toString()));
    },

    /** Renews a token for another 60 days. It must be at least a day old and not yet expired. */
    async refreshToken(accessToken: string): Promise<InstagramToken> {
      const url = new URL('https://graph.instagram.com/refresh_access_token');
      url.searchParams.set('grant_type', 'ig_refresh_token');
      url.searchParams.set('access_token', accessToken);
      return toToken(await call(url.toString()));
    },

    async profile(accessToken: string): Promise<InstagramProfile> {
      const url = new URL(`https://graph.instagram.com/${graphVersion}/me`);
      url.searchParams.set('fields', PROFILE_FIELDS);
      url.searchParams.set('access_token', accessToken);
      return toProfile(await call(url.toString()));
    },
  };
}

export type InstagramClient = ReturnType<typeof createInstagramClient>;
