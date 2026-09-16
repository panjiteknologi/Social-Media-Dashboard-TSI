import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react';
import {
  canMoveToStage,
  CONTENT_PRIORITIES,
  CONTENT_STAGES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  PRIORITY_LABELS,
  STAGE_LABELS,
  type ContentEvent,
  type ContentInput,
  type ContentItem,
} from '../../shared/planner';
import { toContentInput, useContentEvents, useDeleteContent, useSaveContent, useTeam } from '../api/planner';
import { formatDateTime } from '../lib/format';
import { useCurrentUser } from './AuthGate';
import { ContentAiPanel } from './ContentAiPanel';
import { QueryState } from './QueryState';

type EditorTab = 'details' | 'ai' | 'history';

const TAB_LABELS: Record<EditorTab, string> = { details: 'Details', ai: 'AI Writer', history: 'History' };

const EMPTY: ContentInput = {
  title: '',
  type: 'article',
  stage: 'idea',
  keyword: null,
  campaign: null,
  priority: 'medium',
  dueDate: null,
  ownerId: null,
  notes: null,
};

/** The form keeps every field as text; blanks become null on save. */
type Form = Record<keyof ContentInput, string>;

const toForm = (input: ContentInput): Form => ({
  title: input.title,
  type: input.type,
  stage: input.stage,
  keyword: input.keyword ?? '',
  campaign: input.campaign ?? '',
  priority: input.priority,
  dueDate: input.dueDate ?? '',
  ownerId: input.ownerId ?? '',
  notes: input.notes ?? '',
});

const fromForm = (form: Form): ContentInput => ({
  title: form.title.trim(),
  type: form.type as ContentInput['type'],
  stage: form.stage as ContentInput['stage'],
  keyword: form.keyword.trim() || null,
  campaign: form.campaign.trim() || null,
  priority: form.priority as ContentInput['priority'],
  dueDate: form.dueDate || null,
  ownerId: form.ownerId || null,
  notes: form.notes.trim() || null,
});

function describeEvent(event: ContentEvent): string {
  if (event.kind === 'created') return `Created in ${event.toStage ? STAGE_LABELS[event.toStage] : 'the planner'}`;
  if (event.kind === 'stage_changed' && event.fromStage && event.toStage) {
    return `Moved from ${STAGE_LABELS[event.fromStage]} to ${STAGE_LABELS[event.toStage]}`;
  }
  return event.note ?? 'Edited';
}

