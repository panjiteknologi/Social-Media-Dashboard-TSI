import { useEffect } from 'react';
import type { ArticleRow, ArticlesResponse } from '../../shared/content';
import { ARTICLE_TABS, type ArticleTab } from '../data/editorial';
import { periodText, seoScoreClass } from '../lib/content';
import { formatDate, formatDuration, formatNumber, formatPercent, formatPosition } from '../lib/format';
import { statusTone } from '../lib/theme';
import { Requires } from './Requires';
import { Bar, Chip, Field } from './primitives';

const listOrDash = (values: string[]): string => (values.length > 0 ? values.join(', ') : '—');

function OverviewTab({ article }: { article: ArticleRow }) {
  return (
    <div className="drawer-stack">
      <div>
        <div className="field-label">STATUS</div>
        <div style={{ marginTop: 4 }}>
          <Chip tone={statusTone(article.status)}>{article.status}</Chip>
        </div>
      </div>
      <Field label="FOCUS KEYWORD">{article.focusKeyword ?? 'Not set in the CMS'}</Field>
      <Field label="CLUSTER">{article.cluster}</Field>
      <Field label="CATEGORIES">{listOrDash(article.categories)}</Field>
      <Field label="TAGS">{listOrDash(article.tags)}</Field>
      <Field label="AUTHOR">{article.authorName ?? '—'}</Field>
      <Field label="PUBLISHED">{article.publishedAt ? formatDate(article.publishedAt) : '—'}</Field>
      <Field label="LAST MODIFIED">{article.modifiedAt ? formatDate(article.modifiedAt) : '—'}</Field>
      <Field label="LENGTH">
        {formatNumber(article.wordCount)} words
        {article.readingTimeMinutes ? `, ${article.readingTimeMinutes} min read` : ''}
      </Field>
      {article.excerpt ? (
        <Field label="EXCERPT" variant="body">
          {article.excerpt}
        </Field>
      ) : null}
    </div>
  );
}

function SeoTab({ article }: { article: ArticleRow }) {
  const passed = article.seoChecks.filter((check) => check.passed).length;
  return (
    <div>
      <div className="score-row">
        <span>SEO checklist</span>
        <strong className={seoScoreClass(article.seoScore)}>{article.seoScore}</strong>
      </div>
      <Bar size="thin" pct={article.seoScore} />
      <div className="drawer-note">
        {passed} of {article.seoChecks.length} checks pass. This is the checklist editors see in the CMS.
      </div>
      <ul className="check-list">
        {article.seoChecks.map((check) => (
          <li className="check-row" key={check.label}>
            <span
              className={`check-row__mark ${check.passed ? 'check-row__mark--pass' : 'check-row__mark--fail'}`}
              aria-hidden="true"
            >
              {check.passed ? '✓' : '✕'}
            </span>
            <div>
              <span className="sr-only">{check.passed ? 'Passes: ' : 'Fails: '}</span>
              {check.label}
              <div className="check-row__note">{check.note}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyticsTab({ article, data }: { article: ArticleRow; data: ArticlesResponse }) {
  const { search, traffic } = article;
  return (
    <div>
      <div className="drawer-section-title">
        Search{data.searchPeriod ? `, ${periodText(data.searchPeriod)}` : ''}
      </div>
      <Requires capability="gsc">
        <div className="metric-grid">
          <Field label="CLICKS" variant="metric">
            {formatNumber(search.clicks)}
          </Field>
          <Field label="IMPRESSIONS" variant="metric">
            {formatNumber(search.impressions)}
          </Field>
          <Field label="AVG. POSITION" variant="metric">
            {formatPosition(search.position)}
          </Field>
          <Field label="CTR" variant="metric">
            {formatPercent(search.ctr)}
          </Field>
        </div>
        {search.previousClicks !== null ? (
          <div className="drawer-note">
            The 28 days before: {formatNumber(search.previousClicks)} clicks, position{' '}
            {formatPosition(search.previousPosition)}.
          </div>
        ) : null}
        {search.topQueries.length > 0 ? (
          <div className="table-scroll drawer-table">
            <table className="data-table data-table--compact">
              <thead>
                <tr>
                  <th>QUERY</th>
                  <th>CLICKS</th>
                  <th>IMPR.</th>
                  <th>POS.</th>
                </tr>
              </thead>
              <tbody>
                {search.topQueries.map((row) => (
                  <tr key={row.query}>
                    <td className="cell-strong">{row.query}</td>
                    <td className="cell-text">{formatNumber(row.clicks)}</td>
                    <td className="cell-text">{formatNumber(row.impressions)}</td>
                    <td className="cell-text">{formatPosition(row.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="drawer-note">Google reported no search query for this article in these days.</div>
        )}
      </Requires>

      <div className="drawer-section-title">
        Visits{data.trafficPeriod ? `, ${periodText(data.trafficPeriod)}` : ''}
      </div>
      <Requires capability="ga4">
        <div className="metric-grid">
          <Field label="SESSIONS" variant="metric">
            {formatNumber(traffic.sessions)}
          </Field>
          <Field label="FROM ORGANIC SEARCH" variant="metric">
            {formatNumber(traffic.organicSessions)}
          </Field>
          <Field label="AVG. ENGAGEMENT" variant="metric">
            {formatDuration(traffic.sessions ? traffic.engagementSeconds / traffic.sessions : null)}
          </Field>
          <Field label="LEADS" variant="metric">
            {formatNumber(traffic.leadEvents)}
          </Field>
        </div>
        <div className="drawer-note">
          Visits that started on this article. Leads are GA4 lead events during those visits.
        </div>
      </Requires>
    </div>
  );
}

export function ArticleDrawer({
  article,
  data,
  tab,
  onTabChange,
  onClose,
}: {
  article: ArticleRow;
  data: ArticlesResponse;
  tab: ArticleTab;
  onTabChange: (tab: ArticleTab) => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label={article.title}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer__head">
          <div>
            <div className="drawer__title">{article.title}</div>
            <div className="drawer__url">{article.url.replace(/^https:\/\//, '')}</div>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="drawer__tabs" role="tablist">
          {ARTICLE_TABS.map((label) => (
            <button
              key={label}
              type="button"
              role="tab"
              className="drawer__tab"
              aria-selected={tab === label}
              onClick={() => onTabChange(label)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="drawer__body" role="tabpanel">
          {tab === 'Overview' ? <OverviewTab article={article} /> : null}
          {tab === 'SEO' ? <SeoTab article={article} /> : null}
          {tab === 'Social' ? (
            <Requires capability="meta">
              <div className="empty-note">No social posts are linked to this article yet.</div>
            </Requires>
          ) : null}
          {tab === 'Analytics' ? <AnalyticsTab article={article} data={data} /> : null}
          {tab === 'History' ? (
            <Requires capability="content">
              <div className="empty-note">No workflow history for this article yet.</div>
            </Requires>
          ) : null}
        </div>

        <div className="drawer__foot">
          <a className="btn--dark drawer__link" href={article.url} target="_blank" rel="noreferrer">
            View on website ↗
          </a>
        </div>
      </aside>
    </div>
  );
}
