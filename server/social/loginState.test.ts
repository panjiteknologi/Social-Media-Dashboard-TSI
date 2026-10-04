import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createLoginState, readLoginState } from './loginState';

const key = randomBytes(32).toString('base64');

describe('login state', () => {
  it('names the user who started the login', () => {
    const state = createLoginState(key, 'user-1', 'instagram');
    expect(readLoginState(key, state, 'instagram')).toBe('user-1');
  });

  it('refuses a state for the other provider, an expired one, or one signed with another key', () => {
    const state = createLoginState(key, 'user-1', 'meta', 0);
    expect(readLoginState(key, state, 'instagram', 1000)).toBeNull();
    expect(readLoginState(key, state, 'meta', 11 * 60_000)).toBeNull();
    expect(readLoginState(randomBytes(32).toString('base64'), createLoginState(key, 'u', 'meta'), 'meta')).toBeNull();
  });

  it('refuses a state whose user was swapped', () => {
    const [body, signature] = createLoginState(key, 'user-1', 'meta').split('.');
    const payload = JSON.parse(Buffer.from(body!, 'base64url').toString());
    const forged = Buffer.from(JSON.stringify({ ...payload, u: 'attacker' })).toString('base64url');
    expect(readLoginState(key, `${forged}.${signature}`, 'meta')).toBeNull();
    expect(readLoginState(key, undefined, 'meta')).toBeNull();
  });
});
