import { CHART_RANGES, type ChartRange, type SeoOverview } from '../../shared/seo';
import { formatDate } from './format';

export { CHART_RANGES };
export type { ChartRange };

export const RANGE_LABELS: Record<ChartRange, string> = {
  '30D': '30 days',
  '90D': '90 days',
  '6M': '6 months',
  '1Y': '12 months',
};

/** What a range's totals are compared with, for the caption under a KPI. */
export function overviewPeriod(overview: SeoOverview, range: ChartRange): string {
  if (overview.totals.previous) return `vs previous ${RANGE_LABELS[range]}`;
  const clipped = overview.shownFrom && overview.window && overview.shownFrom > overview.window.start;
  return clipped && overview.shownFrom ? `since ${formatDate(overview.shownFrom)}` : `last ${RANGE_LABELS[range]}`;
}
