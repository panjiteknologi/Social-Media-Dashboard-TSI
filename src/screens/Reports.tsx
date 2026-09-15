import { useState } from 'react';
import type { ReportKind, ReportRecord } from '../../shared/reports';
import { useReports } from '../api/reports';
import { QueryState } from '../components/QueryState';
import { Requires } from '../components/Requires';
import { Card, Chip } from '../components/primitives';
import { REPORT_PERIODS } from '../data/workflow';
import { formatDateTime, formatNumber, formatPosition } from '../lib/format';
import { severityTone, statusTone } from '../lib/theme';
import type { ReportPeriod } from '../types';

const KINDS: Record<ReportPeriod, ReportKind> = { Daily: 'daily', Weekly: 'weekly', Monthly: 'monthly' };

const SCHEDULES: Record<ReportKind, string> = {
  daily: 'every morning at 08:00',
  weekly: 'every Monday at 08:15',
  monthly: 'on the first of each month at 08:30',
};

function Delivery({ report }: { report: ReportRecord }) {
  if (report.telegramSentAt) return <Chip tone={statusTone('Published')}>Sent</Chip>;
  if (report.telegramError) return <Chip tone={severityTone('High')}>Not sent</Chip>;
  return <Chip tone={severityTone('Low')}>Sending</Chip>;
}

function ReportDetail({ report }: { report: ReportRecord }) {
  const { traffic, search, leads, articlesPublished } = report.data;
  const numbers: Array<[string, string]> = [
    ['Sessions', traffic ? formatNumber(traffic.sessions.current) : '—'],
    ['From Google search', traffic ? formatNumber(traffic.organicSessions.current) : '—'],
    [
      'Leads from the contact form',
      leads.since && report.data.period.end >= leads.since ? formatNumber(leads.count.current) : '—',
    ],
    ['Lead events in GA4', traffic ? formatNumber(traffic.leadEvents.current) : '—'],
    ['Search clicks', search ? formatNumber(search.clicks.current) : '—'],
    ['Average position', search ? formatPosition(search.position.current) : '—'],
    ['Articles published', formatNumber(articlesPublished.length)],
  ];

  return (
    <Card className="card--md">
      <div className="card-title card-title--sm mb-14">AI Executive Summary</div>
      {report.summary ? (
        <div className="summary-body">{report.summary}</div>
      ) : (
        <div className="empty-note">{report.aiNote ?? 'This report has no AI summary.'}</div>
      )}

      {report.focus.length > 0 ? (
        <>
          <div className="summary-label">RECOMMENDED FOCUS</div>
          {report.focus.map((item) => (
            <div className="summary-item" key={item}>
              {item}
            </div>
          ))}
        </>
      ) : null}

      <div className="summary-label">KEY NUMBERS</div>
      <dl className="report-numbers">
        {numbers.map(([label, value]) => (
          <div className="report-numbers__row" key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
      {report.aiModel ? <div className="report-card__generated">Summary written by {report.aiModel}</div> : null}
    </Card>
  );
}

function ReportList({ reports, kind }: { reports: ReportRecord[]; kind: ReportKind }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (reports.length === 0) {
    return (
      <div className="empty-note">
        No {kind} report yet. It is sent to Telegram {SCHEDULES[kind]}.
      </div>
    );
  }
  const selected = reports.find((report) => report.id === selectedId) ?? reports[0];

  return (
    <div className="report-layout">
      <div className="report-list">
        {reports.map((report) => (
          <button
            type="button"
            key={report.id}
            className={`card card--sm report-card${report.id === selected.id ? ' report-card--selected' : ''}`}
            aria-pressed={report.id === selected.id}
            onClick={() => setSelectedId(report.id)}
          >
            <div className="report-card__head">
              <div>
                <div className="report-card__period">{report.title}</div>
                <div className="report-card__generated">Generated {formatDateTime(report.createdAt)}</div>
              </div>
              <Delivery report={report} />
            </div>
            <div className="report-card__channels">
              <div className={report.telegramSentAt ? 'report-card__channel report-card__channel--on' : 'report-card__channel'}>
                Telegram {report.telegramSentAt ? '✓' : '—'}
              </div>
            </div>
            {report.telegramError ? <div className="report-card__error">{report.telegramError}</div> : null}
          </button>
        ))}
      </div>

      <ReportDetail report={selected} />
    </div>
  );
}

export function Reports({
  period,
  onPeriodChange,
}: {
  period: ReportPeriod;
  onPeriodChange: (period: ReportPeriod) => void;
}) {
  const kind = KINDS[period];
  const reports = useReports(kind);

  return (
    <div>
      <div className="mb-20">
        <div className="page-title">Reports</div>
        <div className="page-subtitle">Executive reporting center</div>
      </div>

      <div className="tab-row" role="group" aria-label="Report period">
        {REPORT_PERIODS.map((label) => (
          <button
            key={label}
            type="button"
            className="tab-pill tab-pill--sm"
            aria-pressed={period === label}
            onClick={() => onPeriodChange(label)}
          >
            {label}
          </button>
        ))}
      </div>

      <Requires capability="reports">
        <QueryState query={reports}>{(data) => <ReportList key={kind} reports={data} kind={kind} />}</QueryState>
      </Requires>
    </div>
  );
}
