import type { Env } from '../env';
import { ANALYTICS_SCOPE, createAnalyticsClient, type AnalyticsClient } from './analytics';
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

export function analyticsFromEnv(env: Env): AnalyticsClient {
  if (!env.GA4_PROPERTY_ID || !env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH) {
    throw new Error('GA4 is not configured: set GA4_PROPERTY_ID and GOOGLE_SERVICE_ACCOUNT_JSON_PATH in .env.');
  }
  const key = readServiceAccountKey(env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH);
  return createAnalyticsClient({
    propertyId: env.GA4_PROPERTY_ID,
    getToken: createTokenProvider(key, [ANALYTICS_SCOPE]),
  });
}
