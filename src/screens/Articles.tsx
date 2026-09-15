import { useMemo, useState } from 'react';
import {
  ARTICLE_STATUSES,
  countPublished,
  PUBLISHED_WINDOWS,
  type ArticlesResponse,
  type ArticleStatus,
  type PublishedWindow,
} from '../../shared/content';
import { useArticles } from '../api/content';
import { ArticleDrawer } from '../components/ArticleDrawer';
import { QueryState } from '../components/QueryState';
import { Requires } from '../components/Requires';
import { ChangeFoot } from '../components/SeoParts';
import { Chip, PageHeader } from '../components/primitives';
import type { ArticleTab } from '../data/editorial';
import { periodText, seoScoreClass } from '../lib/content';
import { countChange, formatDate, formatDateTime, formatNumber, formatPosition } from '../lib/format';
import { statusTone } from '../lib/theme';

interface ArticlesView {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  tab: ArticleTab;
  onTabChange: (tab: ArticleTab) => void;
  publishedWindow: PublishedWindow;
  onPublishedWindowChange: (window: PublishedWindow) => void;
}

const WINDOW_LABELS: Record<PublishedWindow, string> = { All: 'All', '30D': '30 days', '60D': '60 days', '90D': '90 days' };

function PublishedCard({
  data,
  window,
  onWindowChange,
}: {
  data: ArticlesResponse;
  window: PublishedWindow;
  onWindowChange: (window: PublishedWindow) => void;
}) {
  const count = countPublished(data.articles, data.today, window);
  const period = count.period
    ? `${periodText(count.period)}, vs the ${count.days} days before`
    : 'all articles on the website';

  return (
    <div className="kpi-strip kpi-strip--4 mb-24">
      <div className="kpi kpi--published">
        <div className="kpi__label">Total Articles Published</div>
        <div className="kpi__value">{formatNumber(count.current)}</div>
        <ChangeFoot change={countChange(count.current, count.previous)} period={period} />
        <div className="range-toggle published-toggle" role="group" aria-label="Published within">
          {PUBLISHED_WINDOWS.map((value) => (
            <button key={value} type="button" aria-pressed={window === value} onClick={() => onWindowChange(value)}>
              {WINDOW_LABELS[value]}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function Caption({ data }: { data: ArticlesResponse }) {
  const parts = [
    `${formatNumber(data.articles.length)} articles from the CMS${data.syncedAt ? `, copied ${formatDateTime(data.syncedAt)}` : ''}.`,
    data.searchPeriod ? `Position and clicks: ${periodText(data.searchPeriod)}.` : 'Search Console is not synced yet.',
    data.trafficPeriod
      ? `Sessions and leads: ${periodText(data.trafficPeriod)}, from visits that started on the article.`
      : 'GA4 is not synced yet.',
  ];
  return <div className="content-caption">{parts.join(' ')}</div>;
}

function ArticleList({
  data,
  selectedSlug,
  onSelect,
  tab,
  onTabChange,
  publishedWindow,
  onPublishedWindowChange,
}: ArticlesView & { data: ArticlesResponse }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | ArticleStatus>('All');
  const [cluster, setCluster] = useState('All');

  const statuses = useMemo(
    () => ARTICLE_STATUSES.filter((value) => data.articles.some((article) => article.status === value)),
    [data],
  );
  const clusters = useMemo(() => Array.from(new Set(data.articles.map((article) => article.cluster))).sort(), [data]);

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return data.articles.filter((article) => {
      if (status !== 'All' && article.status !== status) return false;
      if (cluster !== 'All' && article.cluster !== cluster) return false;
      if (!needle) return true;
      return (
        article.title.toLowerCase().includes(needle) ||
        (article.focusKeyword ?? '').toLowerCase().includes(needle) ||
        article.slug.includes(needle)
      );
    });
  }, [data, query, status, cluster]);

  // Resolved against the full list, not the filtered rows, so a shared link
  // still opens the article even when the recipient's filters exclude it.
  const selected = selectedSlug ? (data.articles.find((article) => article.slug === selectedSlug) ?? null) : null;

  return (
    <>
      <PublishedCard data={data} window={publishedWindow} onWindowChange={onPublishedWindowChange} />

      <div className="panel">
        <div className="panel__toolbar">
          <div className="panel__search">
            <input
              type="search"
              placeholder="Search articles…"
              aria-label="Search articles"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <div className="panel__filters">
            <select
              className="select-pill"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value as 'All' | ArticleStatus)}
            >
              <option value="All">Status: All</option>
              {statuses.map((value) => (
                <option key={value} value={value}>
                  Status: {value}
                </option>
              ))}
            </select>
            <select
              className="select-pill"
              aria-label="Filter by cluster"
              value={cluster}
              onChange={(event) => setCluster(event.target.value)}
            >
              <option value="All">Cluster: All</option>
              {clusters.map((value) => (
                <option key={value} value={value}>
                  Cluster: {value}
                </option>
              ))}
            </select>
          </div>
        </div>

        <Caption data={data} />

        <div className="table-scroll">
          <table className="articles-table">
            <thead>
              <tr>
                <th>ARTICLE</th>
                <th>CLUSTER</th>
                <th>STATUS</th>
                <th>SEO</th>
                <th>POSITION</th>
                <th>CLICKS</th>
                <th>SESSIONS</th>
                <th>LEADS</th>
                <th>PUBLISHED</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((article) => {
                const passed = article.seoChecks.filter((check) => check.passed).length;
                const open = () => onSelect(article.slug);
                return (
                  <tr
                    key={article.slug}
                    tabIndex={0}
                    onClick={open}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') open();
                    }}
                  >
                    <td>
                      <div className="articles-table__title">{article.title}</div>
                      <div className="articles-table__kw">{article.focusKeyword ?? 'No focus keyword'}</div>
                    </td>
                    <td>{article.cluster}</td>
                    <td>
                      <Chip tone={statusTone(article.status)}>{article.status}</Chip>
                    </td>
                    <td>
                      <span
                        className={seoScoreClass(article.seoScore)}
                        title={`${passed} of ${article.seoChecks.length} checklist items pass`}
                      >
                        {article.seoScore}
                      </span>
                    </td>
                    <td>{article.search.impressions ? formatPosition(article.search.position) : '—'}</td>
                    <td>{formatNumber(article.search.clicks)}</td>
                    <td>{formatNumber(article.traffic.sessions)}</td>
                    <td>{formatNumber(article.traffic.leadEvents)}</td>
                    <td>{article.publishedAt ? formatDate(article.publishedAt) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? (
          <div className="table-empty">
            {data.articles.length === 0 ? 'The CMS has no articles yet.' : 'No articles match these filters.'}
          </div>
        ) : null}
      </div>

      {selected ? (
        <ArticleDrawer
          article={selected}
          data={data}
          tab={tab}
          onTabChange={onTabChange}
          onClose={() => onSelect(null)}
        />
      ) : null}
    </>
  );
}

export function Articles(view: ArticlesView) {
  const articles = useArticles();

  return (
    <div>
      <PageHeader
        title="Articles"
        subtitle="All website content for tsicertification.com"
        actions={
          <button type="button" className="btn btn--page" disabled title="Writing articles here arrives in M5">
            + New Article
          </button>
        }
      />

      <Requires capability="articles">
        <QueryState query={articles}>{(data) => <ArticleList data={data} {...view} />}</QueryState>
      </Requires>
    </div>
  );
}
