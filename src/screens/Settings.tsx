import { useId, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import type { SeoSettings } from '../../shared/seo';
import { useSaveSeoSettings, useSeoSettings } from '../api/settings';
import { useCurrentUser } from '../components/AuthGate';
import { AutomationCard, ReportingCard } from '../components/AutomationSettings';
import { BrandCard } from '../components/BrandSettings';
import { QueryState } from '../components/QueryState';
import { Card, PageHeader } from '../components/primitives';

/** Settings areas from the design that arrive with later milestones. */
const LATER_SECTIONS = [
  { title: 'Approval rules', detail: 'Who approves what, and publishing restrictions', milestone: 'M5' },
  { title: 'Social accounts', detail: 'Facebook and Instagram connections', milestone: 'M7' },
];

interface FormState {
  minImpressions: string;
  priorityKeywords: string;
  brandTerms: string;
  dataStartDate: string;
  contentHost: string;
}

const toForm = (settings: SeoSettings): FormState => ({
  minImpressions: String(settings.minImpressions),
  priorityKeywords: settings.priorityKeywords.join('\n'),
  brandTerms: settings.brandTerms.join('\n'),
  dataStartDate: settings.dataStartDate,
  contentHost: settings.contentHost,
});

const lines = (text: string): string[] =>
  text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const fromForm = (form: FormState): SeoSettings => ({
  minImpressions: Number(form.minImpressions),
  priorityKeywords: lines(form.priorityKeywords),
  brandTerms: lines(form.brandTerms),
  dataStartDate: form.dataStartDate,
  contentHost: form.contentHost.trim(),
});

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: (id: string, hintId: string) => ReactNode;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="settings-field">
      <label className="settings-field__label" htmlFor={id}>
        {label}
      </label>
      {children(id, hintId)}
      <div className="settings-field__hint" id={hintId}>
        {hint}
      </div>
    </div>
  );
}

function SeoSettingsForm({ initial, canEdit }: { initial: SeoSettings; canEdit: boolean }) {
  const [form, setForm] = useState(() => toForm(initial));
  const save = useSaveSeoSettings();
  const dirty = JSON.stringify(form) !== JSON.stringify(toForm(initial));

  const update = (field: keyof FormState) => (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate(fromForm(form), { onSuccess: (saved) => setForm(toForm(saved)) });
  };

  return (
    <form className="settings-form" onSubmit={onSubmit}>
      {!canEdit ? <div className="settings-form__notice">Only admins can change these settings.</div> : null}

      <fieldset className="settings-form__fields" disabled={!canEdit || save.isPending}>
        <FormField
          label="Priority keywords"
          hint="Exact search queries, one per line. They always appear in the Keyword Tracker, and a Telegram message goes out on Monday morning when one of them drops."
        >
          {(id, hintId) => (
            <textarea
              id={id}
              aria-describedby={hintId}
              rows={5}
              value={form.priorityKeywords}
              onChange={update('priorityKeywords')}
              placeholder="sertifikasi iso"
            />
          )}
        </FormField>

        <FormField
          label="Minimum impressions"
          hint="A keyword needs this many impressions in 28 days before its position and movement are judged. Lower numbers show more keywords but more noise."
        >
          {(id, hintId) => (
            <input
              id={id}
              aria-describedby={hintId}
              type="number"
              min={1}
              max={10000}
              required
              value={form.minImpressions}
              onChange={update('minImpressions')}
            />
          )}
        </FormField>

        <FormField
          label="Brand terms"
          hint="One per line. Searches containing one of these words are brand searches and are left out of opportunities and cannibalization."
        >
          {(id, hintId) => (
            <textarea id={id} aria-describedby={hintId} rows={3} value={form.brandTerms} onChange={update('brandTerms')} />
          )}
        </FormField>

        <FormField
          label="Count search data from"
          hint="Search Console data before this date is ignored. The site relaunched on 7 May 2026; the months before hold spam from the old site and then no data at all."
        >
          {(id, hintId) => (
            <input
              id={id}
              aria-describedby={hintId}
              type="date"
              required
              value={form.dataStartDate}
              onChange={update('dataStartDate')}
            />
          )}
        </FormField>

        <FormField
          label="Website host"
          hint="Pages needing attention are limited to this host, leaving out subdomains such as the ERP and the academy."
        >
          {(id, hintId) => (
            <input
              id={id}
              aria-describedby={hintId}
              type="text"
              required
              value={form.contentHost}
              onChange={update('contentHost')}
            />
          )}
        </FormField>
      </fieldset>

      {canEdit ? (
        <div className="settings-form__actions">
          <button
            type="submit"
            className="btn btn--primary settings-form__button"
            disabled={!dirty || save.isPending}
          >
            {save.isPending ? 'Saving…' : 'Save changes'}
          </button>
          <button
            type="button"
            className="btn btn--ghost settings-form__button"
            disabled={!dirty || save.isPending}
            onClick={() => {
              save.reset();
              setForm(toForm(initial));
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
              Saved. SEO numbers now use these settings.
            </span>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

export function Settings() {
  const user = useCurrentUser();
  const settings = useSeoSettings();

  return (
    <div>
      <PageHeader title="Settings" subtitle="How Content Machine reads and judges your data" />

      <Card className="mb-24">
        <div className="card-title mb-16">SEO</div>
        <QueryState query={settings}>
          {(data) => <SeoSettingsForm initial={data} canEdit={user.role === 'admin'} />}
        </QueryState>
      </Card>

      <BrandCard canEdit={user.role === 'admin'} />
      <ReportingCard canEdit={user.role === 'admin'} />
      <AutomationCard canEdit={user.role === 'admin'} />

      <div className="section-title">Arriving in later milestones</div>
      <div className="settings-later">
        {LATER_SECTIONS.map((section) => (
          <div className="settings-later__item" key={section.title}>
            <div className="settings-later__title">{section.title}</div>
            <div className="settings-later__detail">{section.detail}</div>
            <div className="settings-later__milestone">{section.milestone}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
