import { Requires } from '../components/Requires';
import { Card } from '../components/primitives';
import { APPROVAL_QUEUE, APPROVAL_TIMELINE } from '../data/workflow';

export function Approval({
  selectedId,
  onSelect,
}: {
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  const selected = APPROVAL_QUEUE.find((item) => item.id === selectedId) ?? APPROVAL_QUEUE[0];

  return (
    <div>
      <div className="mb-20">
        <div className="page-title">Approval Queue</div>
        <div className="page-subtitle">Human-in-the-loop review before publishing</div>
      </div>

      <Requires capability="content">
        <div className="approval-layout">
          <div className="approval-queue">
            {APPROVAL_QUEUE.map((item) => (
              <button
                key={item.id}
                type="button"
                className={
                  item.id === selected.id ? 'approval-item approval-item--selected' : 'approval-item'
                }
                aria-pressed={item.id === selected.id}
                onClick={() => onSelect(item.id)}
              >
                <div className="approval-item__head">
                  <span className="approval-item__type">{item.type}</span>
                  <span className="approval-item__submitted">{item.submitted}</span>
                </div>
                <div className="approval-item__title">{item.title}</div>
                <div className="approval-item__author">by {item.author}</div>
              </button>
            ))}
          </div>

          <Card className="card--lg">
            <div>
              <div className="approval-detail__type">{selected.type}</div>
              <div className="approval-detail__title">{selected.title}</div>
              <div className="approval-detail__byline">
                Submitted by {selected.author} · {selected.submitted}
              </div>
            </div>

            <div className="approval-detail__preview">{selected.preview}</div>

            <div className="score-grid">
              <div className="score-box">
                <div className="score-box__label">AI QA SCORE</div>
                <div className="score-box__value">{selected.qa}</div>
              </div>
              <div className="score-box">
                <div className="score-box__label">SEO SCORE</div>
                <div className="score-box__value">{selected.seo}</div>
              </div>
              <div className="score-box">
                <div className="score-box__label">BRAND COMPLIANCE</div>
                <div className="score-box__value">{selected.brand}</div>
              </div>
            </div>

            <div className="approval-meta">
              <div>
                <div className="approval-meta__label">SOURCES CHECKED</div>
                <div className="field-value">{selected.sources} references verified</div>
              </div>
              <div>
                <div className="approval-meta__label">POTENTIAL RISKS</div>
                <div className="field-value field-value--body">{selected.risks}</div>
              </div>
            </div>

            <div className="approval-actions">
              <button type="button" className="btn--approve">
                Approve
              </button>
              <button type="button" className="btn--revise">
                Request Revision
              </button>
              <button type="button" className="btn--reject">
                Reject
              </button>
            </div>

            <div className="approval-timeline__label">APPROVAL TIMELINE</div>
            <div>
              {APPROVAL_TIMELINE.map((step) => (
                <div className="approval-timeline__row" key={step.step}>
                  <div
                    className="approval-timeline__dot"
                    style={{ background: step.done ? 'var(--green)' : 'var(--border)' }}
                  />
                  <div className="approval-timeline__body">
                    <span className="approval-timeline__step">{step.step}</span>
                    <span className="approval-timeline__time">{step.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </Requires>
    </div>
  );
}
