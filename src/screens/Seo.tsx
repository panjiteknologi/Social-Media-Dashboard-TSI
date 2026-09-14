import type { CapabilityKey } from '../../shared/capabilities';
import { serpPage, type PositionBand, type SeoKeywords, type SeoOverview } from '../../shared/seo';
import { useSeoKeywords, useSeoOverview } from '../api/seo';
import { QueryState } from '../components/QueryState';
import { RangeToggle } from '../components/RangeToggle';
import { KpiBody, Requires } from '../components/Requires';
import { ChangeFoot, DataThrough } from '../components/SeoParts';
import { SeoTrendChart } from '../components/TrendChart';
import { Card, Chip } from '../components/primitives';
import { ACTION_CENTER, TECH_HEALTH } from '../data/growth';
import { overviewPeriod, type ChartRange } from '../lib/chart';
import {
  countChange,
  displayPage,
  formatDate,
  formatNumber,
  formatPercent,
  formatPosition,
  percentChange,
  pointChange,
  positionChange,
  type Change,
} from '../lib/format';
import { actionStatusTone, healthTone, keywordStatusTone, priorityTone } from '../lib/theme';

/** An ordered light-to-dark ramp: the bands have a natural order, from best positions to worst. */
const BAND_COLORS: Record<PositionBand, string> = {
  'Top 3': '#0F2747',
  'Pos 4–10': '#2D6CDF',
  'Pos 11–20': '#7BA6ED',
  'Pos 21–50': '#B7C9E8',
  'Pos 51+': '#DCE4EE',
};

/** What to do with an opportunity keyword, by how far it is from the top. */
function opportunityAdvice(position: number): string {
  if (position <= 10) return 'Already on page 1. Sharpen the title and meta description and deepen the content to climb higher.';
  if (position <= 20) return 'On page 2. Expand the content and add internal links from related pages.';
  return 'Deeper in the results. Create or rework a page that targets this keyword directly.';
}

interface Tile {
  label: string;
  capability: CapabilityKey;
  value: string;
  change: Change | null;
  period: string;
}

