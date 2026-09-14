import type { SeoKeywords, SeoOverview } from '../../shared/seo';
import { useSeoKeywords, useSeoOverview } from '../api/seo';
import { QueryState } from '../components/QueryState';
import { RangeToggle } from '../components/RangeToggle';
import { KpiBody, Requires } from '../components/Requires';
import { ChangeFoot, DataThrough } from '../components/SeoParts';
import { SeoTrendChart } from '../components/TrendChart';
import { Card } from '../components/primitives';
import {
  AGENT_ACTIVITY,
  AI_OPPORTUNITIES,
  DASHBOARD_KPIS,
  TOP_CONTENT,
  UPCOMING_CONTENT,
} from '../data/editorial';
import { overviewPeriod, type ChartRange } from '../lib/chart';
import {
  countChange,
  displayPage,
  formatNumber,
  formatPosition,
  percentChange,
  type Change,
} from '../lib/format';
import {
  changeText,
  directionClass,
  movementText,
  severityTone,
  statusTextStyle,
  toneStyle,
} from '../lib/theme';
import type { Kpi } from '../types';

/** The two dashboard KPIs Search Console answers; the rest wait for their own sources. */
function searchKpi(
  kpi: Kpi,
  range: ChartRange,
  overview: SeoOverview | undefined,
  keywords: SeoKeywords | undefined,
): { value: string; change: Change | null; period: string } | null {
  if (kpi.label === 'SEO Visibility') {
    if (!overview) return { value: '…', change: null, period: '' };
    const { current, previous } = overview.totals;
    return {
      value: formatNumber(current.impressions),
      change: percentChange(current.impressions, previous?.impressions ?? null),
      period: `impressions, ${overviewPeriod(overview, range)}`,
    };
  }
  if (kpi.label === 'Keywords in Top 10') {
    if (!keywords) return { value: '…', change: null, period: '' };
    return {
      value: String(keywords.counts.top10.current),
      change: countChange(keywords.counts.top10.current, keywords.counts.top10.previous),
      period: 'last 28 days',
    };
  }
  return null;
}

