import { useEffect, useRef } from 'react';

const QUICK_CREATE_ITEMS = ['New Article', 'New Social Post', 'New Campaign', 'New Content Idea'];

export function TopBar({
  quickCreateOpen,
  onToggleQuickCreate,
  onCloseQuickCreate,
}: {
  quickCreateOpen: boolean;
  onToggleQuickCreate: () => void;
  onCloseQuickCreate: () => void;
}) {
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
        <div className="topbar__sync">
          <div className="dot-live" />
          <span>Synced 4m ago</span>
        </div>

        <button type="button" className="icon-button" aria-label="Notifications">
          <span className="icon-button__dot" />
          <span className="icon-button__glyph" />
        </button>

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
                <button key={item} type="button" className="quick-create__item" role="menuitem">
                  {item}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="topbar__avatar">MR</div>
      </div>
    </header>
  );
}
