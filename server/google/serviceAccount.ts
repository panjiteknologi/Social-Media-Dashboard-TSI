import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { z } from 'zod';

const ServiceAccountKeySchema = z.object({
  client_email: z.string(),
  private_key: z.string(),
  project_id: z.string().optional(),
});

export type ServiceAccountKey = z.infer<typeof ServiceAccountKeySchema>;

export function readServiceAccountKey(path: string): ServiceAccountKey {
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    throw new Error(
      `Could not read the Google service account key at ${path}: ${error instanceof Error ? error.message : error}`,
    );
  }
  const parsed = ServiceAccountKeySchema.safeParse(raw);
  if (!parsed.success) throw new Error(`${path} is not a Google service account key file.`);
  return parsed.data;
}

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

/** Tokens are refreshed a minute early so none expires in the middle of a request. */
const EXPIRY_MARGIN_MS = 60_000;

const base64url = (value: string): string => Buffer.from(value).toString('base64url');

/** A JWT signed with the service account's private key (RS256). */
export function signJwt(privateKey: string, claims: Record<string, unknown>): string {
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify(claims))}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(privateKey).toString('base64url');
  return `${unsigned}.${signature}`;
}

/**
 * Access tokens for a service account through Google's OAuth JWT bearer flow,
 * cached until shortly before they expire.
 */
export function createTokenProvider(
  key: ServiceAccountKey,
  scopes: string[],
  fetchImpl: typeof fetch = fetch,
  now: () => number = Date.now,
): () => Promise<string> {
  let cached: { token: string; expiresAt: number } | null = null;

  return async () => {
    if (cached && cached.expiresAt - EXPIRY_MARGIN_MS > now()) return cached.token;

    const issuedAt = Math.floor(now() / 1000);
    const assertion = signJwt(key.private_key, {
      iss: key.client_email,
      scope: scopes.join(' '),
      aud: TOKEN_URL,
      iat: issuedAt,
      exp: issuedAt + 3600,
    });
    const response = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }),
    });
    const body = (await response.json().catch(() => null)) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    } | null;
    if (!response.ok || !body?.access_token) {
      throw new Error(
        `Google rejected the service account (${response.status}): ${body?.error_description ?? body?.error ?? 'no details'}`,
      );
    }

    cached = { token: body.access_token, expiresAt: now() + (body.expires_in ?? 3600) * 1000 };
    return cached.token;
  };
}
