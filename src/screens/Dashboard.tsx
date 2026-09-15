import { Link } from 'react-router-dom';
import { countPublished, type AnalyticsOverview, type ArticlesResponse } from '../../shared/content';
import type { SeoKeywords, SeoOverview } from '../../shared/seo';
import { useAnalyticsOverview, useArticles } from '../api/content';
import { useSeoKeywords, useSeoOverview } from '../api/seo';
import { QueryState } from '../components/QueryState';
import { RangeToggle } from '../components/RangeToggle';
import { KpiBody, Requires } from '../components/Requires';
import { ChangeFoot, DataThrough } from '../components/SeoParts';
import { SeoTrendChart } from '../components/TrendChart';
import { Card } from '../components/primitives';
import { AGENT_ACTIVITY, AI_OPPORTUNITIES, DASHBOARD_KPIS, UPCOMING_CONTENT } from '../data/editorial';
import { leadsPeriod, overviewPeriod, trafficPeriod, type ChartRange } from '../lib/chart';
import { articleHref, periodText } from '../lib/content';
import {
  countChange,
  displayPage,
  formatNumber,
  formatPercent,
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

interface LiveSources {
  overview: SeoOverview | undefined;
  keywords: SeoKeywords | undefined;
  traffic: AnalyticsOverview | undefined;
  articles: ArticlesResponse | undefined;
}

interface LiveKpi {
  value: string;
  change: Change | null;
  period: string;
}

const LOADING: LiveKpi = { value: '…', change: null, period: '' };

const withPeriod = (what: string, period: string): string => [what, period].filter(Boolean).join(', ');

/** The dashboard KPIs real data answers; the rest wait for their own sources. */
function liveKpi(kpi: Kpi, range: ChartRange, { overview, keywords, traffic, articles }: LiveSources): LiveKpi | null {
  switch (kpi.label) {
    case 'Organic Traffic': {
      if (!traffic) return LOADING;
      const { current, previous } = traffic.totals;
      return {
        value: formatNumber(current.organicSessions),
        change: percentChange(current.organicSessions, previous?.organicSessions ?? null),
        period: withPeriod('sessions', trafficPeriod(traffic)),
      };
    }
    case 'SEO Visibility': {
      if (!overview) return LOADING;
      const { current, previous } = overview.totals;
      return {
        value: formatNumber(current.impressions),
        change: percentChange(current.impressions, previous?.impressions ?? null),
        period: `impressions, ${overviewPeriod(overview, range)}`,
      };
    }
    case 'Keywords in Top 10': {
      if (!keywords) return LOADING;
      return {
        value: String(keywords.counts.top10.current),
        change: countChange(keywords.counts.top10.current, keywords.counts.top10.previous),
        period: 'last 28 days',
      };
    }
    case 'Website Leads': {
      if (!traffic) return LOADING;
      return {
        value: formatNumber(traffic.leads.current),
        change: countChange(traffic.leads.current, traffic.leads.previous),
        period: withPeriod('contact form', leadsPeriod(traffic)),
      };
    }
    case 'Articles Published': {
      if (!articles) return LOADING;
      return {
        value: formatNumber(countPublished(articles.articles, articles.today, 'All').current),
        change: null,
        period: 'all articles on the website',
      };
    }
    default:
      return null;
  }
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

function TopContent({ data }: { data: ArticlesResponse }) {
  const top = data.articles
    .filter((article) => article.search.clicks > 0 || article.traffic.sessions > 0)
    .sort((a, b) => b.search.clicks - a.search.clicks || b.traffic.sessions - a.traffic.sessions)
    .slice(0, 3);

  if (top.length === 0) {
    return <div className="empty-note">No article had search clicks or visits in the last 28 days.</div>;
  }
  return (
    <>
      {top.map((article) => (
        <div className="list-row" key={article.slug}>
          <Link className="list-row__title table-link" to={articleHref(article.slug)}>
            {article.title}
          </Link>
          <div className="list-row__meta">
            <span>Clicks {formatNumber(article.search.clicks)}</span>
            <span>Position {formatPosition(article.search.position)}</span>
            <span>CTR {formatPercent(article.search.ctr)}</span>
            <span>Sessions {formatNumber(article.traffic.sessions)}</span>
            <span>Leads {formatNumber(article.traffic.leadEvents)}</span>
          </div>
        </div>
      ))}
      <div className="seo-caption seo-caption--below">
        Ranked by search clicks.
        {data.searchPeriod ? ` Search: ${periodText(data.searchPeriod)}.` : ''}
        {data.trafficPeriod ? ` Visits: ${periodText(data.trafficPeriod)}.` : ''}
      </div>
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
  const traffic = useAnalyticsOverview(chartRange);
  const articles = useArticles();

  const sources: LiveSources = {
    overview: overview.data,
    keywords: keywords.data,
    traffic: traffic.data,
    articles: articles.data,
  };

  return (
    <div>
      <div className="mb-28">
        <div className="page-title page-title--lg">Dashboard Overview</div>
        <div className="page-subtitle page-subtitle--lg">Content, SEO &amp; Social Intelligence</div>
        <DataThrough date={overview.data?.dataThrough ?? null} />
      </div>

      <div className="kpi-strip kpi-strip--4 mb-32">
        {DASHBOARD_KPIS.map((kpi) => {
          const live = liveKpi(kpi, chartRange, sources);
          return (
            <div className="kpi" key={kpi.label}>
              <div className="kpi__label">{kpi.label}</div>
              <KpiBody
                capability={kpi.capability}
                value={live ? live.value : kpi.value}
                foot={
                  live ? (
                    <ChangeFoot change={live.change} period={live.period} />
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
              <Requires capability="articles">
                <QueryState query={articles}>{(data) => <TopContent data={data} />}</QueryState>
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
