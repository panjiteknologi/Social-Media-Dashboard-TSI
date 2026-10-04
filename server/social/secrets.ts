import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encrypts tokens and app secrets before they reach the database, so a
 * leaked dump or backup cannot be used to post as the company.
 *
 * AES-256-GCM, stored as "v1.<iv>.<tag>.<ciphertext>" in base64url. The key
 * is SECRETS_KEY and never leaves the server's environment.
 */

const VERSION = 'v1';

export class SecretsKeyMissingError extends Error {
  constructor() {
    super('SECRETS_KEY is not set on the server. Generate one with `npm run cli -- secrets:key`, add it to .env and restart.');
    this.name = 'SecretsKeyMissingError';
  }
}

export interface SecretBox {
  seal(plain: string): string;
  open(sealed: string): string;
}

export function parseSecretsKey(value: string): Buffer {
  const key = /^[0-9a-f]{64}$/i.test(value) ? Buffer.from(value, 'hex') : Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('SECRETS_KEY must be 32 bytes.');
  return key;
}

export function createSecretBox(secretsKey: string): SecretBox {
  const key = parseSecretsKey(secretsKey);
  return {
    seal(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return [VERSION, iv, cipher.getAuthTag(), data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
    },
    open(sealed) {
      const [version, iv, tag, data] = sealed.split('.');
      if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Unreadable stored secret.');
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
    },
  };
}

/** The box when SECRETS_KEY is set; otherwise every use explains how to set it. */
export function secretBoxFromEnv(secretsKey: string | undefined): SecretBox {
  if (secretsKey) return createSecretBox(secretsKey);
  return {
    seal() {
      throw new SecretsKeyMissingError();
    },
    open() {
      throw new SecretsKeyMissingError();
    },
  };
}
