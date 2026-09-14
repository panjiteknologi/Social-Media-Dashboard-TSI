import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import { addDays, type SeoOverview, type SeriesPoint } from '../../shared/seo';
import { formatDate, formatNumber } from '../lib/format';

const WIDTH = 600;
const HEIGHT = 230;
const MARGIN = { top: 16, right: 18, bottom: 28, left: 48 };
const PLOT_WIDTH = WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom;

const CURRENT_COLOR = '#2D6CDF';
/** The comparison line is neutral and dashed, and dark enough for 3:1 contrast on the white card. */
const PREVIOUS_COLOR = '#667085';

/** A scale three clean steps high (1, 2, 2.5 or 5 × 10ⁿ each) that fits `max`. */
function niceScale(max: number): { top: number; ticks: number[] } {
  if (max <= 0) return { top: 3, ticks: [0, 1, 2, 3] };
  const rough = max / 3;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map((multiple) => multiple * magnitude).find((size) => size >= rough) ?? 10 * magnitude;
  return { top: step * 3, ticks: [0, step, step * 2, step * 3] };
}

function LineKey({ color, dashed = false }: { color: string; dashed?: boolean }) {
  return (
    <svg className="trend__line-key" width="16" height="8" aria-hidden="true">
      <line
        x1="1"
        y1="4"
        x2="15"
        y2="4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dashed ? '4 3' : undefined}
      />
    </svg>
  );
}

