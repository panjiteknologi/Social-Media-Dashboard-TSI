import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { parseSecretsKey } from './secrets';

/**
 * The `state` carried through a Facebook or Instagram login, signed with
 * SECRETS_KEY. It names who started the login, so the callback works even
 * when it arrives on another host than the app (an HTTPS address in front of
 * a local server, which Instagram requires), where the session cookie is not sent.
 */

export type LoginProvider = 'meta' | 'instagram';

const LIFETIME_MS = 10 * 60_000;

interface Payload {
  u: string;
  p: LoginProvider;
  e: number;
  n: string;
}

const sign = (key: Buffer, body: string) => createHmac('sha256', key).update(body).digest('base64url');

export function createLoginState(secretsKey: string, userId: string, provider: LoginProvider, now = Date.now()): string {
  const payload: Payload = { u: userId, p: provider, e: now + LIFETIME_MS, n: randomBytes(12).toString('base64url') };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${sign(parseSecretsKey(secretsKey), body)}`;
}

/** The user who started this login, or null when the state is forged, altered, expired or for another provider. */
export function readLoginState(
  secretsKey: string,
  state: string | undefined,
  provider: LoginProvider,
  now = Date.now(),
): string | null {
  const [body, signature] = (state ?? '').split('.');
  if (!body || !signature) return null;
  const expected = Buffer.from(sign(parseSecretsKey(secretsKey), body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Payload;
    if (payload.p !== provider || payload.e < now || typeof payload.u !== 'string') return null;
    return payload.u;
  } catch {
    return null;
  }
}
