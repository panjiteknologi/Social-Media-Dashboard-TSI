import type { AnalyticsOverview } from '../../shared/content';
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

/** The same caption for GA4 totals, which start on the first tracked day. */
export function trafficPeriod(overview: AnalyticsOverview): string {
  if (!overview.period) return '';
  if (overview.totals.previous) return `vs previous ${RANGE_LABELS[overview.range]}`;
  return overview.period.start === overview.dataSince
    ? `since ${formatDate(overview.period.start)}`
    : `last ${RANGE_LABELS[overview.range]}`;
}

/** The same caption for the lead count, which starts on the first lead. */
export function leadsPeriod(overview: AnalyticsOverview): string {
  const { leads } = overview;
  if (leads.previous !== null) return `vs previous ${RANGE_LABELS[overview.range]}`;
  return leads.since && leads.period.start === leads.since
    ? `since ${formatDate(leads.since)}`
    : `last ${RANGE_LABELS[overview.range]}`;
}
