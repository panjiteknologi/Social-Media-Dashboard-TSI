import { Bar, Card } from '../components/primitives';
import {
  ACQUISITION,
  ANALYTICS_TOP,
  CAMPAIGN_PERFORMANCE,
  CONTENT_PERFORMANCE,
  FUNNEL,
  SOCIAL_PERFORMANCE,
} from '../data/growth';

const parseCount = (value: string): number => Number(value.replace(/,/g, ''));

const FUNNEL_MAX = parseCount(FUNNEL[0].value);

export function Analytics() {
  return (
    <div>
      <div className="mb-24">
        <div className="page-title">Analytics</div>
        <div className="page-subtitle">Unified content, SEO and social performance</div>
      </div>

      <div className="kpi-strip kpi-strip--6 mb-28">
        {ANALYTICS_TOP.map((kpi) => (
          <div className="kpi kpi--analytics" key={kpi.label}>
            <div className="kpi__label">{kpi.label}</div>
            <div className="kpi__value">{kpi.value}</div>
            <div className="kpi__change">{kpi.change}</div>
          </div>
        ))}
      </div>

      <div className="split-2 mb-24">
        <Card className="card--md">
          <div className="card-title card-title--sm mb-16">Acquisition Overview</div>
          {ACQUISITION.map((channel) => (
            <div className="meter" key={channel.label}>
              <div className="meter__head">
                <span>{channel.label}</span>
                <strong>{channel.pct}%</strong>
              </div>
              <Bar size="md" pct={channel.pct} color={channel.color} />
            </div>
          ))}
        </Card>

        <Card className="card--md">
          <div className="card-title card-title--sm mb-16">Conversion Funnel</div>
          {FUNNEL.map((stage) => (
            <div className="funnel-step" key={stage.label}>
              <div className="funnel-step__head">
                <span>{stage.label}</span>
                <strong>{stage.value}</strong>
              </div>
              {/* Narrow stages keep a 6% floor so the label stays readable. */}
              <Bar size="thick" pct={Math.max(6, (parseCount(stage.value) / FUNNEL_MAX) * 100)} />
            </div>
          ))}
        </Card>
      </div>

      <div className="card card--table-wide mb-24">
        <div className="card-title card-title--inline">Content Performance</div>
        <div className="table-scroll">
          <table className="data-table data-table--compact data-table--rows">
            <thead>
              <tr>
                <th>CONTENT</th>
                <th>TRAFFIC</th>
                <th>ENGAGEMENT</th>
                <th>RANKING</th>
                <th>CONVERSIONS</th>
                <th>LEADS</th>
                <th>TREND</th>
              </tr>
            </thead>
            <tbody>
              {CONTENT_PERFORMANCE.map((row) => (
                <tr key={row.title}>
                  <td className="cell-strong">{row.title}</td>
                  <td className="cell-text">{row.traffic}</td>
                  <td className="cell-text">{row.engagement}</td>
                  <td className="cell-text">{row.rank}</td>
                  <td className="cell-text">{row.conv}</td>
                  <td className="cell-text">{row.leads}</td>
                  <td>
                    <span className={row.trend === 'up' ? 'up' : 'down'} style={{ fontWeight: 700 }}>
                      {row.trend === 'up' ? '↑' : '↓'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="mb-24">
        <div className="section-title">Social Performance</div>
        <div className="platform-grid">
          {SOCIAL_PERFORMANCE.map((item) => (
            <Card className="card--sm" key={item.platform}>
              <div className="platform-card__name">{item.platform}</div>
              <div className="platform-card__stats">
                <div>
                  Reach
                  <div className="platform-card__stat-value">{item.reach}</div>
                </div>
                <div>
                  Impressions
                  <div className="platform-card__stat-value">{item.impr}</div>
                </div>
                <div>
                  Engagement
                  <div className="platform-card__stat-value">{item.engagement}</div>
                </div>
                <div>
                  CTR
                  <div className="platform-card__stat-value">{item.ctr}</div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">Campaign Performance</div>
        <div className="card card--table">
          <div className="table-scroll">
            <table className="data-table data-table--compact data-table--pad">
              <thead>
                <tr>
                  <th>CAMPAIGN</th>
                  <th>CONTENT CREATED</th>
                  <th>TRAFFIC</th>
                  <th>ENGAGEMENT</th>
                  <th>LEADS</th>
                  <th>CONV. RATE</th>
                </tr>
              </thead>
              <tbody>
                {CAMPAIGN_PERFORMANCE.map((row) => (
                  <tr key={row.name}>
                    <td className="cell-strong">{row.name}</td>
                    <td className="cell-text">{row.created}</td>
                    <td className="cell-text">{row.traffic}</td>
                    <td className="cell-text">{row.engagement}</td>
                    <td className="cell-text">{row.leads}</td>
                    <td className="cell-text">{row.conv}</td>
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
