import type { Env } from '../env';
import { ANALYTICS_SCOPE, createAnalyticsClient, type AnalyticsClient } from './analytics';
import { createSearchConsoleClient, SEARCH_CONSOLE_SCOPE, type SearchConsoleClient } from './searchConsole';
import {
  createTokenProvider,
  readServiceAccountKey,
  serviceAccountKeyFromValue,
  type ServiceAccountKey,
} from './serviceAccount';
import { createUrlInspectionClient, type UrlInspectionClient } from './urlInspection';

const KEY_SETTINGS = 'GOOGLE_SERVICE_ACCOUNT_JSON (or GOOGLE_SERVICE_ACCOUNT_JSON_PATH)';

const hasGoogleKey = (env: Env): boolean =>
  Boolean(env.GOOGLE_SERVICE_ACCOUNT_JSON || env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH);

/** The service account key from the variable holding it, or else from the file it points at. */
function googleKey(env: Env): ServiceAccountKey {
  if (env.GOOGLE_SERVICE_ACCOUNT_JSON) return serviceAccountKeyFromValue(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  return readServiceAccountKey(env.GOOGLE_SERVICE_ACCOUNT_JSON_PATH!);
}

export const isSearchConsoleConfigured = (env: Env): boolean => Boolean(env.GSC_SITE_URL && hasGoogleKey(env));

export function searchConsoleFromEnv(env: Env): SearchConsoleClient {
  if (!env.GSC_SITE_URL || !hasGoogleKey(env)) {
    throw new Error(`Search Console is not configured: set GSC_SITE_URL and ${KEY_SETTINGS}.`);
  }
  return createSearchConsoleClient({
    siteUrl: env.GSC_SITE_URL,
    getToken: createTokenProvider(googleKey(env), [SEARCH_CONSOLE_SCOPE]),
  });
}

export function urlInspectionFromEnv(env: Env): UrlInspectionClient {
  if (!env.GSC_SITE_URL || !hasGoogleKey(env)) {
    throw new Error(`Search Console is not configured: set GSC_SITE_URL and ${KEY_SETTINGS}.`);
  }
  return createUrlInspectionClient({
    siteUrl: env.GSC_SITE_URL,
    getToken: createTokenProvider(googleKey(env), [SEARCH_CONSOLE_SCOPE]),
  });
}

export function analyticsFromEnv(env: Env): AnalyticsClient {
  if (!env.GA4_PROPERTY_ID || !hasGoogleKey(env)) {
    throw new Error(`GA4 is not configured: set GA4_PROPERTY_ID and ${KEY_SETTINGS}.`);
  }
  return createAnalyticsClient({
    propertyId: env.GA4_PROPERTY_ID,
    getToken: createTokenProvider(googleKey(env), [ANALYTICS_SCOPE]),
  });
}
