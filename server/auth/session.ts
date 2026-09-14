import { createHash, randomBytes } from 'node:crypto';
import { and, eq, lt } from 'drizzle-orm';
import type { CurrentUser } from '../../shared/api';
import type { Db } from '../db/client';
import { sessions, users } from '../db/schema';

export const SESSION_COOKIE = 'cm_session';

const DAY_MS = 24 * 60 * 60 * 1000;

export const SESSION_TTL_MS = 30 * DAY_MS;

/** A session used within this window of expiring is extended, so active users stay signed in. */
const RENEW_WITHIN_MS = 15 * DAY_MS;

export const generateSessionToken = (): string => randomBytes(32).toString('base64url');

export const hashSessionToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export type SessionDecision = 'expired' | 'renew' | 'valid';

export function decideSession(expiresAt: Date, now: Date): SessionDecision {
  const remainingMs = expiresAt.getTime() - now.getTime();
  if (remainingMs <= 0) return 'expired';
  return remainingMs < RENEW_WITHIN_MS ? 'renew' : 'valid';
}

export async function createSession(
  db: Db,
  userId: string,
  now = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id: hashSessionToken(token), userId, expiresAt });
  return { token, expiresAt };
}

export interface ValidSession {
  user: CurrentUser;
  /** Set when this request extended the session, so the cookie needs the new expiry. */
  renewedUntil: Date | null;
}

/** Resolves a cookie token to its user. Deletes expired sessions and extends ones close to expiry. */
export async function validateSession(
  db: Db,
  token: string,
  now = new Date(),
): Promise<ValidSession | null> {
  const id = hashSessionToken(token);
  const [row] = await db
    .select({
      expiresAt: sessions.expiresAt,
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, id), eq(users.active, true)))
    .limit(1);

  if (!row) return null;

  const decision = decideSession(row.expiresAt, now);
  if (decision === 'expired') {
    await db.delete(sessions).where(eq(sessions.id, id));
    return null;
  }

  let renewedUntil: Date | null = null;
  if (decision === 'renew') {
    renewedUntil = new Date(now.getTime() + SESSION_TTL_MS);
    await db.update(sessions).set({ expiresAt: renewedUntil }).where(eq(sessions.id, id));
  }

  return {
    user: { id: row.id, email: row.email, name: row.name, role: row.role },
    renewedUntil,
  };
}

export async function deleteSession(db: Db, token: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, hashSessionToken(token)));
}

export async function deleteExpiredSessions(db: Db, now = new Date()): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });
  return deleted.length;
}