function History({ itemId }: { itemId: string }) {
  const events = useContentEvents(itemId);
  return (
    <QueryState query={events}>
      {(list) =>
        list.length === 0 ? (
          <div className="empty-note">No history yet.</div>
        ) : (
          <div className="drawer-stack">
            {list.map((event) => (
              <div className="timeline-entry" key={event.id}>
                <div className="timeline-entry__dot" />
                <div>
                  <div className="timeline-entry__text">{describeEvent(event)}</div>
                  <div className="timeline-entry__time">
                    {formatDateTime(event.createdAt)}
                    {event.userName ? ` · ${event.userName}` : ''}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </QueryState>
  );
}

/** Creates or edits one piece of content, in the side drawer. */
export function ContentEditor({
  item,
  defaults,
  onClose,
}: {
  item: ContentItem | null;
  defaults: Partial<ContentInput>;
  onClose: () => void;
}) {
  const user = useCurrentUser();
  const canEdit = user.role !== 'viewer';
  const team = useTeam();
  const save = useSaveContent();
  const remove = useDeleteContent();
  const titleId = useId();
  const formId = useId();

  const [tab, setTab] = useState<EditorTab>('details');
  const [form, setForm] = useState<Form>(() => toForm(item ? toContentInput(item) : { ...EMPTY, ...defaults }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const tabs: EditorTab[] = item?.type === 'article' ? ['details', 'ai', 'history'] : ['details', 'history'];

  // The AI writer moves the stage while the drawer is open; follow it unless the person changed the stage here.
  const [shownStage, setShownStage] = useState(item?.stage);
  useEffect(() => {
    if (!item || item.stage === shownStage) return;
    setForm((current) => (current.stage === shownStage ? { ...current, stage: item.stage } : current));
    setShownStage(item.stage);
  }, [item, shownStage]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const set =
    (key: keyof Form) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm((current) => ({ ...current, [key]: event.target.value }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate({ id: item?.id ?? null, input: fromForm(form) }, { onSuccess: onClose });
  };

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        className={tab === 'ai' ? 'drawer drawer--wide' : 'drawer'}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer__head">
          <div>
            <div className="drawer__title" id={titleId}>
              {item ? item.title : 'New content'}
            </div>
            <div className="drawer__url">
              {item ? `${CONTENT_TYPE_LABELS[item.type]} · ${STAGE_LABELS[item.stage]}` : 'Content Planner'}
            </div>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        {item ? (
          <div className="drawer__tabs" role="tablist">
            {tabs.map((key) => (
              <button
                key={key}
                type="button"
                role="tab"
                className="drawer__tab"
                aria-selected={tab === key}
                onClick={() => setTab(key)}
              >
                {TAB_LABELS[key]}
              </button>
            ))}
          </div>
        ) : null}

        <div className="drawer__body" role={item ? 'tabpanel' : undefined}>
          {tab === 'history' && item ? (
            <History itemId={item.id} />
          ) : tab === 'ai' && item ? (
            <ContentAiPanel item={item} />
          ) : (
            <form id={formId} onSubmit={onSubmit}>
              <fieldset className="editor-form" disabled={!canEdit || save.isPending}>
                <label className="editor-field">
                  Title
                  <input required maxLength={200} value={form.title} onChange={set('title')} autoFocus={!item} />
                </label>

                <div className="editor-row">
                  <label className="editor-field">
                    Type
                    <select value={form.type} onChange={set('type')}>
                      {CONTENT_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {CONTENT_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="editor-field">
                    Stage
                    <select value={form.stage} onChange={set('stage')}>
                      {CONTENT_STAGES.map((stage) => (
                        <option
                          key={stage}
                          value={stage}
                          disabled={stage !== item?.stage && !canMoveToStage(user.role, stage)}
                        >
                          {STAGE_LABELS[stage]}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="editor-row">
                  <label className="editor-field">
                    Focus keyword
                    <input maxLength={120} value={form.keyword} onChange={set('keyword')} placeholder="sertifikasi iso 9001" />
                  </label>
                  <label className="editor-field">
                    Campaign
                    <input maxLength={120} value={form.campaign} onChange={set('campaign')} />
                  </label>
                </div>

                <div className="editor-row">
                  <label className="editor-field">
                    Priority
                    <select value={form.priority} onChange={set('priority')}>
                      {CONTENT_PRIORITIES.map((priority) => (
                        <option key={priority} value={priority}>
                          {PRIORITY_LABELS[priority]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="editor-field">
                    Due date
                    <input type="date" value={form.dueDate} onChange={set('dueDate')} />
                  </label>
                </div>

                <label className="editor-field">
                  Owner
                  <select value={form.ownerId} onChange={set('ownerId')}>
                    <option value="">Unassigned</option>
                    {team.data?.map((member) => (
                      <option key={member.id} value={member.id}>
                        {member.name ?? member.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="editor-field">
                  Notes
                  <textarea
                    rows={7}
                    maxLength={5000}
                    value={form.notes}
                    onChange={set('notes')}
                    placeholder="Angle, sources, links, and what the piece must cover"
                  />
                </label>

                {canEdit && !canMoveToStage(user.role, 'approved') ? (
                  <div className="editor-hint">Only approvers can move content to Approved.</div>
                ) : null}
              </fieldset>
            </form>
          )}
        </div>

        <div className="drawer__foot">
          {item && canEdit ? (
            confirmDelete ? (
              <>
                <span className="editor-hint">Delete this item and its history?</span>
                <button
                  type="button"
                  className="btn--reject"
                  disabled={remove.isPending}
                  onClick={() => remove.mutate(item.id, { onSuccess: onClose })}
                >
                  Delete
                </button>
                <button type="button" className="btn--ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </button>
              </>
            ) : (
              <button type="button" className="btn--ghost" onClick={() => setConfirmDelete(true)}>
                Delete
              </button>
            )
          ) : null}
          <span className="drawer__foot-spacer" />
          {save.isError ? (
            <span className="settings-form__error" role="alert">
              {save.error.message}
            </span>
          ) : null}
          {remove.isError ? (
            <span className="settings-form__error" role="alert">
              {remove.error.message}
            </span>
          ) : null}
          <button type="button" className="btn--ghost" onClick={onClose}>
            {canEdit ? 'Cancel' : 'Close'}
          </button>
          {canEdit && tab === 'details' ? (
            <button type="submit" form={formId} className="btn--dark" disabled={save.isPending || !form.title.trim()}>
              {save.isPending ? 'Saving…' : item ? 'Save' : 'Create'}
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
