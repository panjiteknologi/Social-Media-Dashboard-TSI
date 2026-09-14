import { describe, expect, it } from 'vitest';
import { decideSession, generateSessionToken, hashSessionToken, SESSION_TTL_MS } from './session';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('session tokens', () => {
  it('hashes a token deterministically without exposing it', () => {
    const token = generateSessionToken();
    const hash = hashSessionToken(token);
    expect(hash).toBe(hashSessionToken(token));
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toContain(token);
  });

  it('generates a different token every time', () => {
    expect(generateSessionToken()).not.toBe(generateSessionToken());
  });
});

describe('decideSession', () => {
  const now = new Date('2026-09-13T00:00:00Z');
  const inDays = (days: number) => new Date(now.getTime() + days * DAY_MS);

  it('expires a session at its expiry time', () => {
    expect(decideSession(now, now)).toBe('expired');
  });

  it('renews a session within 15 days of expiry', () => {
    expect(decideSession(inDays(14), now)).toBe('renew');
  });

  it('leaves a freshly created session alone', () => {
    expect(decideSession(new Date(now.getTime() + SESSION_TTL_MS), now)).toBe('valid');
  });
});