function KeywordMovements({ data }: { data: SeoKeywords }) {
  if (data.movements.length === 0) {
    return (
      <div className="empty-note">
        No keyword moved two or more positions between the last two 28-day periods.
      </div>
    );
  }
  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Current</th>
            <th>Previous</th>
            <th>Movement</th>
            <th>Cluster</th>
            <th>Landing Page</th>
          </tr>
        </thead>
        <tbody>
          {data.movements.map((row) => {
            const movement = row.movement ?? 0;
            return (
              <tr key={row.query}>
                <td className="cell-strong">{row.query}</td>
                <td>{formatPosition(row.position)}</td>
                <td className="cell-faint">{formatPosition(row.previousPosition)}</td>
                <td>
                  <span className={`kpi__change ${directionClass(movement > 0 ? 'up' : 'down')}`}>
                    {movementText(movement > 0 ? 'up' : 'down', Number(Math.abs(movement).toFixed(1)))}
                  </span>
                </td>
                <td className="cell-muted">{row.cluster}</td>
                <td className="cell-link">
                  {row.landingPage ? displayPage(row.landingPage, data.settings.contentHost) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Attention({ data }: { data: SeoKeywords }) {
  if (data.attention.length === 0) {
    return <div className="empty-note">No page needs attention in the last 28 days.</div>;
  }
  return (
    <>
      {data.attention.map((item) => (
        <div className="attention-row" key={`${item.page}-${item.reason}`}>
          <div className="attention-row__main">
            <div className="attention-row__title">{displayPage(item.page, data.settings.contentHost)}</div>
            <div className="attention-row__detail">{item.detail}</div>
          </div>
          <div className="attention-row__reason">{item.reason}</div>
        </div>
      ))}
    </>
  );
}

export function Dashboard({
  chartRange,
  onChartRangeChange,
}: {
  chartRange: ChartRange;
  onChartRangeChange: (range: ChartRange) => void;
}) {
  const overview = useSeoOverview(chartRange);
  const keywords = useSeoKeywords();

  return (
    <div>
      <div className="mb-28">
        <div className="page-title page-title--lg">Dashboard Overview</div>
        <div className="page-subtitle page-subtitle--lg">Content, SEO &amp; Social Intelligence</div>
        <DataThrough date={overview.data?.dataThrough ?? null} />
      </div>

      <div className="kpi-strip kpi-strip--4 mb-32">
        {DASHBOARD_KPIS.map((kpi) => {
          const search = searchKpi(kpi, chartRange, overview.data, keywords.data);
          return (
            <div className="kpi" key={kpi.label}>
              <div className="kpi__label">{kpi.label}</div>
              <KpiBody
                capability={kpi.capability}
                value={search ? search.value : kpi.value}
                foot={
                  search ? (
                    <ChangeFoot change={search.change} period={search.period} />
                  ) : (
                    <div className="kpi__foot">
                      <span className={`kpi__change ${directionClass(kpi.dir)}`}>{changeText(kpi.dir, kpi.change)}</span>
                      <span className="kpi__period">{kpi.period}</span>
                    </div>
                  )
                }
              />
            </div>
          );
        })}
      </div>

      <div className="dash-grid">
        <div className="col-stack">
          <Card>
            <div className="card-head">
              <div className="card-title">SEO Visibility Trend</div>
              <RangeToggle value={chartRange} onChange={onChartRangeChange} />
            </div>
            <Requires capability="gsc" tall>
              <QueryState query={overview} tall>
                {(data) => <SeoTrendChart overview={data} dimmed={overview.isPlaceholderData} />}
              </QueryState>
            </Requires>
          </Card>

          <Card>
            <div className="card-title mb-16">Keyword Movements</div>
            <Requires capability="gsc">
              <QueryState query={keywords}>{(data) => <KeywordMovements data={data} />}</QueryState>
            </Requires>
          </Card>

          <div className="split-2">
            <Card>
              <div className="card-title mb-14">Top Performing Content</div>
              <Requires capability="ga4">
                {TOP_CONTENT.map((item) => (
                  <div className="list-row" key={item.title}>
                    <div className="list-row__title">{item.title}</div>
                    <div className="list-row__meta">
                      <span>Traffic {item.traffic}</span>
                      <span>Rank {item.pos}</span>
                      <span>CTR {item.ctr}</span>
                      <span>Leads {item.leads}</span>
                    </div>
                  </div>
                ))}
              </Requires>
            </Card>

            <Card>
              <div className="card-title mb-14">Content Requiring Attention</div>
              <Requires capability="gsc">
                <QueryState query={keywords}>{(data) => <Attention data={data} />}</QueryState>
              </Requires>
            </Card>
          </div>
        </div>

        <div className="col-stack">
          <Card className="card--md">
            <div className="card-title card-title--sm mb-14">AI Opportunities</div>
            <Requires capability="ai">
              {AI_OPPORTUNITIES.map((item) => (
                <div className="opportunity" key={item.insight}>
                  <div className="opportunity__head">
                    <span>{item.icon}</span>
                    <span className="opportunity__category">{item.category}</span>
                    <span className="chip" style={toneStyle(severityTone(item.priority))}>
                      {item.priority}
                    </span>
                  </div>
                  <div className="opportunity__insight">{item.insight}</div>
                  <div className="opportunity__action">{item.action}</div>
                  <button type="button" className="link-cta">
                    {item.cta} →
                  </button>
                </div>
              ))}
            </Requires>
          </Card>

          <Card className="card--md">
            <div className="card-title card-title--sm mb-14">Upcoming Content</div>
            <Requires capability="content">
              {UPCOMING_CONTENT.map((item) => (
                <div className="upcoming" key={item.title}>
                  <div className="upcoming__head">
                    <div className="upcoming__title">{item.title}</div>
                    <div className="upcoming__date">{item.date}</div>
                  </div>
                  <div className="upcoming__meta">
                    <span>{item.channel}</span>
                    <span>·</span>
                    <span>{item.owner}</span>
                    <span>·</span>
                    <span style={statusTextStyle(item.status)}>{item.status}</span>
                  </div>
                </div>
              ))}
            </Requires>
          </Card>

          <Card className="card--md">
            <div className="card-title card-title--sm mb-14">Recent Agent Activity</div>
            <Requires capability="ai">
              {AGENT_ACTIVITY.map((item) => (
                <div className="activity" key={item.text}>
                  <div className="activity__dot" />
                  <div>
                    <div className="activity__agent">{item.agent}</div>
                    <div className="activity__text">{item.text}</div>
                    <div className="activity__time">{item.time}</div>
                  </div>
                </div>
              ))}
            </Requires>
          </Card>
        </div>
      </div>
    </div>
  );
}
