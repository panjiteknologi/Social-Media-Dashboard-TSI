import type { Change } from '../lib/format';
import { formatDate } from '../lib/format';
import { changeText, directionClass } from '../lib/theme';

/** A KPI footer: the change, when there is something to compare with, and what it covers. */
export function ChangeFoot({ change, period }: { change: Change | null; period: string }) {
  return (
    <div className="kpi__foot">
      {change ? (
        <span className={`kpi__change ${directionClass(change.dir)}`}>{changeText(change.dir, change.text)}</span>
      ) : null}
      <span className="kpi__period">{period}</span>
    </div>
  );
}

/** How fresh the search numbers are. Google finalises each day about three days late. */
export function DataThrough({ date }: { date: string | null }) {
  if (!date) return null;
  return <div className="data-through">Search Console data through {formatDate(date)}, updated every morning</div>;
}
