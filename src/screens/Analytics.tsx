import { Link } from 'react-router-dom';
import type { CapabilityKey } from '../../shared/capabilities';
import type { AnalyticsOverview, ArticlesResponse, TrafficTotals } from '../../shared/content';
import { useAnalyticsOverview, useArticles } from '../api/content';
import { QueryState } from '../components/QueryState';
import { KpiBody, Requires } from '../components/Requires';
import { ChangeFoot } from '../components/SeoParts';
import { Bar, Card } from '../components/primitives';
import { CAMPAIGN_PERFORMANCE, SOCIAL_PERFORMANCE } from '../data/growth';
import { leadsPeriod, trafficPeriod } from '../lib/chart';
import { articleHref, periodText } from '../lib/content';
import {
  countChange,
  formatDate,
  formatDateTime,
  formatDuration,
  formatNumber,
  formatPercent,
  formatPosition,
  percentChange,
  type Change,
} from '../lib/format';
import { changeText, directionClass } from '../lib/theme';

const RANGE = '30D';

interface Tile {
  label: string;
  capability: CapabilityKey;
  value: string;
  change: Change | null;
  period: string;
}

const perSession = (totals: TrafficTotals): number | null =>
  totals.sessions ? totals.engagementSeconds / totals.sessions : null;

const withPeriod = (what: string, period: string): string => [what, period].filter(Boolean).join(', ');

function AnalyticsKpis({ overview }: { overview: AnalyticsOverview | undefined }) {
  const loading = '…';
  const current = overview?.totals.current;
  const previous = overview?.totals.previous ?? null;
  const period = overview ? trafficPeriod(overview) : '';
  const count = (pick: (totals: TrafficTotals) => number) => ({
    value: current ? formatNumber(pick(current)) : loading,
    change: current ? percentChange(pick(current), previous ? pick(previous) : null) : null,
  });

  const engagementNow = current ? perSession(current) : null;
  const engagementBefore = previous ? perSession(previous) : null;

  const tiles: Tile[] = [
    { label: 'Organic Sessions', capability: 'ga4', ...count((t) => t.organicSessions), period },
    { label: 'Social Traffic', capability: 'ga4', ...count((t) => t.socialSessions), period: withPeriod('sessions', period) },
    { label: 'Conversions', capability: 'ga4', ...count((t) => t.leadEvents), period: withPeriod('lead events', period) },
    { label: 'CTA Clicks', capability: 'ga4', ...count((t) => t.ctaClicks), period },
    {
      label: 'Leads',
      capability: 'leads',
      value: overview ? formatNumber(overview.leads.current) : loading,
      change: overview ? countChange(overview.leads.current, overview.leads.previous) : null,
      period: overview ? withPeriod('contact form', leadsPeriod(overview)) : '',
    },
    {
      label: 'Content Engagement',
      capability: 'ga4',
      value: current ? formatDuration(engagementNow) : loading,
      change: engagementNow !== null && engagementBefore !== null ? percentChange(engagementNow, engagementBefore) : null,
      period: withPeriod('per session', period),
    },
  ];

  return (
    <div className="kpi-strip kpi-strip--6 mb-28">
      {tiles.map((tile) => (
        <div className="kpi kpi--analytics" key={tile.label}>
          <div className="kpi__label">{tile.label}</div>
          <KpiBody
            capability={tile.capability}
            value={tile.value}
            foot={<ChangeFoot change={tile.change} period={tile.period} />}
          />
        </div>
      ))}
    </div>
  );
}

function Acquisition({ data }: { data: AnalyticsOverview }) {
  if (!data.period || data.channels.length === 0) {
    return <div className="empty-note">No sessions were recorded in this period.</div>;
  }
  return (
    <>
      {data.channels.map((channel) => (
        <div className="meter" key={channel.channel}>
          <div className="meter__head">
            <span>{channel.channel}</span>
            <strong>
              {formatNumber(channel.sessions)} · {formatPercent(channel.share, 0)}
            </strong>
          </div>
          <Bar size="md" pct={channel.share * 100} />
        </div>
      ))}
      <div className="seo-caption seo-caption--below">
        {formatNumber(data.totals.current.sessions)} sessions, {periodText(data.period)}.
      </div>
    </>
  );
}

function Funnel({ data }: { data: AnalyticsOverview }) {
  if (!data.funnel) {
    return (
      <div className="empty-note">
        The funnel needs Search Console and GA4 data for the same days. Google finalises search data about three days
        late, so the funnel appears a few days after GA4 tracking started.
      </div>
    );
  }
  const top = data.funnel.stages[0]?.value ?? 0;
  return (
    <>
      {data.funnel.stages.map((stage) => (
        <div className="funnel-step" key={stage.label}>
          <div className="funnel-step__head">
            <span>{stage.label}</span>
            <strong>{formatNumber(stage.value)}</strong>
          </div>
          <Bar size="thick" pct={top > 0 && stage.value > 0 ? Math.max(1, (stage.value / top) * 100) : 0} />
        </div>
      ))}
      <div className="seo-caption seo-caption--below">Organic search only, {periodText(data.funnel)}.</div>
    </>
  );
}

