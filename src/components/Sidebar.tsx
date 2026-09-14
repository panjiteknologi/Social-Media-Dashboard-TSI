import { useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useSignOut } from '../api/queries';
import { NAV_ITEMS } from '../data/editorial';
import { initials } from '../lib/initials';
import { SCREEN_PATHS } from '../lib/routes';
import type { NavGroupLabel, NavItem } from '../types';
import { useCurrentUser } from './AuthGate';

interface NavGroup {
  label: NavGroupLabel;
  items: NavItem[];
}

/** Groups the flat nav list, preserving first-seen group order. */
function groupNav(items: NavItem[]): NavGroup[] {
  const groups: NavGroup[] = [];
  for (const item of items) {
    let group = groups.find((g) => g.label === item.group);
    if (!group) {
      group = { label: item.group, items: [] };
      groups.push(group);
    }
    group.items.push(item);
  }
  return groups;
}

export function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const groups = useMemo(() => groupNav(NAV_ITEMS), []);
  const user = useCurrentUser();
  const signOut = useSignOut();

  return (
    <nav className="sidebar" aria-label="Primary">
      <div className="sidebar__brand">
        <img className="sidebar__logo" src="/assets/tsi-logo.png" alt="TSI" />
        <div>
          <div className="sidebar__title">Content Machine</div>
          <div className="sidebar__subtitle">TSI Sertifikasi Internasional</div>
        </div>
      </div>

      <div className="sidebar__nav">
        {groups.map((group) => (
          <div key={group.label}>
            <div className="sidebar__group-label">{group.label}</div>
            {group.items.map((item) => (
              <NavLink
                key={item.key}
                to={SCREEN_PATHS[item.key]}
                end={item.key === 'dashboard'}
                className={({ isActive }) =>
                  isActive ? 'nav-item nav-item--active' : 'nav-item'
                }
                onClick={onNavigate}
              >
                <span className="nav-item__label">{item.label}</span>
                {item.badge ? <span className="nav-item__badge">{item.badge}</span> : null}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      <div className="sidebar__footer">
        <div className="sidebar__link">Help</div>
        <div className="sidebar__link">Documentation</div>
        <div className="sidebar__user">
          <div className="sidebar__avatar">{initials(user)}</div>
          <div className="sidebar__user-info">
            <div className="sidebar__user-name">{user.name ?? user.email}</div>
            <div className="sidebar__user-role">{user.role}</div>
          </div>
        </div>
        <button
          type="button"
          className="sidebar__signout"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
