import { createContext, use, type ReactNode } from 'react';
import type { CurrentUser } from '../../shared/api';
import { isUnauthorized } from '../api/client';
import { useMe } from '../api/queries';
import { Login } from '../screens/Login';

const CurrentUserContext = createContext<CurrentUser | null>(null);

/** The signed-in user. Valid anywhere inside AuthGate, which renders nothing else until one exists. */
export function useCurrentUser(): CurrentUser {
  const user = use(CurrentUserContext);
  if (!user) throw new Error('useCurrentUser must be used inside AuthGate');
  return user;
}

export function AuthGate({ children }: { children: ReactNode }) {
  const me = useMe();

  if (me.isPending) return <div className="full-page" aria-busy="true" />;
  if (me.isError) {
    return isUnauthorized(me.error) ? <Login /> : <ServerUnavailable onRetry={() => void me.refetch()} />;
  }
  return <CurrentUserContext value={me.data}>{children}</CurrentUserContext>;
}

function ServerUnavailable({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="full-page">
      <div className="login-card">
        <div className="login-card__title">Can't reach Content Machine</div>
        <div className="login-card__text">
          The server did not respond. Check your connection and try again.
        </div>
        <button type="button" className="btn btn--primary login-card__action" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  );
}
