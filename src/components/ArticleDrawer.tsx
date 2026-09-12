import { useEffect } from 'react';
import { ARTICLE_HISTORY, ARTICLE_TABS, type ArticleTab } from '../data/editorial';
import { statusTone } from '../lib/theme';
import type { Article } from '../types';
import { Bar, Chip, Field } from './primitives';

/** Quality bars shown on the SEO tab. Only the SEO score varies per article. */
function qualityScores(article: Article) {
  return [
    {
      label: 'SEO Score',
      value: article.seo,
      pct: typeof article.seo === 'number' ? article.seo : 0,
    },
    { label: 'Readability', value: 88, pct: 88 },
    { label: 'Brand Compliance', value: 95, pct: 95 },
    { label: 'Content Completeness', value: 90, pct: 90 },
    { label: 'Internal Linking', value: 72, pct: 72 },
  ];
}

export function ArticleDrawer({
  article,
  tab,
  onTabChange,
  onClose,
}: {
  article: Article;
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
            <div className="drawer__url">tsicertification.com{article.url}</div>
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
          {tab === 'Overview' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <div className="field-label">STATUS</div>
                <div style={{ marginTop: 4 }}>
                  <Chip tone={statusTone(article.status)}>{article.status}</Chip>
                </div>
              </div>
              <Field label="PRIMARY KEYWORD">{article.kw}</Field>
              <Field label="SECONDARY KEYWORDS">{article.secondaryKw}</Field>
              <Field label="AUTHOR">{article.author}</Field>
              <Field label="PUBLISH DATE">{article.date}</Field>
              <Field label="AI SUMMARY" variant="body">
                {article.summary}
              </Field>
            </div>
          ) : null}

          {tab === 'SEO' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {qualityScores(article).map((score) => (
                <div key={score.label}>
                  <div className="score-row">
                    <span>{score.label}</span>
                    <strong>{score.value}</strong>
                  </div>
                  <Bar size="thin" pct={score.pct} />
                </div>
              ))}
            </div>
          ) : null}

          {tab === 'Social' ? (
            <div className="empty-note">
              No linked social posts have been generated from this article yet.
            </div>
          ) : null}

          {tab === 'Analytics' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <Field label="TRAFFIC" variant="metric">
                {article.traffic}
              </Field>
              <Field label="RANKING" variant="metric">
                {article.rank}
              </Field>
              <Field label="LEADS" variant="metric">
                {article.leads}
              </Field>
              <Field label="SEO SCORE" variant="metric">
                {article.seo}
              </Field>
            </div>
          ) : null}

          {tab === 'History' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {ARTICLE_HISTORY.map((entry) => (
                <div className="timeline-entry" key={entry.text}>
                  <div className="timeline-entry__dot" />
                  <div>
                    <div className="timeline-entry__text">{entry.text}</div>
                    <div className="timeline-entry__time">{entry.time}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="drawer__foot">
          <button type="button" className="btn--ghost">
            Edit
          </button>
          <button type="button" className="btn--ghost">
            Generate Revision
          </button>
          <button type="button" className="btn--dark">
            Send for Approval
          </button>
        </div>
      </aside>
    </div>
  );
}
