/**
 * The small part of Meta's Graph API that connecting accounts and recording
 * followers need: Facebook Login, the Pages a person manages, and each Page's
 * linked Instagram professional account.
 */

export interface MetaAppCredentials {
  appId: string;
  appSecret: string;
  /** Facebook Login for Business configuration; replaces the scope list when set. */
  loginConfigId: string | null;
}

/** An error Graph returned, with Meta's code so callers can tell a dead token from a busy API. */
export class MetaApiError extends Error {
  readonly code: number | null;
  readonly subcode: number | null;

  constructor(message: string, code: number | null, subcode: number | null) {
    super(message);
    this.name = 'MetaApiError';
    this.code = code;
    this.subcode = subcode;
  }

  /** The token expired, was revoked, or lost a permission: only connecting again fixes it. */
  get needsReconnect(): boolean {
    return this.code === 190 || this.code === 102 || (this.code !== null && this.code >= 200 && this.code < 300);
  }
}

export interface FoundInstagram {
  id: string;
  username: string;
  pictureUrl: string | null;
  followers: number | null;
}

export interface FoundPage {
  id: string;
  name: string;
  pictureUrl: string | null;
  followers: number | null;
  /** The Page's own token: Instagram calls use it too. */
  accessToken: string;
  instagram: FoundInstagram | null;
}

const INSTAGRAM_FIELDS = 'id,username,profile_picture_url,followers_count';
const PAGE_FIELDS = 'id,name,followers_count,fan_count,picture{url}';
const PAGE_WITH_INSTAGRAM_FIELDS = `${PAGE_FIELDS},instagram_business_account{${INSTAGRAM_FIELDS}}`;

interface RawInstagram {
  id: string;
  username?: string;
  profile_picture_url?: string;
  followers_count?: number;
}

interface RawPage {
  id: string;
  name?: string;
  access_token?: string;
  followers_count?: number;
  fan_count?: number;
  picture?: { data?: { url?: string } };
  instagram_business_account?: RawInstagram;
}

const toInstagram = (raw: RawInstagram | undefined): FoundInstagram | null =>
  raw
    ? {
        id: raw.id,
        username: raw.username ?? raw.id,
        pictureUrl: raw.profile_picture_url ?? null,
        followers: raw.followers_count ?? null,
      }
    : null;

export const toFoundPage = (raw: RawPage, fallbackToken: string): FoundPage => ({
  id: raw.id,
  name: raw.name ?? raw.id,
  pictureUrl: raw.picture?.data?.url ?? null,
  // Followers is what the Page shows publicly; likes (fan_count) is the older number.
  followers: raw.followers_count ?? raw.fan_count ?? null,
  accessToken: raw.access_token ?? fallbackToken,
  instagram: toInstagram(raw.instagram_business_account),
});

export function createMetaClient({ graphVersion, fetchImpl = fetch }: { graphVersion: string; fetchImpl?: typeof fetch }) {
  const graph = `https://graph.facebook.com/${graphVersion}`;

  async function get<T>(url: string): Promise<T> {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(20_000) });
    const body = (await response.json().catch(() => null)) as
      | (T & { error?: { message?: string; code?: number; error_subcode?: number } })
      | null;
    if (!response.ok || !body || body.error) {
      const error = body?.error;
      throw new MetaApiError(
        `Meta: ${error?.message ?? `${response.status} ${response.statusText}`}`,
        error?.code ?? null,
        error?.error_subcode ?? null,
      );
    }
    return body;
  }

  const withParams = (path: string, params: Record<string, string>) => {
    const url = new URL(path.startsWith('http') ? path : `${graph}${path}`);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    return url.toString();
  };

  return {
    /** Where "Continue with Facebook" sends the browser. */
    loginUrl(app: MetaAppCredentials, redirectUri: string, state: string, permissions: readonly string[]): string {
      const url = new URL(`https://www.facebook.com/${graphVersion}/dialog/oauth`);
      url.searchParams.set('client_id', app.appId);
      url.searchParams.set('redirect_uri', redirectUri);
      url.searchParams.set('state', state);
      url.searchParams.set('response_type', 'code');
      if (app.loginConfigId) url.searchParams.set('config_id', app.loginConfigId);
      else url.searchParams.set('scope', permissions.join(','));
      return url.toString();
    },

    /**
     * Trades the login code for a long-lived user token. Page tokens read
     * through a long-lived user token do not expire, so nobody has to
     * reconnect every 60 days.
     */
    async exchangeCode(app: MetaAppCredentials, redirectUri: string, code: string): Promise<string> {
      const short = await get<{ access_token: string }>(
        withParams('/oauth/access_token', {
          client_id: app.appId,
          client_secret: app.appSecret,
          redirect_uri: redirectUri,
          code,
        }),
      );
      const long = await get<{ access_token: string }>(
        withParams('/oauth/access_token', {
          grant_type: 'fb_exchange_token',
          client_id: app.appId,
          client_secret: app.appSecret,
          fb_exchange_token: short.access_token,
        }),
      );
      return long.access_token;
    },

    /**
     * Every Page the token can manage, with its linked Instagram account.
     * Accepts a user or system user token, or a single Page's own token.
     */
    async discoverPages(accessToken: string): Promise<FoundPage[]> {
      const list = async (fields: string): Promise<FoundPage[]> => {
        const pages: FoundPage[] = [];
        try {
          let next: string | undefined = withParams('/me/accounts', {
            fields: `${fields},access_token`,
            limit: '100',
            access_token: accessToken,
          });
          while (next) {
            const page: { data: RawPage[]; paging?: { next?: string } } = await get(next);
            pages.push(...page.data.map((raw) => toFoundPage(raw, accessToken)));
            next = page.paging?.next;
          }
          return pages;
        } catch (error) {
          // A Page token is a Page, which has no "accounts": read the Page itself.
          if (!(error instanceof MetaApiError) || error.code !== 100) throw error;
          const raw = await get<RawPage>(withParams('/me', { fields, access_token: accessToken }));
          return [toFoundPage(raw, accessToken)];
        }
      };
      try {
        return await list(PAGE_WITH_INSTAGRAM_FIELDS);
      } catch (error) {
        // An app without Instagram permissions on Facebook Login cannot read the
        // linked account; the Pages still connect, and Instagram has its own login.
        if (!(error instanceof MetaApiError)) throw error;
        return list(PAGE_FIELDS);
      }
    },

    async pageFollowers(pageId: string, accessToken: string) {
      const raw = await get<RawPage>(
        withParams(`/${pageId}`, { fields: PAGE_FIELDS, access_token: accessToken }),
      );
      return toFoundPage(raw, accessToken);
    },

    async instagramFollowers(instagramId: string, accessToken: string): Promise<FoundInstagram> {
      const raw = await get<RawInstagram>(withParams(`/${instagramId}`, { fields: INSTAGRAM_FIELDS, access_token: accessToken }));
      return toInstagram(raw)!;
    },
  };
}

export type MetaClient = ReturnType<typeof createMetaClient>;
