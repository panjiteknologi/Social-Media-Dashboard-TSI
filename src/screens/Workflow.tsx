import { useEffect, useState } from 'react';
import { JOB_RUN_STATUSES, type JobRun, type JobRunStatus, type JobTrigger } from '../../shared/api';
import { JOB_INFO } from '../../shared/automation';
import { RUN_LIMIT, useAiUsage, useJobRun, useJobRuns, useRerunJob } from '../api/workflow';
import { useCurrentUser } from '../components/AuthGate';
import { QueryState } from '../components/QueryState';
import { Chip, Field, PageHeader } from '../components/primitives';
import { formatDateTime, formatDuration, formatNumber } from '../lib/format';
import { severityTone, statusTone, type ChipTone } from '../lib/theme';

const STATUS_LABELS: Record<JobRunStatus, string> = {
  running: 'Running',
  success: 'Success',
  retrying: 'Retrying',
  failed: 'Failed',
};

const STATUS_TONES: Record<JobRunStatus, ChipTone> = {
  running: statusTone('Scheduled'),
  success: statusTone('Published'),
  retrying: severityTone('Medium'),
  failed: severityTone('High'),
};

const TRIGGER_LABELS: Record<JobTrigger, string> = { schedule: 'Schedule', manual: 'Manual', system: 'System' };

const jobLabel = (name: string): string => JOB_INFO[name]?.label ?? name;

const duration = (run: JobRun): string =>
  run.finishedAt ? formatDuration((Date.parse(run.finishedAt) - Date.parse(run.startedAt)) / 1000) : '—';

const asJson = (value: unknown): string =>
  value === null || value === undefined ? '—' : JSON.stringify(value, null, 2);

function AiUsage() {
  const { data } = useAiUsage();
  const features = data?.byFeature.map((feature) => `${feature.feature}: ${feature.calls}`).join(', ');
  return (
    <div className="kpi-strip kpi-strip--4 mb-24">
      <div className="kpi">
        <div className="kpi__label">AI Spend This Month</div>
        <div className="kpi__value">{data ? `$${data.spentUsd.toFixed(2)}` : '…'}</div>
        <div className="kpi__foot">
          <span className="kpi__period">{data ? `of the $${data.budgetUsd.toFixed(0)} monthly budget` : ''}</span>
        </div>
      </div>
      <div className="kpi">
        <div className="kpi__label">AI Calls This Month</div>
        <div className="kpi__value">{data ? formatNumber(data.calls) : '…'}</div>
        <div className="kpi__foot">
          <span className="kpi__period">
            {data ? (data.configured ? features || 'none yet' : 'OpenRouter is not configured') : ''}
          </span>
        </div>
      </div>
    </div>
  );
}

function RunDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const user = useCurrentUser();
  const run = useJobRun(id);
  const rerun = useRerunJob();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const data = run.data;
  const canRerun = user.role === 'admin' && data && data.status !== 'running';

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside
        className="drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Run details"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer__head">
          <div>
            <div className="drawer__title">{data ? jobLabel(data.jobName) : 'Run'}</div>
            <div className="drawer__url">{data?.jobName}</div>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="drawer__body">
          <QueryState query={run}>
            {(detail) => (
              <div className="drawer-stack">
                <div>
                  <div className="field-label">STATUS</div>
                  <div style={{ marginTop: 4 }}>
                    <Chip tone={STATUS_TONES[detail.status]}>{STATUS_LABELS[detail.status]}</Chip>
                  </div>
                </div>
                <div className="metric-grid">
                  <Field label="TRIGGER">
                    {TRIGGER_LABELS[detail.trigger]}
                    {detail.triggeredByName ? ` by ${detail.triggeredByName}` : ''}
                  </Field>
                  <Field label="ATTEMPT">
                    {detail.attempt} of {detail.maxAttempts}
                  </Field>
                  <Field label="STARTED">{formatDateTime(detail.startedAt)}</Field>
                  <Field label="DURATION">{detail.status === 'running' ? 'Running…' : duration(detail)}</Field>
                </div>
                {detail.error ? (
                  <div>
                    <div className="field-label">ERROR</div>
                    <pre className="workflow-json workflow-json--error">{detail.error}</pre>
                  </div>
                ) : null}
                <div>
                  <div className="field-label">INPUT</div>
                  <pre className="workflow-json">{asJson(detail.input)}</pre>
                </div>
                <div>
                  <div className="field-label">OUTPUT</div>
                  <pre className="workflow-json">{asJson(detail.output)}</pre>
                </div>
              </div>
            )}
          </QueryState>
        </div>

        {canRerun ? (
          <div className="drawer__foot">
            {rerun.isSuccess ? (
              <span className="settings-form__saved" role="status">
                Queued. The new run appears at the top of the list.
              </span>
            ) : null}
            {rerun.isError ? (
              <span className="settings-form__error" role="alert">
                {rerun.error.message}
              </span>
            ) : null}
            <span className="drawer__foot-spacer" />
            <button
              type="button"
              className="btn--dark"
              disabled={rerun.isPending || rerun.isSuccess}
              onClick={() => rerun.mutate({ name: data.jobName, input: data.input })}
            >
              {data.status === 'failed' || data.status === 'retrying' ? 'Retry' : 'Run again'}
            </button>
          </div>
        ) : null}
      </aside>
    </div>
  );
}

export function Workflow() {
  const [job, setJob] = useState('all');
  const [status, setStatus] = useState<'all' | JobRunStatus>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const runs = useJobRuns({ job, status });

  return (
    <div>
      <PageHeader title="Workflow Logs" subtitle="Every background job run: syncs, checks, reports and AI work" />

      <AiUsage />

      <div className="filter-row">
        <select className="select-pill" aria-label="Filter by flow" value={job} onChange={(event) => setJob(event.target.value)}>
          <option value="all">Flow: All</option>
          {Object.keys(JOB_INFO).map((name) => (
            <option key={name} value={name}>
              Flow: {jobLabel(name)}
            </option>
          ))}
        </select>
        <select
          className="select-pill"
          aria-label="Filter by status"
          value={status}
          onChange={(event) => setStatus(event.target.value as 'all' | JobRunStatus)}
        >
          <option value="all">Status: All</option>
          {JOB_RUN_STATUSES.map((value) => (
            <option key={value} value={value}>
              Status: {STATUS_LABELS[value]}
            </option>
          ))}
        </select>
      </div>

      <div className="card card--table">
        <QueryState query={runs}>
          {(rows) =>
            rows.length === 0 ? (
              <div className="table-empty">No runs match these filters.</div>
            ) : (
              <div className="table-scroll">
                <table className="data-table data-table--pad clickable-rows">
                  <thead>
                    <tr>
                      <th>FLOW</th>
                      <th>TRIGGER</th>
                      <th>STATUS</th>
                      <th>STARTED</th>
                      <th>DURATION</th>
                      <th>ATTEMPT</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.id}
                        tabIndex={0}
                        onClick={() => setSelectedId(row.id)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') setSelectedId(row.id);
                        }}
                      >
                        <td className="cell-strong">
                          {jobLabel(row.jobName)}
                          {row.error ? <div className="action-row__detail">{row.error.slice(0, 140)}</div> : null}
                        </td>
                        <td className="cell-text">{TRIGGER_LABELS[row.trigger]}</td>
                        <td>
                          <Chip tone={STATUS_TONES[row.status]}>{STATUS_LABELS[row.status]}</Chip>
                        </td>
                        <td className="cell-text">{formatDateTime(row.startedAt)}</td>
                        <td className="cell-text">{row.status === 'running' ? 'Running…' : duration(row)}</td>
                        <td className="cell-text">
                          {row.attempt} / {row.maxAttempts}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </QueryState>
        <div className="content-caption workflow-caption">
          The latest {RUN_LIMIT} runs, refreshed every 15 seconds. Runs are kept for 90 days.
        </div>
      </div>

      {selectedId ? <RunDrawer id={selectedId} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
