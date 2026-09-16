import { useEffect, useMemo, useState } from 'react';
import {
  canMoveToStage,
  CONTENT_PRIORITIES,
  CONTENT_STAGES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  PRIORITY_LABELS,
  STAGE_LABELS,
  weekStart,
  type ContentInput,
  type ContentItem,
  type ContentPriority,
  type ContentStage,
  type ContentType,
} from '../../shared/planner';
import { AI_TASK_LABELS, isAiBusy, QA_VERDICT_LABELS } from '../../shared/aiContent';
import { addDays } from '../../shared/seo';
import { useContentItems, useMoveContent } from '../api/planner';
import { useCurrentUser } from '../components/AuthGate';
import { ContentEditor } from '../components/ContentEditor';
import { QueryState } from '../components/QueryState';
import { Requires } from '../components/Requires';
import { TopicRecommendations } from '../components/TopicRecommendations';
import { Chip, PageHeader } from '../components/primitives';
import { formatDate } from '../lib/format';
import { platformTone, toneStyle } from '../lib/theme';

export const PLANNER_VIEWS = ['Calendar', 'Kanban', 'List'] as const;

export type PlannerView = Lowercase<(typeof PLANNER_VIEWS)[number]>;

/** The view labels as they appear in the URL. */
export const PLANNER_VIEW_KEYS = PLANNER_VIEWS.map((label) => label.toLowerCase() as PlannerView);

/** What the + Create menu can start, as the `new` URL parameter. */
const CREATE_DEFAULTS: Record<string, Partial<ContentInput>> = {
  article: { type: 'article', stage: 'drafting' },
  social: { type: 'instagram', stage: 'drafting' },
  idea: { type: 'article', stage: 'idea' },
};

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const today = () => new Date().toLocaleDateString('en-CA');

interface Filters {
  query: string;
  type: 'all' | ContentType;
  stage: 'all' | ContentStage;
  priority: 'all' | ContentPriority;
  /** "all", "none" for unassigned, or a user id. */
  owner: string;
  cluster: string;
  campaign: string;
}

const NO_FILTERS: Filters = {
  query: '',
  type: 'all',
  stage: 'all',
  priority: 'all',
  owner: 'all',
  cluster: 'all',
  campaign: 'all',
};

function applyFilters(items: ContentItem[], filters: Filters, view: PlannerView): ContentItem[] {
  const needle = filters.query.trim().toLowerCase();
  return items.filter((item) => {
    if (filters.type !== 'all' && item.type !== filters.type) return false;
    // The kanban shows every stage as its own column.
    if (view !== 'kanban' && filters.stage !== 'all' && item.stage !== filters.stage) return false;
    if (filters.priority !== 'all' && item.priority !== filters.priority) return false;
    if (filters.owner === 'none' && item.ownerId !== null) return false;
    if (filters.owner !== 'all' && filters.owner !== 'none' && item.ownerId !== filters.owner) return false;
    if (filters.cluster !== 'all' && item.cluster !== filters.cluster) return false;
    if (filters.campaign !== 'all' && item.campaign !== filters.campaign) return false;
    return !needle || item.title.toLowerCase().includes(needle) || (item.keyword ?? '').toLowerCase().includes(needle);
  });
}

const distinct = (values: Array<string | null>): string[] =>
  [...new Set(values.filter((value): value is string => Boolean(value)))].sort();

