import { useState } from 'react';
import { AI_TASK_LABELS, isAiBusy } from '../../shared/aiContent';
import { DECISIONS, DECISION_LABELS, decisionBlocker, type Decision } from '../../shared/approvals';
import { CONTENT_TYPE_LABELS, STAGE_LABELS, type ContentEvent, type ContentItem } from '../../shared/planner';
import { useDecideContent } from '../api/approvals';
import { useContentAi } from '../api/contentAi';
import { useContentEvents, useContentItems } from '../api/planner';
import { useCurrentUser } from '../components/AuthGate';
import { DraftView, QaView } from '../components/ContentAiPanel';
import { QueryState } from '../components/QueryState';
import { Requires } from '../components/Requires';
import { Card, PageHeader } from '../components/primitives';
import { formatDateTime } from '../lib/format';

const BUTTONS: Record<Decision, { label: string; className: string; prompt: string }> = {
  approve: { label: 'Approve', className: 'btn--approve', prompt: 'Note for the history (optional)' },
  revise: { label: 'Request Revision', className: 'btn--revise', prompt: 'What needs changing?' },
  reject: { label: 'Reject', className: 'btn--reject', prompt: 'Why is it rejected?' },
};

function describeEvent(event: ContentEvent): string {
  if (event.note) return event.note;
  if (event.kind === 'created') return `Created in ${event.toStage ? STAGE_LABELS[event.toStage] : 'the planner'}`;
  if (event.fromStage && event.toStage) return `${STAGE_LABELS[event.fromStage]} → ${STAGE_LABELS[event.toStage]}`;
  return 'Edited';
}

function Timeline({ itemId }: { itemId: string }) {
  const events = useContentEvents(itemId);
  return (
    <>
      <div className="approval-timeline__label">HISTORY</div>
      <QueryState query={events}>
        {(list) => (
          <div>
            {list.map((event) => (
              <div className="approval-timeline__row" key={event.id}>
                <div className="approval-timeline__dot" style={{ background: 'var(--blue)' }} />
                <div className="approval-timeline__body">
                  <span className="approval-timeline__step">{describeEvent(event)}</span>
                  <span className="approval-timeline__time">
                    {formatDateTime(event.createdAt)}
                    {event.userName ? ` · ${event.userName}` : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </QueryState>
    </>
  );
}

function Decide({ item }: { item: ContentItem }) {
  const user = useCurrentUser();
  const decide = useDecideContent(item.id);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [note, setNote] = useState('');
  const [useAi, setUseAi] = useState(true);

  if (user.role !== 'approver' && user.role !== 'admin') {
    return <div className="approval-note">Only an approver or an admin decides what gets published.</div>;
  }

  const input = { decision: decision ?? 'approve', note, useAi };
  const blocker = decision ? decisionBlocker({ stage: item.stage, hasDraft: item.ai.hasDraft }, input) : null;

  const reset = () => {
    setDecision(null);
    setNote('');
    decide.reset();
  };

  return (
    <div className="approval-decide">
      <div className="approval-actions">
        {DECISIONS.map((key) => (
          <button
            key={key}
            type="button"
            className={BUTTONS[key].className}
            aria-pressed={decision === key}
            disabled={decide.isPending}
            onClick={() => {
              decide.reset();
              setDecision(key);
            }}
          >
            {BUTTONS[key].label}
          </button>
        ))}
      </div>

      {decision ? (
        <div className="approval-decide__form">
          <label className="editor-field">
            {BUTTONS[decision].prompt}
            <textarea
              rows={3}
              maxLength={5000}
              autoFocus
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={decision === 'revise' ? 'The AI reads this together with the QA issues.' : ''}
            />
          </label>
          {decision === 'revise' && item.ai.hasDraft ? (
            <label className="job-toggle">
              <input type="checkbox" checked={useAi} onChange={(event) => setUseAi(event.target.checked)} />
              Let the AI rewrite the draft from this note, then run QA again
            </label>
          ) : null}
          {blocker ? <div className="editor-hint">{blocker}</div> : null}
          <div className="approval-decide__confirm">
            <button
              type="button"
              className="btn btn--primary settings-form__button"
              disabled={blocker !== null || decide.isPending}
              onClick={() => decide.mutate({ decision, note, useAi }, { onSuccess: reset })}
            >
              {decide.isPending ? 'Saving…' : `Confirm: ${DECISION_LABELS[decision]}`}
            </button>
            <button type="button" className="btn btn--ghost settings-form__button" onClick={reset}>
              Cancel
            </button>
            {decide.isError ? (
              <span className="settings-form__error" role="alert">
                {decide.error.message}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Detail({ item }: { item: ContentItem }) {
  const ai = useContentAi(item.id);
  return (
    <>
      <div className="approval-detail__type">{CONTENT_TYPE_LABELS[item.type]}</div>
      <div className="approval-detail__title">{item.title}</div>
      <div className="approval-detail__byline">
        {item.ownerName ? `Owner ${item.ownerName}` : 'No owner'} · waiting since {formatDateTime(item.updatedAt)}
        {item.keyword ? ` · ${item.keyword}` : ''}
      </div>

      {isAiBusy(item.ai) ? (
        <div className="ai-banner" role="status">
          The AI is writing the {AI_TASK_LABELS[item.ai.task ?? 'revise']}. It comes back here once QA finishes.
        </div>
      ) : null}

      <Decide item={item} />

      <QueryState query={ai}>
        {(data) => (
          <>
            {data.qa ? (
              <QaView qa={data.qa} />
            ) : (
              <div className="approval-note">No QA result: this content was not written by the AI writer.</div>
            )}
            {data.draft ? <DraftView draft={data.draft} /> : null}
          </>
        )}
      </QueryState>

      <Timeline itemId={item.id} />
    </>
  );
}

export function Approval({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const content = useContentItems();

  return (
    <div>
      <PageHeader title="Approval Queue" subtitle="Human-in-the-loop review before publishing" />

      <Requires capability="approvals">
        <QueryState query={content}>
          {(items) => {
            const queue = items
              .filter((item) => item.stage === 'review')
              .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt));
            const selected = queue.find((item) => item.id === selectedId) ?? queue[0] ?? null;

            if (!selected) {
              return (
                <div className="approval-empty">
                  Nothing is waiting for approval. Content arrives here when its AI draft passes QA, or when someone
                  moves it to Review in the Content Planner.
                </div>
              );
            }

            return (
              <div className="approval-layout">
                <div className="approval-queue">
                  {queue.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={item.id === selected.id ? 'approval-item approval-item--selected' : 'approval-item'}
                      aria-pressed={item.id === selected.id}
                      onClick={() => onSelect(item.id)}
                    >
                      <div className="approval-item__head">
                        <span className="approval-item__type">{CONTENT_TYPE_LABELS[item.type]}</span>
                        <span className="approval-item__submitted">{formatDateTime(item.updatedAt)}</span>
                      </div>
                      <div className="approval-item__title">{item.title}</div>
                      <div className="approval-item__author">{item.ownerName ?? 'No owner'}</div>
                    </button>
                  ))}
                </div>

                <Card className="card--lg">
                  <Detail key={selected.id} item={selected} />
                </Card>
              </div>
            );
          }}
        </QueryState>
      </Requires>
    </div>
  );
}
