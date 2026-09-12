import { CHART_RANGES, type ChartRange } from '../lib/chart';

export function RangeToggle({
  value,
  onChange,
}: {
  value: ChartRange;
  onChange: (range: ChartRange) => void;
}) {
  return (
    <div className="range-toggle" role="group" aria-label="Chart range">
      {CHART_RANGES.map((range) => (
        <button
          key={range}
          type="button"
          aria-pressed={value === range}
          onClick={() => onChange(range)}
        >
          {range}
        </button>
      ))}
    </div>
  );
}
