import { useMemo, useState } from 'react';
import { ArticleDrawer } from '../components/ArticleDrawer';
import { Chip, PageHeader } from '../components/primitives';
import { ARTICLES, type ArticleTab } from '../data/editorial';
import { articleSlug } from '../lib/routes';
import { statusTone } from '../lib/theme';
import type { ContentStatus } from '../types';

const STATUSES: ContentStatus[] = [
  'Published',
  'In Review',
  'Draft',
  'Scheduled',
  'Needs Update',
];

const CLUSTERS = Array.from(new Set(ARTICLES.map((article) => article.cluster))).sort();

export function Articles({
  selectedSlug,
  onSelect,
  tab,
  onTabChange,
}: {
  selectedSlug: string | null;
  onSelect: (slug: string | null) => void;
  tab: ArticleTab;
  onTabChange: (tab: ArticleTab) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'All' | ContentStatus>('All');
  const [cluster, setCluster] = useState('All');

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return ARTICLES.filter((article) => {
      if (status !== 'All' && article.status !== status) return false;
      if (cluster !== 'All' && article.cluster !== cluster) return false;
      if (!needle) return true;
      return (
        article.title.toLowerCase().includes(needle) || article.kw.toLowerCase().includes(needle)
      );
    });
  }, [query, status, cluster]);

  // Resolved against the full list, not the filtered rows, so a shared link
  // still opens the article even when the recipient's filters exclude it.
  const selected = selectedSlug
    ? (ARTICLES.find((article) => articleSlug(article) === selectedSlug) ?? null)
    : null;

  return (
    <div>
      <PageHeader
        title="Articles"
        subtitle="All website content for tsicertification.com"
        actions={
          <button type="button" className="btn btn--page">
            + New Article
          </button>
        }
      />

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
              onChange={(event) => setStatus(event.target.value as 'All' | ContentStatus)}
            >
              <option value="All">Status: All</option>
              {STATUSES.map((value) => (
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
              {CLUSTERS.map((value) => (
                <option key={value} value={value}>
                  Cluster: {value}
                </option>
              ))}
            </select>
            <button type="button" className="select-pill">
              Bulk Actions
            </button>
          </div>
        </div>

        <div className="table-scroll">
          <table className="articles-table">
            <thead>
              <tr>
                <th>ARTICLE</th>
                <th>CLUSTER</th>
                <th>STATUS</th>
                <th>AUTHOR</th>
                <th>SEO</th>
                <th>RANK</th>
                <th>TRAFFIC</th>
                <th>LEADS</th>
                <th>PUBLISHED</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((article) => (
                <tr key={article.url} onClick={() => onSelect(articleSlug(article))}>
                  <td>
                    <div className="articles-table__title">{article.title}</div>
                    <div className="articles-table__kw">{article.kw}</div>
                  </td>
                  <td>{article.cluster}</td>
                  <td>
                    <Chip tone={statusTone(article.status)}>{article.status}</Chip>
                  </td>
                  <td>{article.author}</td>
                  <td>{article.seo}</td>
                  <td>{article.rank}</td>
                  <td>{article.traffic}</td>
                  <td>{article.leads}</td>
                  <td>{article.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {rows.length === 0 ? <div className="table-empty">No articles match these filters.</div> : null}
      </div>

      {selected ? (
        <ArticleDrawer
          article={selected}
          tab={tab}
          onTabChange={onTabChange}
          onClose={() => onSelect(null)}
        />
      ) : null}
    </div>
  );
}
