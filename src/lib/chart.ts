/**
 * Visibility trend series.
 *
 * The design draws a deterministic, seeded sine-plus-drift curve rather than
 * real analytics data — reproduced here so the chart matches the mock exactly.
 * Coordinates are in the SVG's 600x200 viewBox.
 */

const POINT_COUNT = 13;
const X_STEP = 50;
const BASELINE_Y = 180;
const PLOT_HEIGHT = 150;

function series(seed: number): Array<[x: number, y: number]> {
  const raw: number[] = [];
  for (let i = 0; i < POINT_COUNT; i++) {
    raw.push(Math.sin(i * 0.7 + seed) * 30 + i * 4.5 + seed * 5);
  }
  const min = Math.min(...raw);
  const max = Math.max(...raw);
  const range = max - min || 1;
  return raw.map((n, i) => [i * X_STEP, BASELINE_Y - ((n - min) / range) * PLOT_HEIGHT]);
}

const toPoints = (pts: Array<[number, number]>): string =>
  pts.map(([x, y]) => `${x},${y.toFixed(1)}`).join(' ');

const current = series(1);

/** Current-period polyline. */
export const visibilityPoints = toPoints(current);

/** Same curve closed against the baseline, for the shaded area fill. */
export const visibilityArea = `${visibilityPoints} 600,195 0,195`;

/** Previous-period comparison line, offset down and clamped inside the plot. */
export const visibilityPointsPrev = toPoints(
  series(0.2).map(([x, y]) => [x, Math.min(190, y + 20)]),
);

export const CHART_RANGES = ['30D', '90D', '6M', '1Y'] as const;

export type ChartRange = (typeof CHART_RANGES)[number];
