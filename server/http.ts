import type { Context, MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import type { CurrentUser, UserRole } from '../shared/api';
import { SESSION_COOKIE, validateSession } from './auth/session';
import type { Db } from './db/client';

export type AppEnv = { Variables: { user: CurrentUser | null } };

export function setSessionCookie(c: Context, token: string, expires: Date, secure: boolean): void {
  setCookie(c, SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure,
    // Lax, not Strict: the cookie must survive the redirect back from Google.
    sameSite: 'Lax',
    expires,
  });
}

/** Resolves the session cookie, if any, to `c.get('user')`. */
export function loadSession(db: Db, secure: boolean): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    c.set('user', null);
    const token = getCookie(c, SESSION_COOKIE);
    if (token) {
      const session = await validateSession(db, token);
      if (session) {
        c.set('user', session.user);
        if (session.renewedUntil) setSessionCookie(c, token, session.renewedUntil, secure);
      } else {
        deleteCookie(c, SESSION_COOKIE, { path: '/' });
      }
    }
    await next();
  };
}

const ROLE_RANK: Record<UserRole, number> = { viewer: 0, editor: 1, approver: 2, admin: 3 };

/** Rejects the request unless someone is signed in with at least `role`. */
export function requireRole(role: UserRole = 'viewer'): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Not signed in' }, 401);
    if (ROLE_RANK[user.role] < ROLE_RANK[role]) return c.json({ error: 'Not allowed' }, 403);
    await next();
  };
}
