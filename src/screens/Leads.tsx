import { useEffect, useState } from 'react';
import {
  detailIsEmpty,
  eventLabel,
  leadStatusLabel,
  paginate,
  SIGNAL_EVENTS,
  type LeadRow,
  type LeadsResponse,
} from '../../shared/leads';
import { useLeadDetail, useLeads } from '../api/leads';
import { useCurrentUser } from '../components/AuthGate';
import { QueryState } from '../components/QueryState';
import { Requires } from '../components/Requires';
import { Card, PageHeader } from '../components/primitives';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';

const KPIS: Array<{ key: string; label: string }> = [
  { key: 'leads', label: 'Contact form leads' },
  { key: 'form_submit', label: 'Form submits (30 days)' },
  { key: 'whatsapp_click', label: 'WhatsApp clicks (30 days)' },
  { key: 'cta_click', label: 'CTA clicks (30 days)' },
];

const LEADS_PER_PAGE = 25;
const SIGNALS_PER_PAGE = 12;

function Pager({ page, pages, total, noun, onChange }: { page: number; pages: number; total: number; noun: string; onChange: (page: number) => void }) {
  if (total === 0) return null;
  return (
    <div className="pager">
      <span className="pager__count">
        {total} {noun}
        {pages > 1 ? ` · page ${page} of ${pages}` : ''}
      </span>
      {pages > 1 ? (
        <span className="pager__buttons">
          <button type="button" className="btn btn--ghost settings-form__button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
            ‹ Previous
          </button>
          <button type="button" className="btn btn--ghost settings-form__button" disabled={page >= pages} onClick={() => onChange(page + 1)}>
            Next ›
          </button>
        </span>
      ) : null}
    </div>
  );
}

