import type { ScreenKey } from '../types';

/**
 * URL path for each screen. Dashboard owns the app root.
 *
 * Screens are addressable so the team can bookmark, refresh and share links
 * ("look at this keyword") instead of re-navigating from the dashboard.
 */
export const SCREEN_PATHS: Record<ScreenKey, string> = {
  dashboard: '/',
  planner: '/planner',
  articles: '/articles',
  social: '/social',
  seo: '/seo',
  analytics: '/analytics',
  approval: '/approval',
  reports: '/reports',
  media: '/media',
  workflow: '/workflow',
  settings: '/settings',
};

/**
 * The URL-addressable key for an article, taken from its published path.
 *
 * Using the slug rather than a row index keeps a shared link pointing at the
 * same article after the table is re-sorted or the list grows.
 */
export const articleSlug = (article: { url: string }): string =>
  article.url.split('/').filter(Boolean).pop() ?? article.url;
