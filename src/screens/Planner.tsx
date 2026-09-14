import { useMemo } from 'react';
import { Requires } from '../components/Requires';
import { Card, Chip, PageHeader } from '../components/primitives';
import {
  CALENDAR_DAY_NAMES,
  CALENDAR_SEED,
  KANBAN_DATA,
  PLANNER_FILTERS,
  TOPIC_RECOMMENDATIONS,
} from '../data/editorial';
import { platformTone, toneStyle } from '../lib/theme';

export const PLANNER_VIEWS = ['Calendar', 'Kanban', 'List'] as const;

export type PlannerView = Lowercase<(typeof PLANNER_VIEWS)[number]>;

/** The view labels as they appear in the URL. */
export const PLANNER_VIEW_KEYS = PLANNER_VIEWS.map(
  (label) => label.toLowerCase() as PlannerView,
);

function KanbanView() {
  return (
    <div className="kanban">
      {KANBAN_DATA.map((column) => (
        <div className="kanban__col" key={column.name}>
          <div className="kanban__col-head">
            {column.name} <span className="kanban__count">{column.cards.length}</span>
          </div>
          <div className="kanban__cards">
            {column.cards.map((card) => (
              <div className="kanban-card" key={card.title}>
                <div className="kanban-card__title">{card.title}</div>
                <div className="kanban-card__keyword">{card.keyword}</div>
                <div className="kanban-card__foot">
                  <Chip tone={platformTone(card.platform)}>{card.platform}</Chip>
                  <span className="kanban-card__due">{card.due}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarView() {
  return (
    <div className="calendar">
      {CALENDAR_DAY_NAMES.map((label, index) => (
        <div className="calendar__day" key={label}>
          <div className="calendar__day-label">{label}</div>
          {CALENDAR_SEED[index].map((entry) => (
            <div className="calendar__item" key={entry.title} style={toneStyle(platformTone(entry.platform))}>
              {entry.title}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function ListView() {
  // The list view is the kanban board flattened, one row per card.
  const rows = useMemo(
    () =>
      KANBAN_DATA.flatMap((column) =>
        column.cards.map((card) => ({ ...card, column: column.name, owner: 'Nadia R.' })),
      ),
    [],
  );

  return (
    <div className="card card--table">
      <div className="table-scroll">
        <table className="data-table data-table--pad">
          <thead>
            <tr>
              <th>Title</th>
              <th>Column</th>
              <th>Platform</th>
              <th>Owner</th>
              <th>Due</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={`${row.column}-${row.title}`}>
                <td className="cell-strong">{row.title}</td>
                <td className="cell-text">{row.column}</td>
                <td>
                  <Chip tone={platformTone(row.platform)}>{row.platform}</Chip>
                </td>
                <td className="cell-text">{row.owner}</td>
                <td className="cell-faint">{row.due}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function Planner({
  view,
  onViewChange,
}: {
  view: PlannerView;
  onViewChange: (view: PlannerView) => void;
}) {
  return (
    <div>
      <PageHeader
        title="Content Planner"
        subtitle="Editorial calendar across articles and social channels"
        actions={
          <div className="segmented" role="group" aria-label="Planner view">
            {PLANNER_VIEWS.map((label) => {
              const key = label.toLowerCase() as PlannerView;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={view === key}
                  onClick={() => onViewChange(key)}
                >
                  {label}
                </button>
              );
            })}
          </div>
        }
      />

      <div className="filter-row">
        {PLANNER_FILTERS.map((filter) => (
          <div className="filter-pill" key={filter}>
            {filter}
          </div>
        ))}
      </div>

      <Requires capability="content">
        {view === 'kanban' ? <KanbanView /> : null}
        {view === 'calendar' ? <CalendarView /> : null}
        {view === 'list' ? <ListView /> : null}
      </Requires>

      <div className="mt-32">
        <div className="section-title">AI Topic Recommendations</div>
        <Requires capability="ai">
          <div className="topic-grid">
            {TOPIC_RECOMMENDATIONS.map((topic) => (
              <Card className="card--sm" key={topic.kw}>
                <div className="topic-card__head">
                  <div className="topic-card__kw">{topic.kw}</div>
                  <div className="topic-card__score">{topic.score}</div>
                </div>
                <div className="topic-card__meta">Intent: {topic.intent}</div>
                <div className="topic-card__meta">Relevance: {topic.relevance}</div>
                <div className="topic-card__rec">Recommendation: {topic.type}</div>
                <button type="button" className="link-cta topic-card__cta">
                  {topic.cta} →
                </button>
              </Card>
            ))}
          </div>
        </Requires>
      </div>
    </div>
  );
}
