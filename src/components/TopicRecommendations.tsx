import { useEffect, useState } from 'react';
import { INTENT_LABELS, type TopicRecommendation, type TopicsResponse } from '../../shared/aiContent';
import type { ContentItem } from '../../shared/planner';
import { useDismissTopic, usePlanTopic, useRunTopics, useTopics } from '../api/contentAi';
import { formatDateTime, formatNumber, formatPosition } from '../lib/format';
import { useCurrentUser } from './AuthGate';
import { QueryState } from './QueryState';
import { Card } from './primitives';

function lastRunNote(lastRun: TopicsResponse['lastRun']): string {
  if (!lastRun) return 'Not generated yet.';
  if (lastRun.status === 'running') return 'Generating now…';
  if (lastRun.status === 'failed') return `The last run failed: ${lastRun.error ?? 'no details'}.`;
  if (lastRun.status === 'retrying') return `The last run failed and retries in a few minutes: ${lastRun.error ?? 'no details'}.`;
  return `Last generated ${formatDateTime(lastRun.finishedAt ?? lastRun.startedAt)}.`;
}

function TopicCard({
  topic,
  canEdit,
  busy,
  onPlan,
  onDismiss,
}: {
  topic: TopicRecommendation;
  canEdit: boolean;
  busy: boolean;
  onPlan: () => void;
  onDismiss: () => void;
}) {
  return (
    <Card className="card--sm topic-card">
      <div className="topic-card__head">
        <div className="topic-card__kw">{topic.keyword}</div>
        {topic.opportunityScore !== null ? (
          <div className="topic-card__score" title="Opportunity score: search demand and how close the keyword is to page 1">
            {topic.opportunityScore}
          </div>
        ) : null}
      </div>
      <div className="topic-card__title">{topic.title}</div>
      <div className="topic-card__meta">
        {INTENT_LABELS[topic.intent]} · {formatNumber(topic.impressions)} impressions · position {formatPosition(topic.position)}
      </div>
      <div className="topic-card__rec">
        {topic.action === 'update_article' && topic.existingUrl ? (
          <>
            Update existing article:{' '}
            <a href={topic.existingUrl} target="_blank" rel="noreferrer">
              {topic.existingUrl.replace(/^https?:\/\/[^/]+/, '')}
            </a>
          </>
        ) : (
          'New article'
        )}
      </div>
      {topic.angle ? <p className="topic-card__angle">{topic.angle}</p> : null}
      {topic.reason ? <p className="topic-card__reason">{topic.reason}</p> : null}
      {canEdit ? (
        <div className="topic-card__actions">
          <button type="button" className="link-cta" disabled={busy} onClick={onPlan}>
            Add to planner →
          </button>
          <button type="button" className="link-inline" disabled={busy} onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      ) : null}
    </Card>
  );
}

/** AI article ideas from Search Console opportunities, which the team plans or dismisses. */
export function TopicRecommendations({ onPlanned }: { onPlanned: (item: ContentItem) => void }) {
  const user = useCurrentUser();
  const canEdit = user.role !== 'viewer';
  // Set while waiting for a run the user started: the start time of the run before it, or null when there was none.
  const [waitingAfter, setWaitingAfter] = useState<string | null | undefined>(undefined);
  const waiting = waitingAfter !== undefined;
  const topics = useTopics(waiting);
  const run = useRunTopics();
  const plan = usePlanTopic();
  const dismiss = useDismissTopic();

  const lastRun = topics.data?.lastRun ?? null;
  useEffect(() => {
    if (!waiting || !lastRun) return;
    if (lastRun.startedAt !== waitingAfter && lastRun.status !== 'running') setWaitingAfter(undefined);
  }, [waiting, waitingAfter, lastRun]);

  const error = run.error ?? plan.error ?? dismiss.error;

  return (
    <div className="mt-32">
      <div className="topics-head">
        <div>
          <div className="section-title">AI Topic Recommendations</div>
          <div className="topics-head__note">
            From real searches where the site ranks 8–50, refreshed every Monday.{' '}
            {topics.data ? (waiting ? 'Generating new ideas… this takes about a minute.' : lastRunNote(lastRun)) : null}
          </div>
        </div>
        {canEdit && topics.data?.configured ? (
          <button
            type="button"
            className="btn btn--ghost settings-form__button"
            disabled={waiting || run.isPending || lastRun?.status === 'running'}
            onClick={() =>
              run.mutate(undefined, { onSuccess: () => setWaitingAfter(lastRun?.startedAt ?? null) })
            }
          >
            {waiting ? 'Generating…' : 'Generate new ideas'}
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="planner-notice" role="alert">
          {error.message}
        </div>
      ) : null}

      <QueryState query={topics}>
        {(data) =>
          !data.configured ? (
            <div className="planner-empty">Set OPENROUTER_API_KEY in .env to get topic recommendations.</div>
          ) : data.items.length === 0 ? (
            <div className="planner-empty">
              No open recommendations.{canEdit ? ' Generate new ideas, or wait for Monday’s run.' : ''}
            </div>
          ) : (
            <div className="topic-grid">
              {data.items.map((topic) => (
                <TopicCard
                  key={topic.id}
                  topic={topic}
                  canEdit={canEdit}
                  busy={plan.isPending || dismiss.isPending}
                  onPlan={() => plan.mutate(topic.id, { onSuccess: onPlanned })}
                  onDismiss={() => dismiss.mutate(topic.id)}
                />
              ))}
            </div>
          )
        }
      </QueryState>
    </div>
  );
}