function PlannerFilters({
  items,
  filters,
  view,
  onChange,
}: {
  items: ContentItem[];
  filters: Filters;
  view: PlannerView;
  onChange: (filters: Filters) => void;
}) {
  const owners = useMemo(() => {
    const byId = new Map(items.filter((item) => item.ownerId).map((item) => [item.ownerId!, item.ownerName ?? 'Unknown']));
    return [...byId].sort((a, b) => a[1].localeCompare(b[1]));
  }, [items]);
  const clusters = useMemo(() => distinct(items.map((item) => item.cluster)), [items]);
  const campaigns = useMemo(() => distinct(items.map((item) => item.campaign)), [items]);
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) => onChange({ ...filters, [key]: value });
  const active = JSON.stringify(filters) !== JSON.stringify(NO_FILTERS);

  return (
    <div className="filter-row">
      <input
        type="search"
        className="planner-search"
        placeholder="Search title or keyword…"
        aria-label="Search content"
        value={filters.query}
        onChange={(event) => set('query', event.target.value)}
      />
      <select
        className="select-pill"
        aria-label="Filter by type"
        value={filters.type}
        onChange={(event) => set('type', event.target.value as Filters['type'])}
      >
        <option value="all">Type: All</option>
        {CONTENT_TYPES.map((type) => (
          <option key={type} value={type}>
            Type: {CONTENT_TYPE_LABELS[type]}
          </option>
        ))}
      </select>
      {view !== 'kanban' ? (
        <select
          className="select-pill"
          aria-label="Filter by stage"
          value={filters.stage}
          onChange={(event) => set('stage', event.target.value as Filters['stage'])}
        >
          <option value="all">Stage: All</option>
          {CONTENT_STAGES.map((stage) => (
            <option key={stage} value={stage}>
              Stage: {STAGE_LABELS[stage]}
            </option>
          ))}
        </select>
      ) : null}
      <select
        className="select-pill"
        aria-label="Filter by priority"
        value={filters.priority}
        onChange={(event) => set('priority', event.target.value as Filters['priority'])}
      >
        <option value="all">Priority: All</option>
        {CONTENT_PRIORITIES.map((priority) => (
          <option key={priority} value={priority}>
            Priority: {PRIORITY_LABELS[priority]}
          </option>
        ))}
      </select>
      <select
        className="select-pill"
        aria-label="Filter by owner"
        value={filters.owner}
        onChange={(event) => set('owner', event.target.value)}
      >
        <option value="all">Owner: All</option>
        <option value="none">Owner: Unassigned</option>
        {owners.map(([id, name]) => (
          <option key={id} value={id}>
            Owner: {name}
          </option>
        ))}
      </select>
      {clusters.length > 0 ? (
        <select
          className="select-pill"
          aria-label="Filter by topic cluster"
          value={filters.cluster}
          onChange={(event) => set('cluster', event.target.value)}
        >
          <option value="all">Cluster: All</option>
          {clusters.map((cluster) => (
            <option key={cluster} value={cluster}>
              Cluster: {cluster}
            </option>
          ))}
        </select>
      ) : null}
      {campaigns.length > 0 ? (
        <select
          className="select-pill"
          aria-label="Filter by campaign"
          value={filters.campaign}
          onChange={(event) => set('campaign', event.target.value)}
        >
          <option value="all">Campaign: All</option>
          {campaigns.map((campaign) => (
            <option key={campaign} value={campaign}>
              Campaign: {campaign}
            </option>
          ))}
        </select>
      ) : null}
      {active ? (
        <button type="button" className="link-inline" onClick={() => onChange(NO_FILTERS)}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}

function TypeChip({ item }: { item: ContentItem }) {
  const label = CONTENT_TYPE_LABELS[item.type];
  return <Chip tone={platformTone(label)}>{label}</Chip>;
}

/** The AI writer's progress on a card: working, failed, or the QA verdict. */
function AiLine({ item }: { item: ContentItem }) {
  const { ai } = item;
  const label = AI_TASK_LABELS[ai.task ?? 'brief'];
  if (isAiBusy(ai)) return <div className="kanban-card__ai">AI writing the {label}…</div>;
  if (ai.status === 'failed') return <div className="kanban-card__ai kanban-card__ai--fail">AI {label} failed</div>;
  if (ai.qaVerdict) {
    return (
      <div className={`kanban-card__ai kanban-card__ai--${ai.qaVerdict}`}>{QA_VERDICT_LABELS[ai.qaVerdict]}</div>
    );
  }
  if (ai.hasBrief) return <div className="kanban-card__ai">Brief ready</div>;
  return null;
}

function KanbanView({
  items,
  canEdit,
  onOpen,
  onMove,
}: {
  items: ContentItem[];
  canEdit: boolean;
  onOpen: (item: ContentItem) => void;
  onMove: (id: string, stage: ContentStage) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overStage, setOverStage] = useState<ContentStage | null>(null);

  return (
    <div className="kanban">
      {CONTENT_STAGES.map((stage) => {
        const cards = items.filter((item) => item.stage === stage);
        return (
          <div
            key={stage}
            className={overStage === stage ? 'kanban__col kanban__col--over' : 'kanban__col'}
            onDragOver={(event) => {
              if (!draggingId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
              if (overStage !== stage) setOverStage(stage);
            }}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOverStage(null);
            }}
            onDrop={(event) => {
              event.preventDefault();
              const id = event.dataTransfer.getData('text/plain');
              setOverStage(null);
              setDraggingId(null);
              if (id) onMove(id, stage);
            }}
          >
            <div className="kanban__col-head">
              {STAGE_LABELS[stage]} <span className="kanban__count">{cards.length}</span>
            </div>
            <div className="kanban__cards">
              {cards.length === 0 ? <div className="kanban__empty">{canEdit ? 'Drop content here' : 'Nothing here'}</div> : null}
              {cards.map((item) => (
                <div
                  key={item.id}
                  className={draggingId === item.id ? 'kanban-card kanban-card--dragging' : 'kanban-card'}
                  draggable={canEdit}
                  role="button"
                  tabIndex={0}
                  aria-label={`${item.title}, ${STAGE_LABELS[item.stage]}. Open to edit or change the stage.`}
                  onDragStart={(event) => {
                    event.dataTransfer.setData('text/plain', item.id);
                    event.dataTransfer.effectAllowed = 'move';
                    setDraggingId(item.id);
                  }}
                  onDragEnd={() => {
                    setDraggingId(null);
                    setOverStage(null);
                  }}
                  onClick={() => onOpen(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      onOpen(item);
                    }
                  }}
                >
                  <div className="kanban-card__title">{item.title}</div>
                  {item.keyword ? <div className="kanban-card__keyword">{item.keyword}</div> : null}
                  <AiLine item={item} />
                  <div className="kanban-card__meta">
                    <span>{item.ownerName ?? 'Unassigned'}</span>
                    {item.priority === 'high' ? <span className="kanban-card__priority">High priority</span> : null}
                  </div>
                  <div className="kanban-card__foot">
                    <TypeChip item={item} />
                    <span className="kanban-card__due">{item.dueDate ? formatDate(item.dueDate, false) : 'No date'}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CalendarView({
  items,
  canEdit,
  onOpen,
  onCreateOn,
}: {
  items: ContentItem[];
  canEdit: boolean;
  onOpen: (item: ContentItem) => void;
  onCreateOn: (dueDate: string) => void;
}) {
  const now = today();
  const [start, setStart] = useState(() => weekStart(now));
  const days = Array.from({ length: 7 }, (_, index) => addDays(start, index));
  const undated = items.filter((item) => !item.dueDate).length;

  return (
    <>
      <div className="calendar-nav">
        <button type="button" className="btn btn--ghost settings-form__button" onClick={() => setStart(addDays(start, -7))}>
          ‹ Previous week
        </button>
        <button type="button" className="btn btn--ghost settings-form__button" onClick={() => setStart(weekStart(now))}>
          This week
        </button>
        <button type="button" className="btn btn--ghost settings-form__button" onClick={() => setStart(addDays(start, 7))}>
          Next week ›
        </button>
        <span className="calendar-nav__range">
          {formatDate(days[0], false)} – {formatDate(days[6])}
        </span>
      </div>
      <div className="table-scroll">
        <div className="calendar week-grid">
          {days.map((day, index) => (
            <div key={day} className={day === now ? 'calendar__day calendar__day--today' : 'calendar__day'}>
              <div className="calendar__day-label">
                {WEEKDAYS[index]} {Number(day.slice(8))}
              </div>
              {items
                .filter((item) => item.dueDate === day)
                .map((item) => (
                  <button
                    type="button"
                    key={item.id}
                    className="calendar__item calendar__item--button"
                    style={toneStyle(platformTone(CONTENT_TYPE_LABELS[item.type]))}
                    title={`${item.title} (${STAGE_LABELS[item.stage]})`}
                    onClick={() => onOpen(item)}
                  >
                    {item.title}
                  </button>
                ))}
              {canEdit ? (
                <button
                  type="button"
                  className="calendar__add"
                  aria-label={`Add content due ${formatDate(day)}`}
                  onClick={() => onCreateOn(day)}
                >
                  + Add
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      {undated > 0 ? (
        <div className="calendar__note">
          {undated} item{undated === 1 ? ' has' : 's have'} no due date, so {undated === 1 ? 'it is' : 'they are'} not in the
          calendar.
        </div>
      ) : null}
    </>
  );
}

function ListView({ items, onOpen }: { items: ContentItem[]; onOpen: (item: ContentItem) => void }) {
  const rows = [...items].sort(
    (a, b) => (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') || a.title.localeCompare(b.title),
  );
  return (
    <div className="card card--table">
      {rows.length === 0 ? (
        <div className="table-empty">No content matches these filters.</div>
      ) : (
        <div className="table-scroll">
          <table className="data-table data-table--pad clickable-rows">
            <thead>
              <tr>
                <th>TITLE</th>
                <th>STAGE</th>
                <th>TYPE</th>
                <th>PRIORITY</th>
                <th>OWNER</th>
                <th>KEYWORD</th>
                <th>DUE</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item) => (
                <tr
                  key={item.id}
                  tabIndex={0}
                  onClick={() => onOpen(item)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(item);
                  }}
                >
                  <td className="cell-strong">{item.title}</td>
                  <td className="cell-text">{STAGE_LABELS[item.stage]}</td>
                  <td>
                    <TypeChip item={item} />
                  </td>
                  <td className="cell-text">{PRIORITY_LABELS[item.priority]}</td>
                  <td className="cell-text">{item.ownerName ?? 'Unassigned'}</td>
                  <td className="cell-muted">{item.keyword ?? '—'}</td>
                  <td className="cell-faint">{item.dueDate ? formatDate(item.dueDate) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

type EditorState = { item: ContentItem | null; defaults: Partial<ContentInput> } | null;

export function Planner({
  view,
  onViewChange,
  createKind,
  onCreateHandled,
}: {
  view: PlannerView;
  onViewChange: (view: PlannerView) => void;
  /** Set when the + Create menu opened the planner to start a new item. */
  createKind: string | null;
  onCreateHandled: () => void;
}) {
  const user = useCurrentUser();
  const canEdit = user.role !== 'viewer';
  const content = useContentItems();
  const move = useMoveContent();
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [editor, setEditor] = useState<EditorState>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!createKind) return;
    const defaults = CREATE_DEFAULTS[createKind];
    if (defaults && canEdit) setEditor({ item: null, defaults });
    onCreateHandled();
  }, [createKind, canEdit, onCreateHandled]);

  const openItem = (item: ContentItem) => setEditor({ item, defaults: {} });

  const moveItem = (id: string, stage: ContentStage) => {
    const item = content.data?.find((entry) => entry.id === id);
    if (!item || item.stage === stage) return;
    if (!canMoveToStage(user.role, stage)) {
      setNotice(`Only an approver can move content to ${STAGE_LABELS[stage]}.`);
      return;
    }
    setNotice(null);
    move.mutate({ item, stage }, { onError: (error) => setNotice(error.message) });
  };

  return (
    <div>
      <PageHeader
        title="Content Planner"
        subtitle="Editorial calendar across articles and social channels"
        actions={
          <div className="page-head__actions">
            <div className="segmented" role="group" aria-label="Planner view">
              {PLANNER_VIEWS.map((label) => {
                const key = label.toLowerCase() as PlannerView;
                return (
                  <button key={key} type="button" aria-pressed={view === key} onClick={() => onViewChange(key)}>
                    {label}
                  </button>
                );
              })}
            </div>
            {canEdit ? (
              <button type="button" className="btn btn--page" onClick={() => setEditor({ item: null, defaults: {} })}>
                + New Content
              </button>
            ) : null}
          </div>
        }
      />

      <Requires capability="content">
        <QueryState query={content}>
          {(items) => {
            const shown = applyFilters(items, filters, view);
            return (
              <>
                <PlannerFilters items={items} filters={filters} view={view} onChange={setFilters} />
                {notice ? (
                  <div className="planner-notice" role="alert">
                    {notice}
                  </div>
                ) : null}
                {items.length === 0 ? (
                  <div className="planner-empty">
                    No content planned yet.
                    {canEdit ? ' Start with + New Content, or the + Create menu at the top.' : ''}
                  </div>
                ) : null}
                {view === 'kanban' ? (
                  <KanbanView items={shown} canEdit={canEdit} onOpen={openItem} onMove={moveItem} />
                ) : null}
                {view === 'calendar' ? (
                  <CalendarView
                    items={shown}
                    canEdit={canEdit}
                    onOpen={openItem}
                    onCreateOn={(dueDate) => setEditor({ item: null, defaults: { dueDate } })}
                  />
                ) : null}
                {view === 'list' ? <ListView items={shown} onOpen={openItem} /> : null}
              </>
            );
          }}
        </QueryState>
      </Requires>

      <TopicRecommendations onPlanned={openItem} />

      {editor ? (
        <ContentEditor
          key={editor.item?.id ?? 'new'}
          // The live copy, so a stage the AI writer moved shows up while the drawer is open.
          item={editor.item ? (content.data?.find((entry) => entry.id === editor.item?.id) ?? editor.item) : null}
          defaults={editor.defaults}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </div>
  );
}