/** Impressions over the selected range, with the previous range dashed behind it when there is one. */
export function SeoTrendChart({ overview, dimmed = false }: { overview: SeoOverview; dimmed?: boolean }) {
  const [active, setActive] = useState<number | null>(null);
  const { current, previous, bucketDays } = overview.series;
  const end = overview.dataThrough;

  if (!end || current.length === 0) {
    return <div className="empty-note">No search data in this range yet.</div>;
  }

  const count = current.length;
  const comparison = previous && previous.length === count ? previous : null;
  const { top, ticks } = niceScale(
    Math.max(0, ...current.map((point) => point.impressions), ...(comparison ?? []).map((point) => point.impressions)),
  );

  const x = (index: number) => MARGIN.left + (count === 1 ? PLOT_WIDTH / 2 : (index / (count - 1)) * PLOT_WIDTH);
  const y = (value: number) => MARGIN.top + PLOT_HEIGHT - (value / top) * PLOT_HEIGHT;
  const baseline = y(0);
  const path = (points: SeriesPoint[]) =>
    points.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index).toFixed(1)},${y(point.impressions).toFixed(1)}`).join(' ');
  const area = `${path(current)} L${x(count - 1).toFixed(1)},${baseline} L${x(0).toFixed(1)},${baseline} Z`;

  const periodLabel = (points: SeriesPoint[], index: number, lastDay: string): string => {
    const first = points[index].start;
    if (bucketDays === 1) return formatDate(first);
    const last = index < points.length - 1 ? addDays(points[index + 1].start, -1) : lastDay;
    return `${formatDate(first, false)} – ${formatDate(last)}`;
  };
  const previousEnd = overview.window?.previousEnd ?? end;

  const pick = (event: PointerEvent<SVGRectElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = box.width > 0 ? (event.clientX - box.left) / box.width : 0;
    setActive(Math.max(0, Math.min(count - 1, Math.round(ratio * (count - 1)))));
  };

  const onKeyDown = (event: KeyboardEvent<SVGSVGElement>) => {
    const moves: Record<string, (index: number) => number> = {
      ArrowLeft: (index) => index - 1,
      ArrowRight: (index) => index + 1,
      Home: () => 0,
      End: () => count - 1,
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setActive((index) => Math.max(0, Math.min(count - 1, move(index ?? count - 1))));
  };

  const startClipped = overview.shownFrom !== null && overview.window !== null && overview.shownFrom > overview.window.start;
  const last = current[count - 1];
  const middle = Math.floor((count - 1) / 2);
  const total = current.reduce((sum, point) => sum + point.impressions, 0);
  const leftPercent = active === null ? 0 : (x(active) / WIDTH) * 100;
  const tooltipShift = leftPercent < 20 ? '0%' : leftPercent > 80 ? '-100%' : '-50%';

  return (
    <div className={dimmed ? 'trend trend--dimmed' : 'trend'}>
      <svg
        className="trend__svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="group"
        tabIndex={0}
        aria-label={`Impressions from ${formatDate(current[0].start)} to ${formatDate(end)}: ${formatNumber(total)} in total. Use the arrow keys to read each ${bucketDays === 1 ? 'day' : 'week'}.`}
        onKeyDown={onKeyDown}
        onFocus={() => setActive((index) => index ?? count - 1)}
        onBlur={() => setActive(null)}
      >
        {ticks.map((tick) => (
          <g key={tick}>
            <line className="trend__grid" x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(tick)} y2={y(tick)} />
            <text className="trend__tick" x={MARGIN.left - 8} y={y(tick)} textAnchor="end" dominantBaseline="middle">
              {formatNumber(tick)}
            </text>
          </g>
        ))}
        <text className="trend__tick" x={x(0)} y={HEIGHT - 8} textAnchor="start">
          {formatDate(current[0].start, false)}
        </text>
        {count >= 5 ? (
          <text className="trend__tick" x={x(middle)} y={HEIGHT - 8} textAnchor="middle">
            {formatDate(current[middle].start, false)}
          </text>
        ) : null}
        <text className="trend__tick" x={x(count - 1)} y={HEIGHT - 8} textAnchor="end">
          {formatDate(end, false)}
        </text>

        <path d={area} fill={CURRENT_COLOR} opacity={0.08} />
        {comparison ? (
          <path
            d={path(comparison)}
            fill="none"
            stroke={PREVIOUS_COLOR}
            strokeWidth={2}
            strokeDasharray="5 4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
        <path d={path(current)} fill="none" stroke={CURRENT_COLOR} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />

        {active === null ? (
          <>
            <circle cx={x(count - 1)} cy={y(last.impressions)} r={4} fill={CURRENT_COLOR} stroke="#fff" strokeWidth={2} />
            <text className="trend__end-label" x={x(count - 1) - 8} y={y(last.impressions) - 10} textAnchor="end">
              {formatNumber(last.impressions)}
            </text>
          </>
        ) : (
          <>
            <line className="trend__crosshair" x1={x(active)} x2={x(active)} y1={MARGIN.top} y2={baseline} />
            {comparison ? (
              <circle
                cx={x(active)}
                cy={y(comparison[active].impressions)}
                r={4}
                fill={PREVIOUS_COLOR}
                stroke="#fff"
                strokeWidth={2}
              />
            ) : null}
            <circle cx={x(active)} cy={y(current[active].impressions)} r={4} fill={CURRENT_COLOR} stroke="#fff" strokeWidth={2} />
          </>
        )}

        {/* Hit area over the whole plot: the crosshair snaps to the nearest bucket, so no one has to land on a 2px line. */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={PLOT_WIDTH}
          height={PLOT_HEIGHT}
          fill="transparent"
          onPointerMove={pick}
          onPointerDown={pick}
          onPointerLeave={() => setActive(null)}
        />
      </svg>

      {active !== null ? (
        <div
          className="trend__tooltip"
          style={{ left: `${leftPercent}%`, transform: `translateX(${tooltipShift})` }}
          role="status"
          aria-live="polite"
        >
          <div className="trend__tooltip-date">{periodLabel(current, active, end)}</div>
          <div className="trend__tooltip-row">
            <LineKey color={CURRENT_COLOR} />
            <strong>{formatNumber(current[active].impressions)}</strong>
            <span>impressions</span>
          </div>
          <div className="trend__tooltip-row">
            <span className="trend__key-spacer" />
            <strong>{formatNumber(current[active].clicks)}</strong>
            <span>clicks</span>
          </div>
          {comparison ? (
            <div className="trend__tooltip-row">
              <LineKey color={PREVIOUS_COLOR} dashed />
              <strong>{formatNumber(comparison[active].impressions)}</strong>
              <span>{periodLabel(comparison, active, previousEnd)}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      {comparison ? (
        <div className="trend__legend">
          <span className="trend__legend-item">
            <LineKey color={CURRENT_COLOR} />
            Impressions, this period
          </span>
          <span className="trend__legend-item">
            <LineKey color={PREVIOUS_COLOR} dashed />
            Previous period
          </span>
        </div>
      ) : null}

      {startClipped ? (
        <div className="trend__note">
          Search data is counted from {formatDate(overview.dataStartDate)}, when the site relaunched, so this range has
          no previous period to compare with.
        </div>
      ) : !comparison ? (
        <div className="trend__note">
          No previous period to compare with: it would reach back before {formatDate(overview.dataStartDate)}.
        </div>
      ) : null}

      <details className="trend-table">
        <summary>View as table</summary>
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th>{bucketDays === 1 ? 'DAY' : 'WEEK'}</th>
                <th>IMPRESSIONS</th>
                <th>CLICKS</th>
                {comparison ? <th>PREVIOUS PERIOD</th> : null}
              </tr>
            </thead>
            <tbody>
              {current.map((point, index) => (
                <tr key={point.start}>
                  <td className="cell-text">{periodLabel(current, index, end)}</td>
                  <td className="cell-text">{formatNumber(point.impressions)}</td>
                  <td className="cell-text">{formatNumber(point.clicks)}</td>
                  {comparison ? <td className="cell-muted">{formatNumber(comparison[index].impressions)}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
