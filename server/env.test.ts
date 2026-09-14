import { describe, expect, it } from 'vitest';
import { parseEnv } from './env';

describe('parseEnv', () => {
  it('treats blank values as unset and fills defaults', () => {
    const env = parseEnv({ DATABASE_URL: 'postgresql://localhost/test', TELEGRAM_BOT_TOKEN: '' });
    expect(env.TELEGRAM_BOT_TOKEN).toBeUndefined();
    expect(env.API_PORT).toBe(8787);
    expect(env.TIMEZONE).toBe('Asia/Jakarta');
  });

  it('requires a database URL', () => {
    expect(() => parseEnv({})).toThrow(/DATABASE_URL/);
  });

  it('refuses the development sign-in in production', () => {
    expect(() =>
      parseEnv({
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://localhost/test',
        AUTH_DEV_LOGIN_EMAIL: 'someone@example.com',
      }),
    ).toThrow(/AUTH_DEV_LOGIN_EMAIL/);
  });
});
