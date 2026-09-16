import { useId, useState, type ReactNode } from 'react';
import {
  ARTICLE_LANGUAGES,
  type BrandKnowledge,
  type BrandSettingsResponse,
  type ExampleArticle,
} from '../../shared/brand';
import { useBrandSettings, useSaveBrandSettings } from '../api/brand';
import { formatDateTime } from '../lib/format';
import { QueryState } from './QueryState';
import { Card } from './primitives';

const LANGUAGE_LABELS = { id: 'Indonesian', en: 'English' } as const;

function Field({ label, hint, children }: { label: string; hint?: string; children: (id: string) => ReactNode }) {
  const id = useId();
  return (
    <div className="settings-field">
      <label className="settings-field__label" htmlFor={id}>
        {label}
      </label>
      {children(id)}
      {hint ? <div className="settings-field__hint">{hint}</div> : null}
    </div>
  );
}

function ExampleRows({
  examples,
  onChange,
}: {
  examples: ExampleArticle[];
  onChange: (examples: ExampleArticle[]) => void;
}) {
  const update = (index: number, patch: Partial<ExampleArticle>) =>
    onChange(examples.map((example, at) => (at === index ? { ...example, ...patch } : example)));

  return (
    <div className="example-list">
      {examples.map((example, index) => (
        <div className="example-row" key={index}>
          <div className="example-row__fields">
            <input
              aria-label={`Example ${index + 1} title`}
              placeholder="Title"
              value={example.title}
              onChange={(event) => update(index, { title: event.target.value })}
            />
            <input
              aria-label={`Example ${index + 1} URL`}
              placeholder="https://tsicertification.com/blog/…"
              value={example.url}
              onChange={(event) => update(index, { url: event.target.value })}
            />
            <textarea
              aria-label={`Example ${index + 1} reason`}
              placeholder="Why it is a good example"
              rows={2}
              value={example.reason}
              onChange={(event) => update(index, { reason: event.target.value })}
            />
          </div>
          <button
            type="button"
            className="btn btn--ghost settings-form__button"
            aria-label={`Remove example ${index + 1}`}
            onClick={() => onChange(examples.filter((_, at) => at !== index))}
          >
            Remove
          </button>
        </div>
      ))}
      {examples.length < 20 ? (
        <button
          type="button"
          className="btn btn--ghost settings-form__button example-list__add"
          onClick={() => onChange([...examples, { url: '', title: '', reason: '' }])}
        >
          + Add example
        </button>
      ) : null}
    </div>
  );
}