function SeoKpis({
  range,
  overview,
  keywords,
}: {
  range: ChartRange;
  overview: SeoOverview | undefined;
  keywords: SeoKeywords | undefined;
}) {
  const current = overview?.totals.current;
  const previous = overview?.totals.previous ?? null;
  const period = overview ? overviewPeriod(overview, range) : '';
  const loading = '…';

  const tiles: Tile[] = [
    {
      label: 'Clicks',
      capability: 'gsc',
      value: current ? formatNumber(current.clicks) : loading,
      change: current ? percentChange(current.clicks, previous?.clicks ?? null) : null,
      period,
    },
    {
      label: 'SEO Visibility',
      capability: 'gsc',
      value: current ? formatNumber(current.impressions) : loading,
      change: current ? percentChange(current.impressions, previous?.impressions ?? null) : null,
      period: period && `impressions, ${period}`,
    },
    {
      label: 'Average Position',
      capability: 'gsc',
      value: current ? formatPosition(current.position) : loading,
      change: current ? positionChange(current.position, previous?.position ?? null) : null,
      period,
    },
    {
      label: 'Keywords Top 3',
      capability: 'gsc',
      value: keywords ? String(keywords.counts.top3.current) : loading,
      change: keywords ? countChange(keywords.counts.top3.current, keywords.counts.top3.previous) : null,
      period: 'last 28 days',
    },
    {
      label: 'Keywords Top 10',
      capability: 'gsc',
      value: keywords ? String(keywords.counts.top10.current) : loading,
      change: keywords ? countChange(keywords.counts.top10.current, keywords.counts.top10.previous) : null,
      period: 'last 28 days',
    },
    { label: 'Indexed Pages', capability: 'technicalSeo', value: '', change: null, period: '' },
    {
      label: 'Organic CTR',
      capability: 'gsc',
      value: current ? formatPercent(current.ctr) : loading,
      change: current ? pointChange(current.ctr, previous?.ctr ?? null) : null,
      period,
    },
    { label: 'SEO Health Score', capability: 'seoHealthScore', value: '', change: null, period: '' },
  ];

  return (
    <div className="kpi-strip kpi-strip--4 mb-28">
      {tiles.map((tile) => (
        <div className="kpi kpi--seo" key={tile.label}>
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

function KeywordTracker({ data }: { data: SeoKeywords }) {
  const min = data.settings.minImpressions;
  return (
    <>
      {data.window ? (
        <div className="seo-caption">
          {formatDate(data.window.start, false)} – {formatDate(data.window.end)}. Keywords with at least {min}{' '}
          impressions. Google reports the query for {formatPercent(data.queryCoverage, 0)} of impressions; the rest
          are withheld for privacy.
        </div>
      ) : null}
      {data.keywords.length === 0 ? (
        <div className="table-empty">No keyword reached {min} impressions in the last 28 days.</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--compact">
            <thead>
              <tr>
                <th>KEYWORD</th>
                <th>CLUSTER</th>
                <th>POSITION</th>
                <th>PAGE</th>
                <th>CLICKS</th>
                <th>IMPR.</th>
                <th>CTR</th>
                <th>OPP.</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data.keywords.map((row) => (
                <tr key={row.query}>
                  <td className="cell-strong">{row.query}</td>
                  <td className="cell-muted">{row.cluster}</td>
                  <td className="cell-text">
                    {formatPosition(row.position)}
                    {row.previousPosition !== null ? (
                      <span className="keyword-cell__prev">was {formatPosition(row.previousPosition)}</span>
                    ) : null}
                  </td>
                  <td className="cell-text">Page {serpPage(row.position)}</td>
                  <td className="cell-text">{formatNumber(row.clicks)}</td>
                  <td className="cell-text">{formatNumber(row.impressions)}</td>
                  <td className="cell-text">{formatPercent(row.ctr)}</td>
                  <td className="cell-strong">{row.opportunityScore ?? '—'}</td>
                  <td>
                    <Chip tone={keywordStatusTone(row.status)}>{row.status}</Chip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function Distribution({ data }: { data: SeoKeywords }) {
  const total = data.distribution.reduce((sum, band) => sum + band.count, 0);
  if (total === 0) {
    return <div className="empty-note">No keyword reached {data.settings.minImpressions} impressions in the last 28 days.</div>;
  }
  return (
    <>
      <div className="dist-bar" role="img" aria-label="Keywords by position band">
        {data.distribution
          .filter((band) => band.count > 0)
          .map((band) => (
            <div
              key={band.band}
              style={{ width: `${((band.count / total) * 100).toFixed(1)}%`, background: BAND_COLORS[band.band] }}
            />
          ))}
      </div>
      <div className="dist-legend">
        {data.distribution.map((band) => (
          <div className="dist-legend__item" key={band.band}>
            <div className="dist-legend__dot" style={{ background: BAND_COLORS[band.band] }} />
            {band.band} ({band.count})
          </div>
        ))}
      </div>
      <div className="seo-caption seo-caption--below">
        {total} keywords with at least {data.settings.minImpressions} impressions in the last 28 days.
      </div>
    </>
  );
}

function Cannibalization({ data }: { data: SeoKeywords }) {
  if (data.cannibalization.length === 0) {
    return <div className="empty-note">No non-brand keyword is split between pages in the last 28 days.</div>;
  }
  return (
    <>
      {data.cannibalization.slice(0, 3).map((item) => (
        <div className="cannibal-item" key={item.query}>
          <div className="cannibal__kw">⚠ {item.query}</div>
          <div className="cannibal__label">COMPETING URLS</div>
          {item.pages.map((page) => (
            <div className="cannibal__url" key={page.page}>
              {displayPage(page.page, data.settings.contentHost)} · {formatPercent(page.share, 0)} of impressions ·
              position {formatPosition(page.position)}
            </div>
          ))}
        </div>
      ))}
      <div className="cannibal__rec">
        Choose one primary page for each keyword and link the other pages to it, so they stop competing.
      </div>
    </>
  );
}

function Opportunities({ data }: { data: SeoKeywords }) {
  if (data.opportunities.length === 0) {
    return (
      <div className="empty-note">
        No non-brand keyword between positions 8 and 50 reached {data.settings.minImpressions} impressions in the
        last 28 days.
      </div>
    );
  }
  return (
    <div className="opp-grid">
      {data.opportunities.slice(0, 3).map((row) => (
        <Card className="card--sm" key={row.query}>
          <div className="opp-card__title">{row.query}</div>
          <div className="opp-card__meta">
            Current position: {formatPosition(row.position)} (page {serpPage(row.position)})
          </div>
          <div className="opp-card__meta">Impressions: {formatNumber(row.impressions)} in 28 days</div>
          <div className="opp-card__chip">
            <Chip tone={keywordStatusTone('Opportunity')}>Score {row.opportunityScore}</Chip>
          </div>
          <div className="opp-card__action">{opportunityAdvice(row.position)}</div>
          {row.landingPage ? (
            <div className="opp-card__page">{displayPage(row.landingPage, data.settings.contentHost)}</div>
          ) : null}
        </Card>
      ))}
    </div>
  );
}

export function Seo({
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
      <div className="mb-24">
        <div className="page-title">SEO Intelligence</div>
        <div className="page-subtitle">
          Organic visibility, keyword performance and optimization opportunities
        </div>
        <DataThrough date={overview.data?.dataThrough ?? null} />
      </div>

      <SeoKpis range={chartRange} overview={overview.data} keywords={keywords.data} />

      <Card className="mb-24">
        <div className="card-head">
          <div className="card-title">Organic Visibility</div>
          <RangeToggle value={chartRange} onChange={onChartRangeChange} />
        </div>
        <Requires capability="gsc" tall>
          <QueryState query={overview} tall>
            {(data) => <SeoTrendChart overview={data} dimmed={overview.isPlaceholderData} />}
          </QueryState>
        </Requires>
      </Card>

      <div className="card card--table-wide mb-24">
        <div className="card-title card-title--inline">Keyword Tracker</div>
        <Requires capability="gsc">
          <QueryState query={keywords}>{(data) => <KeywordTracker data={data} />}</QueryState>
        </Requires>
      </div>

      <div className="split-2 mb-24">
        <Card className="card--md">
          <div className="card-title card-title--sm mb-16">Keyword Distribution</div>
          <Requires capability="gsc">
            <QueryState query={keywords}>{(data) => <Distribution data={data} />}</QueryState>
          </Requires>
        </Card>

        <Card className="card--md">
          <div className="card-title card-title--sm" style={{ marginBottom: 6 }}>
            Keyword Cannibalization
          </div>
          <Requires capability="gsc">
            <QueryState query={keywords}>{(data) => <Cannibalization data={data} />}</QueryState>
          </Requires>
        </Card>
      </div>

      <div className="mb-24">
        <div className="section-title">SEO Opportunities</div>
        <Requires capability="gsc">
          <QueryState query={keywords}>{(data) => <Opportunities data={data} />}</QueryState>
        </Requires>
      </div>

      <div className="mb-24">
        <div className="section-title">Technical SEO Health</div>
        <Requires capability="technicalSeo">
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
        </Requires>
      </div>

      <div>
        <div className="section-title">SEO Action Center</div>
        <Requires capability="seoActions">
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
        </Requires>
      </div>
    </div>
  );
}