function ContentPerformance({ data }: { data: ArticlesResponse }) {
  const rows = data.articles
    .filter((article) => article.traffic.sessions > 0 || article.search.clicks > 0)
    .sort((a, b) => b.traffic.sessions - a.traffic.sessions || b.search.clicks - a.search.clicks)
    .slice(0, 10);

  if (rows.length === 0) {
    return <div className="table-empty">No article had visits or search clicks in the last 28 days.</div>;
  }
  return (
    <>
      <div className="content-caption">
        Articles with the most visits.
        {data.trafficPeriod ? ` Sessions and leads: ${periodText(data.trafficPeriod)}.` : ''}
        {data.searchPeriod ? ` Position and clicks: ${periodText(data.searchPeriod)}.` : ''} Trend compares clicks
        with the 28 days before.
      </div>
      <div className="table-scroll">
        <table className="data-table data-table--compact data-table--rows">
          <thead>
            <tr>
              <th>CONTENT</th>
              <th>SESSIONS</th>
              <th>ENGAGEMENT</th>
              <th>POSITION</th>
              <th>CLICKS</th>
              <th>LEADS</th>
              <th>TREND</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((article) => {
              const trend = percentChange(article.search.clicks, article.search.previousClicks);
              return (
                <tr key={article.slug}>
                  <td className="cell-strong">
                    <Link className="table-link" to={articleHref(article.slug)}>
                      {article.title}
                    </Link>
                  </td>
                  <td className="cell-text">{formatNumber(article.traffic.sessions)}</td>
                  <td className="cell-text">
                    {formatDuration(article.traffic.sessions ? article.traffic.engagementSeconds / article.traffic.sessions : null)}
                  </td>
                  <td className="cell-text">
                    {article.search.impressions ? formatPosition(article.search.position) : '—'}
                  </td>
                  <td className="cell-text">{formatNumber(article.search.clicks)}</td>
                  <td className="cell-text">{formatNumber(article.traffic.leadEvents)}</td>
                  <td>
                    {trend ? (
                      <span className={`kpi__change ${directionClass(trend.dir)}`}>{changeText(trend.dir, trend.text)}</span>
                    ) : (
                      <span className="cell-faint">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Freshness({ overview }: { overview: AnalyticsOverview | undefined }) {
  if (!overview) return null;
  const parts: string[] = [];
  if (overview.dataSince && overview.dataThrough) {
    parts.push(`GA4 data since ${formatDate(overview.dataSince)}, through ${formatDate(overview.dataThrough)}.`);
  }
  if (overview.leads.syncedAt) parts.push(`Leads copied from the CMS ${formatDateTime(overview.leads.syncedAt)}.`);
  return parts.length > 0 ? <div className="data-through">{parts.join(' ')}</div> : null;
}

export function Analytics() {
  const overview = useAnalyticsOverview(RANGE);
  const articles = useArticles();

  return (
    <div>
      <div className="mb-24">
        <div className="page-title">Analytics</div>
        <div className="page-subtitle">Unified content, SEO and social performance</div>
        <Freshness overview={overview.data} />
      </div>

      <AnalyticsKpis overview={overview.data} />

      <div className="split-2 mb-24">
        <Card className="card--md">
          <div className="card-title card-title--sm mb-16">Acquisition Overview</div>
          <Requires capability="ga4">
            <QueryState query={overview}>{(data) => <Acquisition data={data} />}</QueryState>
          </Requires>
        </Card>

        <Card className="card--md">
          <div className="card-title card-title--sm mb-16">Conversion Funnel</div>
          <Requires capability="ga4">
            <QueryState query={overview}>{(data) => <Funnel data={data} />}</QueryState>
          </Requires>
        </Card>
      </div>

      <div className="card card--table-wide mb-24">
        <div className="card-title card-title--inline">Content Performance</div>
        <Requires capability="articles">
          <QueryState query={articles}>{(data) => <ContentPerformance data={data} />}</QueryState>
        </Requires>
      </div>

      <div className="mb-24">
        <div className="section-title">Social Performance</div>
        <div className="platform-grid">
          {SOCIAL_PERFORMANCE.map((item) => (
            <Card className="card--sm" key={item.platform}>
              <div className="platform-card__name">{item.platform}</div>
              <Requires capability={item.platform === 'LinkedIn' ? 'linkedin' : 'meta'}>
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
              </Requires>
            </Card>
          ))}
        </div>
      </div>

      <div>
        <div className="section-title">Campaign Performance</div>
        <Requires capability="campaigns">
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
        </Requires>
      </div>
    </div>
  );
}
