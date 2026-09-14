import { createVerify, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { createTokenProvider, signJwt } from './serviceAccount';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const key = { client_email: 'reader@example.iam.gserviceaccount.com', private_key: privateKey };

describe('signJwt', () => {
  it('produces an RS256 token that verifies against the public key', () => {
    const token = signJwt(privateKey, { iss: key.client_email, aud: 'https://oauth2.googleapis.com/token' });
    const [header, claims, signature] = token.split('.');

    expect(JSON.parse(Buffer.from(header, 'base64url').toString())).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(JSON.parse(Buffer.from(claims, 'base64url').toString()).iss).toBe(key.client_email);
    const valid = createVerify('RSA-SHA256')
      .update(`${header}.${claims}`)
      .verify(publicKey, Buffer.from(signature, 'base64url'));
    expect(valid).toBe(true);
  });
});

describe('createTokenProvider', () => {
  it('reuses a token until shortly before it expires', async () => {
    let clock = 1_000_000;
    let requests = 0;
    const fetchImpl = (async () => {
      requests++;
      return new Response(JSON.stringify({ access_token: `token-${requests}`, expires_in: 3600 }));
    }) as typeof fetch;
    const getToken = createTokenProvider(key, ['scope'], fetchImpl, () => clock);

    expect(await getToken()).toBe('token-1');
    clock += 30 * 60_000;
    expect(await getToken()).toBe('token-1');
    clock += 30 * 60_000;
    expect(await getToken()).toBe('token-2');
    expect(requests).toBe(2);
  });

  it('explains a rejected key', async () => {
    const fetchImpl = (async () =>
      new Response(JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid JWT Signature.' }), {
        status: 400,
      })) as typeof fetch;
    await expect(createTokenProvider(key, ['scope'], fetchImpl)()).rejects.toThrow(/Invalid JWT Signature/);
  });
});
