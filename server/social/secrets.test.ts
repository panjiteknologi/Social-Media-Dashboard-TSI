import { randomBytes } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createSecretBox, SecretsKeyMissingError, secretBoxFromEnv } from './secrets';

describe('secret box', () => {
  const key = randomBytes(32).toString('base64');

  it('round-trips a token without storing it in the clear', () => {
    const box = createSecretBox(key);
    const sealed = box.seal('EAAB-page-token');
    expect(sealed).not.toContain('EAAB');
    expect(box.open(sealed)).toBe('EAAB-page-token');
  });

  it('accepts a hex key too', () => {
    const box = createSecretBox(randomBytes(32).toString('hex'));
    expect(box.open(box.seal('x'))).toBe('x');
  });

  it('refuses a value sealed with another key or altered', () => {
    const sealed = createSecretBox(key).seal('secret');
    expect(() => createSecretBox(randomBytes(32).toString('base64')).open(sealed)).toThrow();
    const tampered = sealed.slice(0, -2) + (sealed.endsWith('A') ? 'BB' : 'AA');
    expect(() => createSecretBox(key).open(tampered)).toThrow();
  });

  it('explains how to set the key when it is missing', () => {
    expect(() => secretBoxFromEnv(undefined).seal('x')).toThrow(SecretsKeyMissingError);
  });
});
