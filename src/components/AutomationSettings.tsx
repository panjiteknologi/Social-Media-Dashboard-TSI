import { useId, useState } from 'react';
import type { JobRunStatus } from '../../shared/api';
import {
  describeSchedule,
  formatSchedule,
  JOB_INFO,
  MAX_MONTH_DAY,
  MAX_RETRY_LIMIT,
  parseSchedule,
  WEEKDAY_NAMES,
  type AutomationJob,
  type AutomationSettings,
  type JobGroup,
  type JobSettingInput,
  type ScheduleShape,
} from '../../shared/automation';
import { useAutomationSettings, useRunJob, useSaveJobSetting, useSendTelegramTest } from '../api/automation';
import { formatDateTime } from '../lib/format';
import { QueryState } from './QueryState';
import { Card } from './primitives';

const pad = (value: number): string => String(value).padStart(2, '0');

const RUN_LABELS: Record<JobRunStatus, string> = {
  running: 'Running',
  success: 'Succeeded',
  retrying: 'Failed, will retry',
  failed: 'Failed',
};

function ScheduleEditor({
  shape,
  disabled,
  jobLabel,
  onChange,
}: {
  shape: ScheduleShape;
  disabled: boolean;
  jobLabel: string;
  onChange: (shape: ScheduleShape) => void;
}) {
  if (shape.kind === 'hourly') {
    return (
      <label className="job-field">
        Minute past the hour
        <input
          type="number"
          min={0}
          max={59}
          value={shape.minute}
          disabled={disabled}
          aria-label={`${jobLabel}: minute past the hour`}
          onChange={(event) => {
            const minute = Number(event.target.value);
            if (Number.isInteger(minute) && minute >= 0 && minute <= 59) onChange({ kind: 'hourly', minute });
          }}
        />
      </label>
    );
  }

  const timeInput = (
    <label className="job-field">
      At
      <input
        type="time"
        value={`${pad(shape.hour)}:${pad(shape.minute)}`}
        disabled={disabled}
        aria-label={`${jobLabel}: time`}
        onChange={(event) => {
          const [hour, minute] = event.target.value.split(':').map(Number);
          if (Number.isInteger(hour) && Number.isInteger(minute)) onChange({ ...shape, hour, minute });
        }}
      />
    </label>
  );

  if (shape.kind === 'weekly') {
    return (
      <>
        <label className="job-field">
          Every
          <select
            value={shape.weekday}
            disabled={disabled}
            aria-label={`${jobLabel}: day of the week`}
            onChange={(event) => onChange({ ...shape, weekday: Number(event.target.value) })}
          >
            {WEEKDAY_NAMES.map((name, weekday) => (
              <option key={name} value={weekday}>
                {name}
              </option>
            ))}
          </select>
        </label>
        {timeInput}
      </>
    );
  }

  if (shape.kind === 'monthly') {
    return (
      <>
        <label className="job-field">
          Day
          <select
            value={shape.day}
            disabled={disabled}
            aria-label={`${jobLabel}: day of the month`}
            onChange={(event) => onChange({ ...shape, day: Number(event.target.value) })}
          >
            {Array.from({ length: MAX_MONTH_DAY }, (_, index) => index + 1).map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>
        {timeInput}
      </>
    );
  }

  return timeInput;
}

function LastRun({ run }: { run: AutomationJob['lastRun'] }) {
  if (!run) return <div className="job-row__last">Has not run yet</div>;
  const failed = run.status === 'failed' || run.status === 'retrying';
  return (
    <div className={failed ? 'job-row__last job-row__last--failed' : 'job-row__last'} title={run.error ?? undefined}>
      Last run: {RUN_LABELS[run.status]}, {formatDateTime(run.startedAt)}
      {failed && run.error ? ` · ${run.error.slice(0, 120)}` : ''}
    </div>
  );
}

function JobRow({ job, canEdit }: { job: AutomationJob; canEdit: boolean }) {
  const save = useSaveJobSetting();
  const run = useRunJob();
  const info = JOB_INFO[job.name];
  const label = info?.label ?? job.name;
  const toggleId = useId();

  const initial: JobSettingInput = { enabled: job.enabled, schedule: job.schedule, retryLimit: job.retryLimit };
  const [draft, setDraft] = useState<JobSettingInput>(initial);
  const dirty =
    draft.enabled !== initial.enabled || draft.schedule !== initial.schedule || draft.retryLimit !== initial.retryLimit;
  const shape = draft.schedule ? parseSchedule(draft.schedule) : null;

  return (
    <div className="job-row">
      <div>
        <div className="job-row__name">{label}</div>
        {info ? <div className="job-row__summary">{info.summary}</div> : null}
        <LastRun run={job.lastRun} />
      </div>

      <fieldset className="job-row__controls" disabled={!canEdit || save.isPending}>
        <legend className="sr-only">{label} settings</legend>
        {job.defaultSchedule ? (
          <>
            <label className="job-toggle" htmlFor={toggleId}>
              <input
                id={toggleId}
                type="checkbox"
                checked={draft.enabled}
                onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })}
              />
              {draft.enabled ? 'On' : 'Off'}
            </label>
            {shape ? (
              <ScheduleEditor
                shape={shape}
                disabled={!draft.enabled}
                jobLabel={label}
                onChange={(next) => setDraft({ ...draft, schedule: formatSchedule(next) })}
              />
            ) : null}
          </>
        ) : (
          <span className="job-row__hint">Runs only when started by hand</span>
        )}
        <label className="job-field">
          Retries
          <select
            value={draft.retryLimit}
            aria-label={`${label}: retries after a failure`}
            onChange={(event) => setDraft({ ...draft, retryLimit: Number(event.target.value) })}
          >
            {Array.from({ length: MAX_RETRY_LIMIT + 1 }, (_, count) => (
              <option key={count} value={count}>
                {count}
              </option>
            ))}
          </select>
        </label>
        {shape && draft.enabled ? <span className="job-row__hint">{describeSchedule(shape)}</span> : null}
        {job.defaultSchedule && !draft.enabled ? (
          <span className="job-row__hint">Off: it runs only when started by hand</span>
        ) : null}
      </fieldset>

      {canEdit ? (
        <div className="job-row__actions">
          {dirty ? (
            <>
              <button
                type="button"
                className="btn btn--primary settings-form__button"
                disabled={save.isPending}
                onClick={() => save.mutate({ name: job.name, setting: draft })}
              >
                {save.isPending ? 'Saving…' : 'Save'}
              </button>
              <button
                type="button"
                className="btn btn--ghost settings-form__button"
                disabled={save.isPending}
                onClick={() => {
                  save.reset();
                  setDraft(initial);
                }}
              >
                Discard
              </button>
            </>
          ) : null}
          {job.manual && !dirty ? (
            <button
              type="button"
              className="btn btn--ghost settings-form__button"
              disabled={run.isPending}
              onClick={() => run.mutate(job.name)}
            >
              {run.isSuccess ? 'Queued' : run.isPending ? 'Starting…' : 'Run now'}
            </button>
          ) : null}
          {save.isError ? (
            <span className="settings-form__error" role="alert">
              {save.error.message}
            </span>
          ) : null}
          {run.isError ? (
            <span className="settings-form__error" role="alert">
              {run.error.message}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function JobList({ jobs, canEdit }: { jobs: AutomationJob[]; canEdit: boolean }) {
  return (
    <div className="job-list">
      {jobs.map((job) => (
        // Keyed by the saved values, so a row starts from the new settings after a save.
        <JobRow key={`${job.name}:${job.enabled}:${job.schedule}:${job.retryLimit}`} job={job} canEdit={canEdit} />
      ))}
    </div>
  );
}

function AdminNotice({ canEdit }: { canEdit: boolean }) {
  return canEdit ? null : <div className="settings-form__notice">Only admins can change these settings.</div>;
}

function Reporting({ data, canEdit }: { data: AutomationSettings; canEdit: boolean }) {
  const test = useSendTelegramTest();
  return (
    <>
      <AdminNotice canEdit={canEdit} />
      <div className="settings-intro">
        Reports and alerts go to the Telegram group set in the server configuration
        {data.telegramConfigured ? '.' : ', which is not configured yet.'} Times are in {data.timezone}.
      </div>
      {canEdit ? (
        <div className="settings-form__actions settings-intro__actions">
          <button
            type="button"
            className="btn btn--ghost settings-form__button"
            disabled={test.isPending || !data.telegramConfigured}
            onClick={() => test.mutate()}
          >
            {test.isPending ? 'Sending…' : 'Send test message'}
          </button>
          {test.isSuccess ? (
            <span className="settings-form__saved" role="status">
              Sent. Check the Telegram group.
            </span>
          ) : null}
          {test.isError ? (
            <span className="settings-form__error" role="alert">
              {test.error.message}
            </span>
          ) : null}
        </div>
      ) : null}
      <JobList jobs={data.jobs.filter((job) => job.group === 'reports')} canEdit={canEdit} />
    </>
  );
}

const AUTOMATION_GROUPS: Array<{ group: JobGroup; title: string }> = [
  { group: 'sync', title: 'Data sync' },
  { group: 'seo', title: 'SEO checks' },
  { group: 'content', title: 'AI content' },
  { group: 'system', title: 'System' },
];

function Automation({ data, canEdit }: { data: AutomationSettings; canEdit: boolean }) {
  return (
    <>
      <AdminNotice canEdit={canEdit} />
      <div className="settings-intro">
        Background jobs. A job that is switched off keeps its settings and can still be run by hand. Retries are extra
        attempts after a failure; a Telegram alert goes out when the last one fails. Times are in {data.timezone}.
      </div>
      {AUTOMATION_GROUPS.map(({ group, title }) => {
        const jobs = data.jobs.filter((job) => job.group === group);
        return jobs.length > 0 ? (
          <div key={group}>
            <div className="job-group-title">{title}</div>
            <JobList jobs={jobs} canEdit={canEdit} />
          </div>
        ) : null;
      })}
    </>
  );
}

export function ReportingCard({ canEdit }: { canEdit: boolean }) {
  const automation = useAutomationSettings();
  return (
    <Card className="mb-24">
      <div className="card-title mb-16">Reporting</div>
      <QueryState query={automation}>{(data) => <Reporting data={data} canEdit={canEdit} />}</QueryState>
    </Card>
  );
}

export function AutomationCard({ canEdit }: { canEdit: boolean }) {
  const automation = useAutomationSettings();
  return (
    <Card className="mb-24">
      <div className="card-title mb-16">Automation</div>
      <QueryState query={automation}>{(data) => <Automation data={data} canEdit={canEdit} />}</QueryState>
    </Card>
  );
}
