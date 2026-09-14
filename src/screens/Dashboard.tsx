import { RangeToggle } from '../components/RangeToggle';
import { KpiBody, Requires } from '../components/Requires';
import { Card } from '../components/primitives';
import {
  AGENT_ACTIVITY,
  AI_OPPORTUNITIES,
  ATTENTION_CONTENT,
  DASHBOARD_KPIS,
  KEYWORD_MOVEMENTS,
  TOP_CONTENT,
  UPCOMING_CONTENT,
} from '../data/editorial';
import type { ChartRange } from '../lib/chart';
import { visibilityArea, visibilityPoints } from '../lib/chart';
import {
  changeText,
  directionClass,
  movementText,
  severityTone,
  statusTextStyle,
  toneStyle,
} from '../lib/theme';

export function Dashboard({
  chartRange,
  onChartRangeChange,
}: {
  chartRange: ChartRange;
  onChartRangeChange: (range: ChartRange) => void;
}) {
  return (
    <div>
      <div className="mb-28">
        <div className="page-title page-title--lg">Dashboard Overview</div>
        <div className="page-subtitle page-subtitle--lg">Content, SEO &amp; Social Intelligence</div>
      </div>

      <div className="kpi-strip kpi-strip--4 mb-32">
        {DASHBOARD_KPIS.map((kpi) => (
          <div className="kpi" key={kpi.label}>
            <div className="kpi__label">{kpi.label}</div>
            <KpiBody
              capability={kpi.capability}
              value={kpi.value}
              foot={
                <div className="kpi__foot">
                  <span className={`kpi__change ${directionClass(kpi.dir)}`}>
                    {changeText(kpi.dir, kpi.change)}
                  </span>
                  <span className="kpi__period">{kpi.period}</span>
                </div>
              }
            />
          </div>
        ))}
      </div>

      <div className="dash-grid">
        <div className="col-stack">
          <Card>
            <div className="card-head">
              <div className="card-title">SEO Visibility Trend</div>
              <RangeToggle value={chartRange} onChange={onChartRangeChange} />
            </div>
            <Requires capability="gsc" tall>
              <svg viewBox="0 0 600 200" className="chart" role="img" aria-label="SEO visibility trend">
                <polyline points={visibilityPoints} fill="none" stroke="#2D6CDF" strokeWidth="2.5" />
                <polygon points={visibilityArea} fill="#2D6CDF" opacity="0.08" />
              </svg>
            </Requires>
          </Card>

          <Card>
            <div className="card-title mb-16">Keyword Movements</div>
            <Requires capability="gsc">
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Keyword</th>
                      <th>Current</th>
                      <th>Previous</th>
                      <th>Movement</th>
                      <th>Intent</th>
                      <th>Landing Page</th>
                    </tr>
                  </thead>
                  <tbody>
                    {KEYWORD_MOVEMENTS.map((row) => (
                      <tr key={row.kw}>
                        <td className="cell-strong">{row.kw}</td>
                        <td>#{row.cur}</td>
                        <td className="cell-faint">#{row.prev}</td>
                        <td>
                          <span
                            className={
                              row.dir === 'flat'
                                ? 'kpi__change flat-faint'
                                : `kpi__change ${directionClass(row.dir)}`
                            }
                          >
                            {movementText(row.dir, row.move)}
                          </span>
                        </td>
                        <td className="cell-muted">{row.intent}</td>
                        <td className="cell-link">{row.page}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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
                {ATTENTION_CONTENT.map((item) => (
                  <div className="attention-row" key={item.title}>
                    <div className="attention-row__title">{item.title}</div>
                    <div className="attention-row__reason">{item.reason}</div>
                  </div>
                ))}
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
