import { decodeIdToken, generateCodeVerifier, generateState, Google } from 'arctic';
import { eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import type { Env } from '../env';
import { setSessionCookie, type AppEnv } from '../http';
import { createSession, deleteSession, SESSION_COOKIE } from './session';

const STATE_COOKIE = 'cm_oauth_state';
const VERIFIER_COOKIE = 'cm_oauth_verifier';
const OAUTH_COOKIE_PATH = '/api/auth';
const OAUTH_COOKIE_MAX_AGE_SECONDS = 10 * 60;

const IdTokenClaims = z.object({
  email: z.string(),
  email_verified: z.boolean().optional(),
  name: z.string().optional(),
});

/** Why a sign-in failed. The login screen explains each one. */
type AuthError = 'not_configured' | 'failed' | 'unverified' | 'not_allowed';

const failTo = (c: Context<AppEnv>, reason: AuthError) => c.redirect(`/?auth_error=${reason}`);

export function authRoutes(db: Db, env: Env) {
  const secure = env.NODE_ENV === 'production';
  const google =
    env.GOOGLE_OAUTH_CLIENT_ID && env.GOOGLE_OAUTH_CLIENT_SECRET
      ? new Google(
          env.GOOGLE_OAUTH_CLIENT_ID,
          env.GOOGLE_OAUTH_CLIENT_SECRET,
          `${env.APP_BASE_URL}/api/auth/google/callback`,
        )
      : null;

  async function signIn(c: Context<AppEnv>, email: string, name: string | undefined) {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase()))
      .limit(1);
    if (!user || !user.active) return failTo(c, 'not_allowed');

    await db
      .update(users)
      .set({ lastLoginAt: new Date(), name: user.name ?? name ?? null })
      .where(eq(users.id, user.id));

    const session = await createSession(db, user.id);
    setSessionCookie(c, session.token, session.expiresAt, secure);
    return c.redirect('/');
  }

  const routes = new Hono<AppEnv>()
    .get('/google', (c) => {
      if (!google) return failTo(c, 'not_configured');

      const state = generateState();
      const codeVerifier = generateCodeVerifier();
      const url = google.createAuthorizationURL(state, codeVerifier, ['openid', 'email', 'profile']);
      url.searchParams.set('prompt', 'select_account');

      const cookie = {
        path: OAUTH_COOKIE_PATH,
        httpOnly: true,
        secure,
        sameSite: 'Lax',
        maxAge: OAUTH_COOKIE_MAX_AGE_SECONDS,
      } as const;
      setCookie(c, STATE_COOKIE, state, cookie);
      setCookie(c, VERIFIER_COOKIE, codeVerifier, cookie);
      return c.redirect(url.toString());
    })
    .get('/google/callback', async (c) => {
      if (!google) return failTo(c, 'not_configured');

      const code = c.req.query('code');
      const state = c.req.query('state');
      const storedState = getCookie(c, STATE_COOKIE);
      const codeVerifier = getCookie(c, VERIFIER_COOKIE);
      deleteCookie(c, STATE_COOKIE, { path: OAUTH_COOKIE_PATH });
      deleteCookie(c, VERIFIER_COOKIE, { path: OAUTH_COOKIE_PATH });

      if (!code || !state || !storedState || !codeVerifier || state !== storedState) {
        return failTo(c, 'failed');
      }

      let claims: z.infer<typeof IdTokenClaims>;
      try {
        const tokens = await google.validateAuthorizationCode(code, codeVerifier);
        // The ID token comes straight from Google's token endpoint over TLS, so
        // its claims can be trusted without re-verifying the signature.
        claims = IdTokenClaims.parse(decodeIdToken(tokens.idToken()));
      } catch (error) {
        console.warn('[auth] Google sign-in failed:', error);
        return failTo(c, 'failed');
      }

      if (claims.email_verified !== true) return failTo(c, 'unverified');
      return signIn(c, claims.email, claims.name);
    })
    .post('/logout', async (c) => {
      const token = getCookie(c, SESSION_COOKIE);
      if (token) await deleteSession(db, token);
      deleteCookie(c, SESSION_COOKIE, { path: '/' });
      return c.json({ ok: true });
    });

  if (env.AUTH_DEV_LOGIN_EMAIL && env.NODE_ENV !== 'production') {
    const email = env.AUTH_DEV_LOGIN_EMAIL;
    routes.get('/dev-login', (c) => signIn(c, email, undefined));
  }

  return routes;
}
