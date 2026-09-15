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
