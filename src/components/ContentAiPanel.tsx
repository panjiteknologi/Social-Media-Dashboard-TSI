import { useState, type ReactNode } from 'react';
import {
  AI_TASK_LABELS,
  aiTaskBlocker,
  INTENT_LABELS,
  isAiBusy,
  qaVerdict,
  QA_VERDICT_LABELS,
  type AiTask,
  type ArticleDraft,
  type ContentAiDetail,
  type ContentBrief,
  type QaResult,
} from '../../shared/aiContent';
import type { ContentItem } from '../../shared/planner';
import { useContentAi, useQueueAiTask } from '../api/contentAi';
import { formatDateTime } from '../lib/format';
import { useCurrentUser } from './AuthGate';
import { QueryState } from './QueryState';

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);

/** The draft as a standalone page for the preview frame, which runs no scripts. */
function previewDocument(draft: ArticleDraft): string {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
body{margin:20px;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:15px;line-height:1.7;color:#1d2939}
h1{font-size:24px;line-height:1.3;color:#0f2747}h2{margin-top:28px;font-size:19px;color:#0f2747}h3{font-size:16px}
a{color:#1d5fbf}li{margin:4px 0}
</style></head><body><h1>${escapeHtml(draft.title)}</h1>${draft.html}</body></html>`;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="ai-field">
      <div className="field-label">{label}</div>
      <div className="ai-field__value">{children}</div>
    </div>
  );
}

function TextList({ items }: { items: string[] }) {
  if (items.length === 0) return <span className="ai-muted">None</span>;
  return (
    <ul className="ai-list">
      {items.map((text, index) => (
        <li key={index}>{text}</li>
      ))}
    </ul>
  );
}

function BriefView({ brief }: { brief: ContentBrief }) {
  return (
    <div className="ai-block">
      <Field label="WORKING TITLE">{brief.workingTitle}</Field>
      <div className="ai-grid">
        <Field label="FOCUS KEYWORD">{brief.focusKeyword}</Field>
        <Field label="SEARCH INTENT">{INTENT_LABELS[brief.searchIntent]}</Field>
        <Field label="LENGTH">
          {brief.wordTarget.min}–{brief.wordTarget.max} words
        </Field>
      </div>
      <Field label="READER">{brief.targetReader || '—'}</Field>
      <Field label="ANGLE">{brief.angle || '—'}</Field>
      <Field label="OUTLINE">
        <ol className="ai-outline">
          {brief.outline.map((section, index) => (
            <li key={index}>
              <strong>{section.heading}</strong>
              {section.points.length > 0 ? <TextList items={section.points} /> : null}
            </li>
          ))}
        </ol>
      </Field>
      <Field label="MUST COVER">
        <TextList items={brief.mustCover} />
      </Field>
      <Field label="INTERNAL LINKS">
        {brief.internalLinks.length === 0 ? (
          <span className="ai-muted">None</span>
        ) : (
          <ul className="ai-list">
            {brief.internalLinks.map((link) => (
              <li key={link.url}>
                <a href={link.url} target="_blank" rel="noreferrer">
                  {link.title}
                </a>
                {link.reason ? ` — ${link.reason}` : ''}
              </li>
            ))}
          </ul>
        )}
      </Field>
      {brief.faq.length > 0 ? (
        <Field label="FAQ">
          <TextList items={brief.faq} />
        </Field>
      ) : null}
      <Field label="CALL TO ACTION">{brief.cta || '—'}</Field>
      <Field label="IMPARTIALITY NOTES">
        <TextList items={brief.impartialityNotes} />
      </Field>
    </div>
  );
}

export function DraftView({ draft }: { draft: ArticleDraft }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(draft.html);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="ai-block">
      <Field label="SEO TITLE">
        {draft.seoTitle} <span className="ai-muted">({draft.seoTitle.length} characters)</span>
      </Field>
      <Field label="META DESCRIPTION">
        {draft.metaDescription} <span className="ai-muted">({draft.metaDescription.length} characters)</span>
      </Field>
      <div className="ai-grid">
        <Field label="SLUG">{draft.slug}</Field>
        <Field label="FOCUS KEYWORD">{draft.focusKeyword}</Field>
        <Field label="LENGTH">{draft.wordCount} words</Field>
      </div>
      <Field label="TAGS">{draft.tags.join(', ') || '—'}</Field>
      {draft.excerpt ? <Field label="EXCERPT">{draft.excerpt}</Field> : null}
      <div className="ai-preview-head">
        <span className="ai-muted">
          Written {formatDateTime(draft.writtenAt)} · {draft.model}
        </span>
        <button type="button" className="btn btn--ghost settings-form__button" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy HTML'}
        </button>
      </div>
      <iframe className="ai-preview" title={`Preview of ${draft.title}`} sandbox="" srcDoc={previewDocument(draft)} />
    </div>
  );
}

const VERDICT_CLASS = { pass: 'ai-verdict--pass', attention: 'ai-verdict--attention', fail: 'ai-verdict--fail' } as const;

export function QaView({ qa }: { qa: QaResult }) {
  const verdict = qaVerdict(qa);
  const passed = qa.seo.checks.filter((check) => check.passed).length;
  const { review } = qa;

  return (
    <div className="ai-block">
      <div className={`ai-verdict ${VERDICT_CLASS[verdict]}`}>
        {QA_VERDICT_LABELS[verdict]}
        <span className="ai-verdict__time"> · checked {formatDateTime(qa.checkedAt)}</span>
      </div>
      <div className="score-grid ai-scores">
        <div className="score-box">
          <div className="score-box__label">SEO CHECKLIST</div>
          <div className="score-box__value">{qa.seo.score}</div>
        </div>
        <div className="score-box">
          <div className="score-box__label">BRAND</div>
          <div className="score-box__value">{review?.brandScore ?? '—'}</div>
        </div>
        <div className="score-box">
          <div className="score-box__label">IMPARTIALITY</div>
          <div className="score-box__value">{review ? (review.impartiality === 'pass' ? 'Pass' : 'Fail') : '—'}</div>
        </div>
      </div>
      {review ? <p className="ai-summary">{review.summary}</p> : <div className="ai-banner ai-banner--warn">{qa.reviewNote}</div>}

      {review && review.issues.length > 0 ? (
        <Field label={`ISSUES (${review.issues.length})`}>
          <div className="ai-issues">
            {review.issues.map((issue, index) => (
              <div className={`ai-issue ai-issue--${issue.severity}`} key={index}>
                <div className="ai-issue__head">
                  <span className="ai-issue__severity">{issue.severity}</span> {issue.category}
                </div>
                {issue.quote ? <blockquote className="ai-issue__quote">{issue.quote}</blockquote> : null}
                <div>{issue.problem}</div>
                {issue.fix ? (
                  <div className="ai-issue__fix">
                    <strong>Fix:</strong> {issue.fix}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Field>
      ) : null}

      {qa.flaggedPhrases.length > 0 ? (
        <Field label="FLAGGED WORDING">
          <ul className="ai-list">
            {qa.flaggedPhrases.map((flag) => (
              <li key={flag.phrase}>
                <strong>{flag.phrase}</strong>: {flag.rule}
                <div className="ai-muted">{flag.context}</div>
              </li>
            ))}
          </ul>
        </Field>
      ) : null}

      <Field label={`SEO CHECKLIST (${passed} of ${qa.seo.checks.length})`}>
        <ul className="ai-checks">
          {qa.seo.checks.map((check) => (
            <li key={check.label} className={check.passed ? 'ai-check ai-check--pass' : 'ai-check ai-check--fail'}>
              <span aria-hidden="true">{check.passed ? '✓' : '✗'}</span> {check.label}{' '}
              <span className="ai-muted">{check.note}</span>
            </li>
          ))}
        </ul>
        <div className="ai-muted">The cover image and its alt text are added in the CMS when publishing.</div>
      </Field>
    </div>
  );
}

function Step({
  number,
  title,
  description,
  action,
  children,
}: {
  number: number;
  title: string;
  description: string;
  action: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="ai-step">
      <div className="ai-step__head">
        <div>
          <div className="ai-step__title">
            {number}. {title}
          </div>
          <div className="ai-step__description">{description}</div>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Panel({ item, data }: { item: ContentItem; data: ContentAiDetail }) {
  const user = useCurrentUser();
  const queue = useQueueAiTask(item.id);
  const { summary } = data;
  const busy = isAiBusy(summary);
  const stopped = !busy && (summary.status === 'queued' || summary.status === 'running');
  const canRun = user.role !== 'viewer' && data.configured;

  const start = (task: AiTask, replaces: boolean) => {
    if (replaces && !window.confirm(`Replace the current ${AI_TASK_LABELS[task]}? This calls the AI again and is billed.`)) return;
    queue.mutate(task);
  };

  const button = (task: AiTask, label: string, replaces: boolean) => {
    if (!canRun) return null;
    const blocker = aiTaskBlocker(task, { type: item.type, hasBrief: summary.hasBrief, hasDraft: summary.hasDraft });
    return (
      <button
        type="button"
        className="btn btn--ghost settings-form__button"
        disabled={busy || queue.isPending || blocker !== null}
        title={blocker ?? undefined}
        onClick={() => start(task, replaces)}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="ai-panel">
      {!data.configured ? (
        <div className="ai-banner ai-banner--warn">Set OPENROUTER_API_KEY in .env to use the AI writer.</div>
      ) : null}
      {busy ? (
        <div className="ai-banner" role="status">
          AI is working on the {AI_TASK_LABELS[summary.task ?? 'brief']}
          {summary.task === 'draft' ? ', then the QA check' : ''}. This takes one to three minutes; you can close this
          drawer.
        </div>
      ) : null}
      {stopped ? (
        <div className="ai-banner ai-banner--warn" role="alert">
          The last AI task stopped without finishing. Start it again.
        </div>
      ) : null}
      {summary.status === 'failed' ? (
        <div className="ai-banner ai-banner--error" role="alert">
          The {AI_TASK_LABELS[summary.task ?? 'brief']} failed: {summary.error}
        </div>
      ) : null}
      {queue.isError ? (
        <div className="ai-banner ai-banner--error" role="alert">
          {queue.error.message}
        </div>
      ) : null}

      <Step
        number={1}
        title="Brief"
        description="Search intent, outline, internal links and impartiality notes, from Search Console data and Settings > Brand and AI. Notes on the Details tab steer it."
        action={button('brief', summary.hasBrief ? 'Regenerate brief' : 'Generate brief', summary.hasBrief)}
      >
        {data.brief ? <BriefView brief={data.brief} /> : <div className="ai-empty">No brief yet.</div>}
      </Step>

      <Step
        number={2}
        title="Draft"
        description="Writes the article from the brief, runs the QA check, and moves the article to Review."
        action={button('draft', summary.hasDraft ? 'Rewrite draft' : 'Write draft', summary.hasDraft)}
      >
        {data.draft ? <DraftView draft={data.draft} /> : <div className="ai-empty">No draft yet.</div>}
      </Step>

      <Step
        number={3}
        title="QA check"
        description="The CMS SEO checklist, forbidden wording, and an AI review against the brand and impartiality rules."
        action={button('qa', 'Run QA again', false)}
      >
        {data.qa ? <QaView qa={data.qa} /> : <div className="ai-empty">QA runs after the draft.</div>}
      </Step>
    </div>
  );
}

/** The AI Writer tab: brief, draft and QA for one article. */
export function ContentAiPanel({ item }: { item: ContentItem }) {
  const detail = useContentAi(item.id);
  return <QueryState query={detail}>{(data) => <Panel item={item} data={data} />}</QueryState>;
}