function BrandForm({ data, canEdit }: { data: BrandSettingsResponse; canEdit: boolean }) {
  const [form, setForm] = useState<BrandKnowledge>(data.knowledge);
  const save = useSaveBrandSettings();
  const dirty = JSON.stringify(form) !== JSON.stringify(data.knowledge);
  const set = <K extends keyof BrandKnowledge>(key: K, value: BrandKnowledge[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const setAi = <K extends keyof BrandKnowledge['ai']>(key: K, value: BrandKnowledge['ai'][K]) =>
    setForm((current) => ({ ...current, ai: { ...current.ai, [key]: value } }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate(form, { onSuccess: (saved) => setForm(saved.knowledge) });
      }}
    >
      {!canEdit ? <div className="settings-form__notice">Only admins can change these settings.</div> : null}
      <div className="settings-intro">
        What the AI knows and must follow when it writes for TSI.{' '}
        {data.savedAt
          ? `Last saved ${formatDateTime(data.savedAt)}${data.savedBy ? ` by ${data.savedBy}` : ''}.`
          : 'This is the first version, researched from tsicertification.com on 15 September 2026 and not saved yet.'}
      </div>

      <fieldset className="settings-form__fields settings-form__fields--wide" disabled={!canEdit || save.isPending}>
        <div className="settings-group-title">Brand</div>

        <Field label="Company profile" hint="Facts the AI may state about TSI. Anything not written here, it must not claim.">
          {(id) => (
            <textarea id={id} rows={14} value={form.companyProfile} onChange={(event) => set('companyProfile', event.target.value)} />
          )}
        </Field>

        <Field label="Tone of voice" hint="Personality, language rules, the article structure that works, and words to avoid.">
          {(id) => <textarea id={id} rows={16} value={form.toneOfVoice} onChange={(event) => set('toneOfVoice', event.target.value)} />}
        </Field>

        <Field label="CTA rules" hint="Where calls to action go, where they link, approved wording, and what is forbidden.">
          {(id) => <textarea id={id} rows={14} value={form.ctaRules} onChange={(event) => set('ctaRules', event.target.value)} />}
        </Field>

        <div className="settings-group-title">Impartiality</div>

        <div className={form.impartialityStatus === 'draft' ? 'impartiality-status impartiality-status--draft' : 'impartiality-status'}>
          {form.impartialityStatus === 'draft'
            ? 'Draft: needs approval from compliance. The AI follows these rules either way.'
            : `Approved by ${form.impartialityApprovedBy ?? '—'} on ${form.impartialityApprovedOn ?? '—'}.`}
        </div>

        <Field label="Impartiality rules" hint="The AI treats these as binding and refuses content that would break them.">
          {(id) => (
            <textarea id={id} rows={18} value={form.impartialityRules} onChange={(event) => set('impartialityRules', event.target.value)} />
          )}
        </Field>

        <div className="settings-inline">
          <Field label="Status">
            {(id) => (
              <select
                id={id}
                value={form.impartialityStatus}
                onChange={(event) => set('impartialityStatus', event.target.value as BrandKnowledge['impartialityStatus'])}
              >
                <option value="draft">Draft</option>
                <option value="approved">Approved by compliance</option>
              </select>
            )}
          </Field>
          {form.impartialityStatus === 'approved' ? (
            <>
              <Field label="Approved by">
                {(id) => (
                  <input
                    id={id}
                    value={form.impartialityApprovedBy ?? ''}
                    onChange={(event) => set('impartialityApprovedBy', event.target.value || null)}
                  />
                )}
              </Field>
              <Field label="Approved on">
                {(id) => (
                  <input
                    id={id}
                    type="date"
                    value={form.impartialityApprovedOn ?? ''}
                    onChange={(event) => set('impartialityApprovedOn', event.target.value || null)}
                  />
                )}
              </Field>
            </>
          ) : null}
        </div>

        <div className="settings-group-title">Example articles</div>
        <div className="settings-field__hint">
          Articles whose structure and depth the AI should match. It never copies their text.
        </div>
        <ExampleRows examples={form.exampleArticles} onChange={(examples) => set('exampleArticles', examples)} />

        <div className="settings-group-title">AI writing</div>
        <div className="settings-inline">
          <Field label="Article language">
            {(id) => (
              <select id={id} value={form.ai.language} onChange={(event) => setAi('language', event.target.value as BrandKnowledge['ai']['language'])}>
                {ARTICLE_LANGUAGES.map((language) => (
                  <option key={language} value={language}>
                    {LANGUAGE_LABELS[language]}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Minimum words">
            {(id) => (
              <input id={id} type="number" min={200} max={5000} value={form.ai.minWords} onChange={(event) => setAi('minWords', Number(event.target.value))} />
            )}
          </Field>
          <Field label="Maximum words">
            {(id) => (
              <input id={id} type="number" min={200} max={8000} value={form.ai.maxWords} onChange={(event) => setAi('maxWords', Number(event.target.value))} />
            )}
          </Field>
        </div>
        <label className="job-toggle">
          <input type="checkbox" checked={form.ai.includeFaq} onChange={(event) => setAi('includeFaq', event.target.checked)} />
          Add a short FAQ section when the topic suits it
        </label>
        <Field label="Byline">
          {(id) => <input id={id} value={form.ai.authorLine} onChange={(event) => setAi('authorLine', event.target.value)} />}
        </Field>
      </fieldset>

      {canEdit ? (
        <div className="settings-form__actions">
          <button type="submit" className="btn btn--primary settings-form__button" disabled={(!dirty && data.savedAt !== null) || save.isPending}>
            {save.isPending ? 'Saving…' : data.savedAt ? 'Save changes' : 'Save this version'}
          </button>
          <button
            type="button"
            className="btn btn--ghost settings-form__button"
            disabled={!dirty || save.isPending}
            onClick={() => {
              save.reset();
              setForm(data.knowledge);
            }}
          >
            Discard
          </button>
          {save.isError ? (
            <span className="settings-form__error" role="alert">
              {save.error.message}
            </span>
          ) : null}
          {save.isSuccess && !dirty ? (
            <span className="settings-form__saved" role="status">
              Saved. The AI uses this version from now on.
            </span>
          ) : null}
        </div>
      ) : null}

      <div className="settings-group-title">Approvers</div>
      <div className="settings-field__hint">
        Active users who can approve content: approvers and admins. Change roles with{' '}
        <code>npm run cli -- user:add &lt;email&gt; approver</code>.
      </div>
      <ul className="settings-list">
        {data.approvers.map((person) => (
          <li key={person.email}>
            {person.name ? `${person.name} · ` : ''}
            {person.email} <span className="settings-list__meta">{person.role}</span>
          </li>
        ))}
      </ul>

      <div className="settings-group-title">AI models</div>
      <div className="settings-field__hint">Set in the server configuration (AI_MODEL_* in .env).</div>
      <ul className="settings-list">
        {data.models.map((entry) => (
          <li key={entry.feature}>
            {entry.feature} <span className="settings-list__meta">{entry.model}</span>
          </li>
        ))}
      </ul>
    </form>
  );
}

export function BrandCard({ canEdit }: { canEdit: boolean }) {
  const brand = useBrandSettings();
  return (
    <Card className="mb-24">
      <div className="card-title mb-16">Brand and AI</div>
      <QueryState query={brand}>{(data) => <BrandForm key={data.savedAt ?? 'defaults'} data={data} canEdit={canEdit} />}</QueryState>
    </Card>
  );
}