function LeadDrawer({ lead, canRead, onClose }: { lead: LeadRow; canRead: boolean; onClose: () => void }) {
  const detail = useLeadDetail(canRead ? lead.id : null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="drawer-scrim" onClick={onClose}>
      <aside className="drawer" role="dialog" aria-modal="true" onClick={(event) => event.stopPropagation()}>
        <div className="drawer__head">
          <div>
            <div className="drawer__title">{lead.serviceInquiry}</div>
            <div className="drawer__url">
              {formatDateTime(lead.createdAt)} · {lead.sourcePage ?? 'unknown page'} · {leadStatusLabel(lead.status)}
            </div>
          </div>
          <button type="button" className="drawer__close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="drawer__body">
          {!canRead ? (
            <div className="ai-banner ai-banner--warn">
              Only editors, approvers and admins may read what a person wrote.
            </div>
          ) : (
            <QueryState query={detail}>
              {(data) => (
                <>
                  <div className="ai-banner">
                    Read from the CMS just now, for you. Content Machine does not store any of it.
                  </div>
                  {detailIsEmpty(data) ? (
                    <div className="empty-note">This lead has nothing written in it beyond its category.</div>
                  ) : (
                    <div className="lead-detail">
                      {[
                        { label: 'NAME', value: data.fullName },
                        { label: 'COMPANY', value: data.companyName },
                        { label: 'JOB TITLE', value: data.jobTitle },
                        { label: 'EMAIL', value: data.email },
                        { label: 'PHONE / WHATSAPP', value: data.phone },
                      ].map((field) => (
                        <div key={field.label}>
                          <div className="field-label">{field.label}</div>
                          <div className="field-value">{field.value?.trim() || '—'}</div>
                        </div>
                      ))}
                      <div>
                        <div className="field-label">MESSAGE</div>
                        <div className="lead-detail__message">{data.message?.trim() || '—'}</div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </QueryState>
          )}
        </div>

        <div className="drawer__foot">
          <span className="drawer__foot-spacer" />
          <button type="button" className="btn--ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </aside>
    </div>
  );
}

function Signals({ data }: { data: LeadsResponse }) {
  const [event, setEvent] = useState<'all' | string>('all');
  const [page, setPage] = useState(1);
  const filtered = data.signals.filter((signal) => event === 'all' || signal.event === event);
  const shown = paginate(filtered, page, SIGNALS_PER_PAGE);

  return (
    <>
      <div className="section-title">What visitors did before getting in touch</div>
      <div className="settings-intro">
        From Google Analytics over the last 30 days
        {data.window ? `, ${formatDate(data.window.start, false)} – ${formatDate(data.window.end)}` : ''}. Analytics
        counts actions, never people, so each row says which page and channel produced them, not who clicked. Form
        submits include the webinar sign-up form, not only the contact form.
      </div>

      <div className="filter-row">
        <select
          className="select-pill"
          aria-label="Filter by action"
          value={event}
          onChange={(e) => {
            setEvent(e.target.value);
            setPage(1);
          }}
        >
          <option value="all">Action: All</option>
          {SIGNAL_EVENTS.filter((name) => data.signals.some((signal) => signal.event === name)).map((name) => (
            <option key={name} value={name}>
              Action: {eventLabel(name)}
            </option>
          ))}
        </select>
      </div>

      <div className="card card--table">
        {shown.total === 0 ? (
          <div className="table-empty">No tracked actions in this period.</div>
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table data-table--pad">
                <thead>
                  <tr>
                    <th>ACTION</th>
                    <th>PAGE</th>
                    <th>CHANNEL</th>
                    <th>COUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.rows.map((signal) => (
                    <tr key={`${signal.event}-${signal.page}-${signal.channel}`}>
                      <td className="cell-strong">{eventLabel(signal.event)}</td>
                      <td className="cell-muted">{signal.page}</td>
                      <td className="cell-text">{signal.channel}</td>
                      <td className="cell-text">{formatNumber(signal.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="workflow-caption">
              <Pager page={shown.page} pages={shown.pages} total={shown.total} noun="rows" onChange={setPage} />
            </div>
          </>
        )}
      </div>
    </>
  );
}

export function Leads({
  selectedId,
  onSelect,
}: {
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}) {
  const user = useCurrentUser();
  const leads = useLeads();
  const [page, setPage] = useState(1);
  const canRead = user.role !== 'viewer';

  return (
    <div>
      <PageHeader title="Leads" subtitle="Every enquiry from the website, and what brought it in" />

      <Requires capability="leads">
        <QueryState query={leads}>
          {(data) => {
            const shown = paginate(data.leads, page, LEADS_PER_PAGE);
            const openLead = data.leads.find((lead) => String(lead.id) === selectedId) ?? null;

            return (
              <>
                <div className="lead-kpis">
                  {KPIS.map((kpi) => (
                    <Card className="card--sm" key={kpi.key}>
                      <div className="kpi__label">{kpi.label}</div>
                      <div className="kpi__value">{formatNumber(data.totals[kpi.key] ?? 0)}</div>
                    </Card>
                  ))}
                </div>

                {!data.detailsAvailable ? (
                  <div className="ai-banner ai-banner--warn">
                    The CMS does not let Content Machine read what people wrote yet, so only the category, page and
                    status are shown. To turn it on, run <code>npm run cli -- cms:lead-grant-sql</code> and run the SQL
                    it prints in Neon.
                  </div>
                ) : null}

                <div className="card card--table mb-24">
                  {shown.total === 0 ? (
                    <div className="table-empty">No leads yet.</div>
                  ) : (
                    <>
                      <div className="table-scroll">
                        <table className="data-table data-table--pad clickable-rows">
                          <thead>
                            <tr>
                              <th>WHEN</th>
                              <th>SERVICE</th>
                              <th>CAME FROM</th>
                              <th>LANGUAGE</th>
                              <th>STATUS</th>
                              <th />
                            </tr>
                          </thead>
                          <tbody>
                            {shown.rows.map((lead) => (
                              <tr
                                key={lead.id}
                                tabIndex={0}
                                onClick={() => onSelect(String(lead.id))}
                                onKeyDown={(event) => {
                                  if (event.key === 'Enter') onSelect(String(lead.id));
                                }}
                              >
                                <td className="cell-text">{formatDateTime(lead.createdAt)}</td>
                                <td className="cell-strong">{lead.serviceInquiry}</td>
                                <td className="cell-muted">{lead.sourcePage ?? '—'}</td>
                                <td className="cell-text">{lead.language.toUpperCase()}</td>
                                <td className="cell-text">{leadStatusLabel(lead.status)}</td>
                                <td className="cell-faint">{data.detailsAvailable && canRead ? 'Open →' : ''}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      <div className="workflow-caption">
                        <Pager page={shown.page} pages={shown.pages} total={shown.total} noun="leads" onChange={setPage} />
                      </div>
                    </>
                  )}
                </div>

                <div className="lead-breakdowns">
                  {[
                    { title: 'By service asked about', rows: data.byService },
                    { title: 'By page they wrote from', rows: data.bySourcePage },
                  ].map((group) => (
                    <Card className="card--sm" key={group.title}>
                      <div className="card-title card-title--sm mb-14">{group.title}</div>
                      {group.rows.length === 0 ? (
                        <div className="empty-note">Nothing yet.</div>
                      ) : (
                        <ul className="settings-list">
                          {group.rows.map((row) => (
                            <li key={row.value}>
                              {row.value} <span className="settings-list__meta">{row.count}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Card>
                  ))}
                </div>

                <Signals data={data} />

                {openLead ? (
                  <LeadDrawer
                    key={openLead.id}
                    lead={openLead}
                    canRead={canRead && data.detailsAvailable}
                    onClose={() => onSelect(null)}
                  />
                ) : null}
              </>
            );
          }}
        </QueryState>
      </Requires>
    </div>
  );
}
