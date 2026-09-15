import type { Period } from '../../shared/content';
import { formatDate } from './format';
import { SCREEN_PATHS } from './routes';

/** Checklist score styling: most checks passing reads as good, fewer than half as poor. */
export function seoScoreClass(score: number): string {
  if (score >= 80) return 'seo-score seo-score--good';
  if (score < 50) return 'seo-score seo-score--poor';
  return 'seo-score';
}

/** "16 Aug – 12 Sep 2026", or "14 Sep 2026" for a single day. */
export const periodText = (period: Period): string =>
  period.start === period.end
    ? formatDate(period.end)
    : `${formatDate(period.start, false)} – ${formatDate(period.end)}`;

/** Link to an article's drawer on the Articles screen. */
export const articleHref = (slug: string): string => `${SCREEN_PATHS.articles}?article=${encodeURIComponent(slug)}`;
