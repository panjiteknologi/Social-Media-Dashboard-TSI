import { Requires } from '../components/Requires';
import { Card, Chip } from '../components/primitives';
import {
  EXECUTIVE_SUMMARY,
  RECOMMENDED_FOCUS,
  REPORT_CARDS,
  REPORT_PERIODS,
} from '../data/workflow';
import { statusTone } from '../lib/theme';
import type { ReportCard, ReportPeriod } from '../types';

// WhatsApp delivery is on hold; Telegram is the only messaging channel for now.
const CHANNELS = ['telegram', 'email'] as const;

const CHANNEL_LABELS: Record<(typeof CHANNELS)[number], string> = {
  telegram: 'Telegram',
  email: 'Email',
};

function Channels({ report }: { report: ReportCard }) {
  return (
    <div className="report-card__channels">
      {CHANNELS.map((channel) => {
        const sent = report[channel];
        return (
          <div
            key={channel}
            className={sent ? 'report-card__channel report-card__channel--on' : 'report-card__channel'}
          >
            {CHANNEL_LABELS[channel]} {sent ? '✓' : '—'}
          </div>
        );
      })}
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
        <div className="report-layout">
          <div className="report-list">
            {REPORT_CARDS[period].map((report) => (
              <Card className="card--sm" key={report.period}>
                <div className="report-card__head">
                  <div>
                    <div className="report-card__period">{report.period}</div>
                    <div className="report-card__generated">Generated {report.generated}</div>
                  </div>
                  <Chip tone={statusTone('Published')}>{report.status}</Chip>
                </div>
                <Channels report={report} />
              </Card>
            ))}
          </div>

          <Card className="card--md">
            <div className="card-title card-title--sm mb-14">AI Executive Summary</div>
            <div className="summary-body">{EXECUTIVE_SUMMARY}</div>
            <div className="summary-label">RECOMMENDED FOCUS NEXT WEEK</div>
            {RECOMMENDED_FOCUS.map((item) => (
              <div className="summary-item" key={item}>
                {item}
              </div>
            ))}
          </Card>
        </div>
      </Requires>
    </div>
  );
}
