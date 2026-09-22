import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { latestLeadId, newLeadsSince } from '../../shared/leads';
import { useLeads } from '../api/leads';
import { SCREEN_PATHS } from '../lib/routes';
import { formatDateTime } from '../lib/format';
import { useCurrentUser } from './AuthGate';

function BellIcon() {
  return (
    <svg
      className="notifications__bell"
      viewBox="0 0 24 24"
      width="17"
      height="17"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18 8a6 6 0 1 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.7 21a1.9 1.9 0 0 1-3.4 0" />
    </svg>
  );
}

/** Remembered per person and per browser: the newest lead they have already seen. */
const seenKey = (userId: string) => `cm:leads-seen:${userId}`;

function readSeen(userId: string): number {
  try {
    return Number(window.localStorage.getItem(seenKey(userId))) || 0;
  } catch {
    return 0;
  }
}

function writeSeen(userId: string, id: number): void {
  try {
    window.localStorage.setItem(seenKey(userId), String(id));
  } catch {
    // A browser with storage blocked simply shows the notifications again later.
  }
}

/** The bell: new website leads, and one click to the lead itself. */
export function Notifications() {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const leads = useLeads();
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(() => readSeen(user.id));
  const panelRef = useRef<HTMLDivElement>(null);

  // The first visit should not shout about every lead ever received.
  const rows = leads.data?.leads ?? [];
  useEffect(() => {
    if (seen === 0 && rows.length > 0) {
      const newest = latestLeadId(rows);
      setSeen(newest);
      writeSeen(user.id, newest);
    }
  }, [seen, rows, user.id]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const unread = newLeadsSince(rows, seen);
  const recent = [...rows].sort((a, b) => b.id - a.id).slice(0, 8);

  const markAllSeen = () => {
    const newest = latestLeadId(rows, seen);
    setSeen(newest);
    writeSeen(user.id, newest);
  };

  const openLead = (id: number) => {
    setSeen(Math.max(seen, id));
    writeSeen(user.id, Math.max(seen, id));
    setOpen(false);
    navigate(`${SCREEN_PATHS.leads}?lead=${id}`);
  };

  return (
    <div className="notifications" ref={panelRef}>
      <button
        type="button"
        className="icon-button"
        aria-label={unread.length > 0 ? `Notifications, ${unread.length} new leads` : 'Notifications'}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <BellIcon />
        {unread.length > 0 ? (
          <span className="notifications__badge">{unread.length > 9 ? '9+' : unread.length}</span>
        ) : null}
      </button>

      {open ? (
        <div className="notifications__panel" role="menu">
          <div className="notifications__head">
            <span>New leads</span>
            {unread.length > 0 ? (
              <button type="button" className="link-inline" onClick={markAllSeen}>
                Mark all read
              </button>
            ) : null}
          </div>

          {recent.length === 0 ? (
            <div className="notifications__empty">No leads yet. They appear here the moment one arrives.</div>
          ) : (
            recent.map((lead) => {
              const isNew = lead.id > seen;
              return (
                <button
                  key={lead.id}
                  type="button"
                  role="menuitem"
                  className={isNew ? 'notifications__item notifications__item--new' : 'notifications__item'}
                  onClick={() => openLead(lead.id)}
                >
                  <span className="notifications__item-head">
                    {isNew ? <span className="notifications__dot" aria-hidden="true" /> : null}
                    {lead.serviceInquiry}
                  </span>
                  <span className="notifications__item-meta">
                    {formatDateTime(lead.createdAt)} · {lead.sourcePage ?? 'unknown page'}
                  </span>
                </button>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
