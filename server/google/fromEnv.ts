import type { Env } from '../env';
import { createSearchConsoleClient, SEARCH_CONSOLE_SCOPE, type SearchConsoleClient } from './searchConsole';
import { createTokenProvider, readServiceAccountKey } from './serviceAccount';

export const isSearchConsoleConfigured = (env: Env): boolean =>
  Boolean(env.GSC_SITE_URL && env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH);

export function searchConsoleFromEnv(env: Env): SearchConsoleClient {
  if (!env.GSC_SITE_URL || !env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH) {
    throw new Error('Search Console is not configured: set GSC_SITE_URL and GOOGLE_SERVICE_ACCOUNT_JSON_PATH in .env.');
  }
  const key = readServiceAccountKey(env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH);
  return createSearchConsoleClient({
    siteUrl: env.GSC_SITE_URL,
    getToken: createTokenProvider(key, [SEARCH_CONSOLE_SCOPE]),
  });
}
