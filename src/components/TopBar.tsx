import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { initials } from '../lib/initials';
import { SCREEN_PATHS } from '../lib/routes';
import { useCurrentUser } from './AuthGate';

/** Each entry opens the Content Planner editor with suitable defaults; campaigns come later. */
const QUICK_CREATE_ITEMS: Array<{ label: string; kind: string | null; unavailable?: string }> = [
  { label: 'New Article', kind: 'article' },
  { label: 'New Social Post', kind: 'social' },
  { label: 'New Content Idea', kind: 'idea' },
  { label: 'New Campaign', kind: null, unavailable: 'Campaigns arrive in M8' },
];

export function TopBar({
  quickCreateOpen,
  onToggleQuickCreate,
  onCloseQuickCreate,
}: {
  quickCreateOpen: boolean;
  onToggleQuickCreate: () => void;
  onCloseQuickCreate: () => void;
}) {
  const user = useCurrentUser();
  const navigate = useNavigate();
  const menuRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // Dismiss the quick-create menu on outside click or Escape.
  useEffect(() => {
    if (!quickCreateOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onCloseQuickCreate();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseQuickCreate();
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [quickCreateOpen, onCloseQuickCreate]);

  // The ⌘K / Ctrl+K affordance shown in the search field.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <header className="topbar">
      <div className="topbar__search">
        <input ref={searchRef} type="search" placeholder="Search articles, keywords, posts…" aria-label="Search" />
        <span className="topbar__kbd">⌘K</span>
      </div>

      <div className="topbar__right">
        <button type="button" className="icon-button" aria-label="Notifications">
          <span className="icon-button__glyph" />
        </button>

        {user.role !== 'viewer' ? (
          <div className="quick-create" ref={menuRef}>
            <button
              type="button"
              className="btn btn--primary"
              aria-expanded={quickCreateOpen}
              aria-haspopup="menu"
              onClick={onToggleQuickCreate}
            >
              + Create
            </button>
            {quickCreateOpen ? (
              <div className="quick-create__menu" role="menu">
                {QUICK_CREATE_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="quick-create__item"
                    role="menuitem"
                    disabled={!item.kind}
                    title={item.unavailable}
                    onClick={() => {
                      if (!item.kind) return;
                      onCloseQuickCreate();
                      navigate(`${SCREEN_PATHS.planner}?new=${item.kind}`);
                    }}
                  >
                    {item.label}
                    {item.unavailable ? <span className="quick-create__hint">{item.unavailable}</span> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="topbar__avatar" title={user.email}>
          {initials(user)}
        </div>
      </div>
    </header>
  );
}
