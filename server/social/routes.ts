import { and, eq } from 'drizzle-orm';
import { Hono, type Context } from 'hono';
import type { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { INSTAGRAM_PERMISSIONS, META_PERMISSIONS } from '../../shared/social';
import type { Db } from '../db/client';
import { users } from '../db/schema';
import type { Env } from '../env';
import { requireRole, type AppEnv } from '../http';
import type { JobEnvelope } from '../jobs/job';
import { todayIn } from '../seo/sync';
import { createInstagramClient } from './instagram';
import { createLoginState, readLoginState, type LoginProvider } from './loginState';
import { createMetaClient, MetaApiError } from './meta';
import { SecretsKeyMissingError, secretBoxFromEnv } from './secrets';
import {
  completeConnect,
  ConnectSelectionSchema,
  createConnectRequest,
  disconnectAccount,
  getConnectRequest,
  connectInstagram,
  getConnectOptions,
  getSocialOverview,
  instagramAppFromEnv,
  instagramRedirectUri,
  metaAppFromEnv,
  metaRedirectUri,
  SOCIAL_SYNC_JOB,
  SocialError,
  type SocialDeps,
} from './service';

/** The apps are part of installing Content Machine, not something the person connecting can fix. */
const NOT_SET_UP =
  'This login is not set up on the server yet. Ask whoever installed Content Machine to follow docs/Social Media Setup.md.';

/** Turns the errors a person can act on into a message; anything else stays a 500. */
function explain(c: Context<AppEnv>, error: unknown) {
  if (error instanceof SocialError) return c.json({ error: error.message }, error.status);
  if (error instanceof SecretsKeyMissingError) return c.json({ error: error.message }, 400);
  if (error instanceof MetaApiError) return c.json({ error: error.message }, 502);
  throw error;
}

export function socialRoutes({ db, env, boss }: { db: Db; env: Env; boss: PgBoss }) {
  const deps: SocialDeps = { db, env, box: secretBoxFromEnv(env.SECRETS_KEY) };
  const meta = createMetaClient({ graphVersion: env.META_GRAPH_VERSION });
  const instagram = createInstagramClient({ graphVersion: env.META_GRAPH_VERSION });
  const metaRedirect = metaRedirectUri(env);
  const instagramRedirect = instagramRedirectUri(env);

  const startLogin = (c: Context<AppEnv>, provider: LoginProvider) =>
    createLoginState(env.SECRETS_KEY!, c.get('user')!.id, provider);

  /**
   * The admin who started this login. The callback may arrive on the public
   * callback host without the session cookie, so the signed state says who it
   * is, and they must still be an active admin.
   */
  async function finishLogin(c: Context<AppEnv>, provider: LoginProvider): Promise<string | null> {
    if (!env.SECRETS_KEY) return null;
    const userId = readLoginState(env.SECRETS_KEY, c.req.query('state'), provider);
    if (!userId) return null;
    const [admin] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.active, true), eq(users.role, 'admin')))
      .limit(1);
    return admin?.id ?? null;
  }

  /** Back to the Social Media screen on the app itself, which explains the outcome. */
  const backTo = (c: Context<AppEnv>, params: Record<string, string>) =>
    c.redirect(`${env.APP_BASE_URL}/social?${new URLSearchParams(params).toString()}`);

  return new Hono<AppEnv>()
    .get('/overview', requireRole(), async (c) => c.json(await getSocialOverview(db, todayIn(env.TIMEZONE))))
    .get('/options', requireRole(), (c) => c.json(getConnectOptions(env)))
    // Browser navigations, not fetches: each ends at Facebook's or Instagram's login.
    .get('/meta/connect', requireRole('admin'), (c) => {
      if (!env.SECRETS_KEY) return backTo(c, { connect_error: new SecretsKeyMissingError().message });
      const app = metaAppFromEnv(env);
      if (!app) return backTo(c, { connect_error: NOT_SET_UP });
      return c.redirect(meta.loginUrl(app, metaRedirect, startLogin(c, 'meta'), META_PERMISSIONS));
    })
    .get('/meta/callback', async (c) => {
      const { code, error_reason: reason, error_description: description } = c.req.query();
      if (reason === 'user_denied') return backTo(c, { connect_error: 'Facebook login was cancelled.' });
      const userId = await finishLogin(c, 'meta');
      if (!code || !userId) {
        return backTo(c, { connect_error: description ?? 'The Facebook login could not be verified. Try again.' });
      }
      try {
        const app = metaAppFromEnv(env);
        if (!app) return backTo(c, { connect_error: NOT_SET_UP });
        const userToken = await meta.exchangeCode(app, metaRedirect, code);
        const pages = await meta.discoverPages(userToken);
        if (pages.length === 0) {
          return backTo(c, {
            connect_error:
              'Facebook did not share any Page. Log in again and, on the permission screen, tick the Pages to connect.',
          });
        }
        return backTo(c, { connect: await createConnectRequest(deps, userId, pages) });
      } catch (error) {
        console.warn('[social] Facebook connection failed:', error);
        return backTo(c, { connect_error: error instanceof Error ? error.message : 'The Facebook connection failed.' });
      }
    })
    .get('/instagram/connect', requireRole('admin'), (c) => {
      if (!env.SECRETS_KEY) return backTo(c, { connect_error: new SecretsKeyMissingError().message });
      const app = instagramAppFromEnv(env);
      if (!app) return backTo(c, { connect_error: NOT_SET_UP });
      return c.redirect(instagram.loginUrl(app, instagramRedirect, startLogin(c, 'instagram'), INSTAGRAM_PERMISSIONS));
    })
    .get('/instagram/callback', async (c) => {
      const { code, error_reason: reason, error_description: description } = c.req.query();
      if (reason === 'user_denied') return backTo(c, { connect_error: 'Instagram login was cancelled.' });
      const userId = await finishLogin(c, 'instagram');
      if (!code || !userId) {
        return backTo(c, { connect_error: description ?? 'The Instagram login could not be verified. Try again.' });
      }
      try {
        const app = instagramAppFromEnv(env);
        if (!app) return backTo(c, { connect_error: NOT_SET_UP });
        const token = await instagram.exchangeCode(app, instagramRedirect, code);
        const profile = await instagram.profile(token.accessToken);
        // One account per Instagram login, so there is nothing to pick: it is added straight away.
        await connectInstagram(deps, userId, profile, token, todayIn(env.TIMEZONE));
        return backTo(c, { connected: `@${profile.username}` });
      } catch (error) {
        console.warn('[social] Instagram connection failed:', error);
        return backTo(c, { connect_error: error instanceof Error ? error.message : 'The Instagram connection failed.' });
      }
    })
    // For a System User token from Business Settings, or any token made outside this app.
    .post('/meta/token', requireRole('admin'), async (c) => {
      const body = z
        .object({ accessToken: z.string().trim().min(20, 'Paste the whole access token.') })
        .safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
      try {
        const pages = await meta.discoverPages(body.data.accessToken);
        if (pages.length === 0) {
          return c.json({ error: 'This token cannot manage any Facebook Page. Assign the Pages to the System User first.' }, 400);
        }
        return c.json({ id: await createConnectRequest(deps, c.get('user')!.id, pages) }, 201);
      } catch (error) {
        return explain(c, error);
      }
    })
    .get('/connect/:id', requireRole('admin'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Connection not found' }, 404);
      try {
        return c.json(await getConnectRequest(deps, id.data, c.get('user')!.id));
      } catch (error) {
        return explain(c, error);
      }
    })
    .post('/connect/:id', requireRole('admin'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Connection not found' }, 404);
      const body = ConnectSelectionSchema.safeParse(await c.req.json().catch(() => null));
      if (!body.success) return c.json({ error: z.prettifyError(body.error) }, 400);
      try {
        return c.json(
          await completeConnect(deps, id.data, c.get('user')!.id, body.data.selections, todayIn(env.TIMEZONE)),
        );
      } catch (error) {
        return explain(c, error);
      }
    })
    .delete('/accounts/:id', requireRole('admin'), async (c) => {
      const id = z.uuid().safeParse(c.req.param('id'));
      if (!id.success) return c.json({ error: 'Account not found' }, 404);
      try {
        await disconnectAccount(db, id.data);
        return c.json({ deleted: true });
      } catch (error) {
        return explain(c, error);
      }
    })
    .post('/refresh', requireRole('editor'), async (c) => {
      const envelope: JobEnvelope = { trigger: 'manual', triggeredBy: c.get('user')?.id };
      return c.json({ queueJobId: await boss.send(SOCIAL_SYNC_JOB, envelope) }, 202);
    });
}
