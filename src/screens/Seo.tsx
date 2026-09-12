import { RangeToggle } from '../components/RangeToggle';
import { Card, Chip } from '../components/primitives';
import {
  ACTION_CENTER,
  CANNIBALIZATION,
  KEYWORD_DIST,
  KEYWORD_TRACKER,
  SEO_KPIS,
  SEO_OPPORTUNITIES,
  TECH_HEALTH,
} from '../data/growth';
import type { ChartRange } from '../lib/chart';
import { visibilityPoints, visibilityPointsPrev } from '../lib/chart';
import {
  actionStatusTone,
  changeText,
  directionClass,
  healthTone,
  keywordStatusTone,
  priorityTone,
  severityTone,
} from '../lib/theme';

const DIST_TOTAL = KEYWORD_DIST.reduce((sum, band) => sum + band.count, 0);

export function Seo({
  chartRange,
  onChartRangeChange,
}: {
  chartRange: ChartRange;
  onChartRangeChange: (range: ChartRange) => void;
}) {
  return (
    <div>
      <div className="mb-24">
        <div className="page-title">SEO Intelligence</div>
        <div className="page-subtitle">
          Organic visibility, keyword performance and optimization opportunities
        </div>
      </div>

      <div className="kpi-strip kpi-strip--4 mb-28">
        {SEO_KPIS.map((kpi) => (
          <div className="kpi kpi--seo" key={kpi.label}>
            <div className="kpi__label">{kpi.label}</div>
            <div className="kpi__value">{kpi.value}</div>
            <div className="kpi__foot">
              <span className={`kpi__change ${directionClass(kpi.dir)}`}>
                {changeText(kpi.dir, kpi.change)}
              </span>
            </div>
          </div>
        ))}
      </div>

      <Card className="mb-24">
        <div className="card-head">
          <div className="card-title">Organic Visibility</div>
          <RangeToggle value={chartRange} onChange={onChartRangeChange} />
        </div>
        <svg viewBox="0 0 600 200" className="chart" role="img" aria-label="Organic visibility">
          <polyline points={visibilityPoints} fill="none" stroke="#2D6CDF" strokeWidth="2.5" />
          <polyline
            points={visibilityPointsPrev}
            fill="none"
            stroke="#B7C0CC"
            strokeWidth="2"
            strokeDasharray="4 4"
          />
        </svg>
      </Card>

      <div className="card card--table-wide mb-24">
        <div className="card-title card-title--inline">Keyword Tracker</div>
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th>KEYWORD</th>
                <th>CURRENT</th>
                <th>PAGE</th>
                <th>INTENT</th>
                <th>CLICKS</th>
                <th>IMPR.</th>
                <th>CTR</th>
                <th>OPP.</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {KEYWORD_TRACKER.map((row) => (
                <tr key={row.kw}>
                  <td className="cell-strong">{row.kw}</td>
                  <td>{row.cur}</td>
                  <td className="cell-text">{row.page}</td>
                  <td className="cell-muted">{row.intent}</td>
                  <td className="cell-text">{row.clicks}</td>
                  <td className="cell-text">{row.impr}</td>
                  <td className="cell-text">{row.ctr}</td>
                  <td className="cell-strong">{row.opp}</td>
                  <td>
                    <Chip tone={keywordStatusTone(row.status)}>{row.status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="split-2 mb-24">
        <Card className="card--md">
          <div className="card-title card-title--sm mb-16">Keyword Distribution</div>
          <div className="dist-bar">
            {KEYWORD_DIST.map((band) => (
              <div
                key={band.label}
                style={{
                  width: `${((band.count / DIST_TOTAL) * 100).toFixed(1)}%`,
                  background: band.color,
                }}
              />
            ))}
          </div>
          <div className="dist-legend">
            {KEYWORD_DIST.map((band) => (
              <div className="dist-legend__item" key={band.label}>
                <div className="dist-legend__dot" style={{ background: band.color }} />
                {band.label} ({band.count})
              </div>
            ))}
          </div>
        </Card>

        <Card className="card--md">
          <div className="card-title card-title--sm" style={{ marginBottom: 6 }}>
            Keyword Cannibalization
          </div>
          <div className="cannibal__kw">⚠ {CANNIBALIZATION.kw}</div>
          <div className="cannibal__label">COMPETING URLS</div>
          {CANNIBALIZATION.urls.map((url) => (
            <div className="cannibal__url" key={url}>
              {url}
            </div>
          ))}
          <div className="cannibal__rec">{CANNIBALIZATION.rec}</div>
        </Card>
      </div>

      <div className="mb-24">
        <div className="section-title">SEO Opportunities</div>
        <div className="opp-grid">
          {SEO_OPPORTUNITIES.map((item) => (
            <Card className="card--sm" key={item.title}>
              <div className="opp-card__title">{item.title}</div>
              <div className="opp-card__meta">Current position: {item.pos}</div>
              <div className="opp-card__meta">Impressions: {item.impr}</div>
              <div className="opp-card__chip">
                <Chip tone={severityTone(item.opp)}>{item.opp} Opportunity</Chip>
              </div>
              <div className="opp-card__action">{item.action}</div>
            </Card>
          ))}
        </div>
      </div>

      <div className="mb-24">
        <div className="section-title">Technical SEO Health</div>
        <div className="health-grid">
          {TECH_HEALTH.map((item) => (
            <div className="health-card" key={item.label}>
              <div className="health-card__label">{item.label}</div>
              <div className="health-card__row">
                <div className="health-card__count">{item.count}</div>
                <Chip tone={healthTone(item.severity)}>{item.severity}</Chip>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">SEO Action Center</div>
        <div className="card card--table">
          <div className="table-scroll">
            <table className="data-table data-table--compact data-table--pad">
              <thead>
                <tr>
                  <th>PRIORITY</th>
                  <th>ISSUE</th>
                  <th>KEYWORD</th>
                  <th>RECOMMENDED ACTION</th>
                  <th>IMPACT</th>
                  <th>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {ACTION_CENTER.map((row) => (
                  <tr key={`${row.priority}-${row.issue}`}>
                    <td>
                      <Chip tone={priorityTone(row.priority)}>{row.priority}</Chip>
                    </td>
                    <td className="cell-strong">{row.issue}</td>
                    <td className="cell-text">{row.kw}</td>
                    <td className="cell-text">{row.action}</td>
                    <td className="cell-text">{row.impact}</td>
                    <td>
                      <Chip tone={actionStatusTone(row.status)}>{row.status}</Chip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
