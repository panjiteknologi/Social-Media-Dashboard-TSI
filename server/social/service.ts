import { and, asc, desc, eq, gt, inArray, lt, lte } from 'drizzle-orm';
import { z } from 'zod';
import { addDays } from '../../shared/seo';
import {
  FOLLOWER_CHANGE_DAYS,
  SOCIAL_PLATFORMS,
  type ConnectRequest,
  type ConnectSelection,
  type PlatformTotals,
  type SocialAccount,
  type SocialConnectOptions,
  type SocialOverview,
  type SocialPlatformKey,
} from '../../shared/social';
import type { Db } from '../db/client';
import { socialAccounts, socialConnectRequests, socialFollowerDaily, users } from '../db/schema';
import type { Env } from '../env';
import type { InstagramAppCredentials, InstagramClient, InstagramProfile, InstagramToken } from './instagram';
import { MetaApiError, type FoundPage, type MetaAppCredentials, type MetaClient } from './meta';
import type { SecretBox } from './secrets';

export const SOCIAL_SYNC_JOB = 'social-sync';

/** Long enough to read the list and tick boxes, short enough that unused Page tokens do not linger. */
const CONNECT_REQUEST_MINUTES = 30;

export class SocialError extends Error {
  readonly status: 400 | 404 | 409;

  constructor(message: string, status: 400 | 404 | 409 = 400) {
    super(message);
    this.name = 'SocialError';
    this.status = status;
  }
}

export interface SocialDeps {
  db: Db;
  env: Env;
  box: SecretBox;
}

/** Where Facebook and Instagram send the browser back: the app, or a public HTTPS address in front of it. */
export const callbackBaseUrl = (env: Env) => env.SOCIAL_CALLBACK_BASE_URL ?? env.APP_BASE_URL;

export const metaRedirectUri = (env: Env) => `${callbackBaseUrl(env)}/api/social/meta/callback`;

export const instagramRedirectUri = (env: Env) => `${callbackBaseUrl(env)}/api/social/instagram/callback`;

// ------------------------------------------------------------------ apps
// Both apps are set up once by whoever installs Content Machine and live in
// the environment, so adding an account is only ever a login.

export const metaAppFromEnv = (env: Env): MetaAppCredentials | null =>
  env.META_APP_ID && env.META_APP_SECRET
    ? { appId: env.META_APP_ID, appSecret: env.META_APP_SECRET, loginConfigId: env.META_LOGIN_CONFIG_ID ?? null }
    : null;

export const instagramAppFromEnv = (env: Env): InstagramAppCredentials | null =>
  env.INSTAGRAM_APP_ID && env.INSTAGRAM_APP_SECRET
    ? { appId: env.INSTAGRAM_APP_ID, appSecret: env.INSTAGRAM_APP_SECRET }
    : null;

export const getConnectOptions = (env: Env): SocialConnectOptions => ({
  facebook: Boolean(metaAppFromEnv(env)),
  instagram: Boolean(instagramAppFromEnv(env)),
  secretsKeySet: Boolean(env.SECRETS_KEY),
});

// ------------------------------------------------------- connect requests

/** Holds the Pages a login or a pasted token found, until a person picks which to add. */
export async function createConnectRequest({ db, box }: SocialDeps, userId: string, pages: FoundPage[]): Promise<string> {
  const now = new Date();
  // Old requests from anyone are useless once expired; clear them as new ones arrive.
  await db.delete(socialConnectRequests).where(lt(socialConnectRequests.expiresAt, now));
  const [row] = await db
    .insert(socialConnectRequests)
    .values({
      userId,
      payload: box.seal(JSON.stringify(pages)),
      expiresAt: new Date(now.getTime() + CONNECT_REQUEST_MINUTES * 60_000),
    })
    .returning({ id: socialConnectRequests.id });
  return row!.id;
}

async function loadConnectRequest({ db, box }: SocialDeps, id: string, userId: string) {
  const [row] = await db
    .select()
    .from(socialConnectRequests)
    .where(
      and(
        eq(socialConnectRequests.id, id),
        eq(socialConnectRequests.userId, userId),
        gt(socialConnectRequests.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) throw new SocialError('This connection has expired. Start again with Add account.', 404);
  return { row, pages: JSON.parse(box.open(row.payload)) as FoundPage[] };
}

export async function getConnectRequest(deps: SocialDeps, id: string, userId: string): Promise<ConnectRequest> {
  const { row, pages } = await loadConnectRequest(deps, id, userId);
  const existing = await deps.db
    .select({ platform: socialAccounts.platform, externalId: socialAccounts.externalId })
    .from(socialAccounts);
  const isConnected = (platform: SocialPlatformKey, externalId: string) =>
    existing.some((account) => account.platform === platform && account.externalId === externalId);

  return {
    id: row.id,
    expiresAt: row.expiresAt.toISOString(),
    pages: pages.map((page) => ({
      id: page.id,
      name: page.name,
      pictureUrl: page.pictureUrl,
      followers: page.followers,
      connected: isConnected('facebook', page.id),
      instagram: page.instagram
        ? { ...page.instagram, connected: isConnected('instagram', page.instagram.id) }
        : null,
    })),
  };
}

export const ConnectSelectionSchema = z.object({
  selections: z
    .array(z.object({ pageId: z.string().min(1), facebook: z.boolean(), instagram: z.boolean() }))
    .min(1, 'Pick at least one account.'),
}) satisfies z.ZodType<{ selections: ConnectSelection[] }>;

/**
 * Adds the picked accounts, or refreshes the token of ones already added, and
 * records today's followers from what the connection already read.
 */
export async function completeConnect(
  deps: SocialDeps,
  id: string,
  userId: string,
  selections: ConnectSelection[],
  today: string,
): Promise<{ connected: number }> {
  const { db, box } = deps;
  const { pages } = await loadConnectRequest(deps, id, userId);

  const rows: Array<{ account: typeof socialAccounts.$inferInsert; followers: number | null }> = [];
  for (const selection of selections) {
    const page = pages.find((candidate) => candidate.id === selection.pageId);
    if (!page) throw new SocialError('A picked Page is not part of this connection.');
    const token = box.seal(page.accessToken);
    const base = { connection: 'facebook' as const, pageId: page.id, pageName: page.name, accessToken: token, connectedBy: userId };
    if (selection.facebook) {
      rows.push({
        account: { ...base, platform: 'facebook', externalId: page.id, name: page.name, username: null, pictureUrl: page.pictureUrl },
        followers: page.followers,
      });
    }
    if (selection.instagram) {
      if (!page.instagram) throw new SocialError(`${page.name} has no Instagram professional account linked.`);
      rows.push({
        account: {
          ...base,
          platform: 'instagram',
          externalId: page.instagram.id,
          name: page.instagram.username,
          username: page.instagram.username,
          pictureUrl: page.instagram.pictureUrl,
        },
        followers: page.instagram.followers,
      });
    }
  }
  if (rows.length === 0) throw new SocialError('Pick at least one account.');

  const now = new Date();
  await db.transaction(async (tx) => {
    for (const { account, followers } of rows) {
      const [saved] = await tx
        .insert(socialAccounts)
        .values({ ...account, status: 'active', lastSyncedAt: now })
        .onConflictDoUpdate({
          target: [socialAccounts.platform, socialAccounts.externalId],
          set: {
            name: account.name,
            username: account.username,
            pictureUrl: account.pictureUrl,
            connection: 'facebook',
            pageId: account.pageId,
            pageName: account.pageName,
            accessToken: account.accessToken,
            // Page tokens do not expire.
            tokenExpiresAt: null,
            status: 'active',
            lastError: null,
            lastSyncedAt: now,
          },
        })
        .returning({ id: socialAccounts.id });
      if (followers !== null) await recordFollowers(tx, saved!.id, today, followers);
    }
    await tx.delete(socialConnectRequests).where(eq(socialConnectRequests.id, id));
  });
  return { connected: rows.length };
}

/**
 * Adds an Instagram account that logged in with Instagram Login, or switches
 * one connected through its Facebook Page over to it.
 */
export async function connectInstagram(
  { db, box }: SocialDeps,
  userId: string,
  profile: InstagramProfile,
  token: InstagramToken,
  today: string,
): Promise<void> {
  const now = new Date();
  const fields = {
    connection: 'instagram' as const,
    name: profile.username,
    username: profile.username,
    pictureUrl: profile.pictureUrl,
    pageId: null,
    pageName: null,
    accessToken: box.seal(token.accessToken),
    tokenExpiresAt: token.expiresAt,
    status: 'active' as const,
    lastError: null,
    lastSyncedAt: now,
  };
  await db.transaction(async (tx) => {
    const [saved] = await tx
      .insert(socialAccounts)
      .values({ ...fields, platform: 'instagram', externalId: profile.id, connectedBy: userId })
      .onConflictDoUpdate({ target: [socialAccounts.platform, socialAccounts.externalId], set: fields })
      .returning({ id: socialAccounts.id });
    if (profile.followers !== null) await recordFollowers(tx, saved!.id, today, profile.followers);
  });
}

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

const recordFollowers = (db: Db | Tx, accountId: string, date: string, followers: number) =>
  db
    .insert(socialFollowerDaily)
    .values({ accountId, date, followers })
    .onConflictDoUpdate({ target: [socialFollowerDaily.accountId, socialFollowerDaily.date], set: { followers } });

export async function disconnectAccount(db: Db, id: string): Promise<void> {
  const [removed] = await db.delete(socialAccounts).where(eq(socialAccounts.id, id)).returning({ id: socialAccounts.id });
  if (!removed) throw new SocialError('Account not found.', 404);
}

// ---------------------------------------------------------------- reading

export async function getSocialOverview(db: Db, today: string): Promise<SocialOverview> {
  const accounts = await db
    .select({ account: socialAccounts, connectedByName: users.name, connectedByEmail: users.email })
    .from(socialAccounts)
    .leftJoin(users, eq(users.id, socialAccounts.connectedBy))
    .orderBy(asc(socialAccounts.platform), asc(socialAccounts.name));

  const ids = accounts.map((row) => row.account.id);
  const snapshots = ids.length
    ? await db
        .select()
        .from(socialFollowerDaily)
        .where(and(inArray(socialFollowerDaily.accountId, ids), lte(socialFollowerDaily.date, today)))
        .orderBy(desc(socialFollowerDaily.date))
    : [];

  const compareDate = addDays(today, -FOLLOWER_CHANGE_DAYS);
  const list: SocialAccount[] = accounts.map(({ account, connectedByName, connectedByEmail }) => {
    const own = snapshots.filter((snapshot) => snapshot.accountId === account.id);
    const latest = own[0];
    // The newest snapshot at least FOLLOWER_CHANGE_DAYS old; none yet means no comparison.
    const before = own.find((snapshot) => snapshot.date <= compareDate);
    return {
      id: account.id,
      platform: account.platform,
      connection: account.connection,
      name: account.name,
      username: account.username,
      pictureUrl: account.pictureUrl,
      pageName: account.platform === 'instagram' ? account.pageName : null,
      followers: latest?.followers ?? null,
      followersChange: latest && before ? latest.followers - before.followers : null,
      trackedSince: own.at(-1)?.date ?? null,
      status: account.status,
      lastError: account.lastError,
      lastSyncedAt: account.lastSyncedAt?.toISOString() ?? null,
      connectedAt: account.connectedAt.toISOString(),
      connectedBy: connectedByName ?? connectedByEmail ?? null,
    };
  });

  const totals = Object.fromEntries(
    SOCIAL_PLATFORMS.map((platform): [SocialPlatformKey, PlatformTotals] => {
      const own = list.filter((account) => account.platform === platform);
      const counted = own.filter((account) => account.followers !== null);
      const changes = counted.map((account) => account.followersChange);
      return [
        platform,
        {
          accounts: own.length,
          followers: counted.length ? counted.reduce((sum, account) => sum + account.followers!, 0) : null,
          // Only a total where every account has a comparison; a partial sum would mislead.
          followersChange:
            counted.length && changes.every((change) => change !== null)
              ? changes.reduce((sum: number, change) => sum + change!, 0)
              : null,
        },
      ];
    }),
  ) as Record<SocialPlatformKey, PlatformTotals>;

  return { accounts: list, totals };
}

// ---------------------------------------------------------------- syncing

export interface FollowerSyncResult {
  date: string;
  accounts: number;
  recorded: number;
  needsReconnect: string[];
  failed: string[];
}

/** Records today's followers for every connected account. Safe to run more than once a day. */
/** Instagram renews a token only once it is a day old; renewing daily after that keeps it 60 days ahead. */
const RENEW_WHEN_LEFT_MS = 59 * 24 * 3600 * 1000;

/** Reads one account's followers and profile, renewing an Instagram Login token on the way. */
async function readAccount(
  account: typeof socialAccounts.$inferSelect,
  token: string,
  clients: { meta: MetaClient; instagram: InstagramClient },
  now: Date,
) {
  if (account.connection === 'instagram') {
    let renewed: InstagramToken | null = null;
    if (account.tokenExpiresAt && account.tokenExpiresAt.getTime() <= now.getTime()) {
      throw new MetaApiError('Instagram: the access token expired. Connect the account again.', 190, null);
    }
    if (!account.tokenExpiresAt || account.tokenExpiresAt.getTime() - now.getTime() < RENEW_WHEN_LEFT_MS) {
      // A failed renewal still leaves a working token until it expires; reading followers decides.
      renewed = await clients.instagram.refreshToken(token).catch(() => null);
    }
    const profile = await clients.instagram.profile(renewed?.accessToken ?? token);
    return { followers: profile.followers, set: { name: profile.username, username: profile.username, pictureUrl: profile.pictureUrl }, renewed };
  }
  if (account.platform === 'facebook') {
    const page = await clients.meta.pageFollowers(account.externalId, token);
    return { followers: page.followers, set: { name: page.name, pictureUrl: page.pictureUrl }, renewed: null };
  }
  const found = await clients.meta.instagramFollowers(account.externalId, token);
  return { followers: found.followers, set: { name: found.username, username: found.username, pictureUrl: found.pictureUrl }, renewed: null };
}

/** Records today's followers for every connected account. Safe to run more than once a day. */
export async function syncFollowers(
  { db, box }: SocialDeps,
  clients: { meta: MetaClient; instagram: InstagramClient },
  today: string,
  now = new Date(),
): Promise<FollowerSyncResult> {
  const accounts = await db.select().from(socialAccounts);
  const result: FollowerSyncResult = { date: today, accounts: accounts.length, recorded: 0, needsReconnect: [], failed: [] };

  for (const account of accounts) {
    try {
      const read = await readAccount(account, box.open(account.accessToken), clients, now);
      await db
        .update(socialAccounts)
        .set({
          ...read.set,
          ...(read.renewed ? { accessToken: box.seal(read.renewed.accessToken), tokenExpiresAt: read.renewed.expiresAt } : {}),
          status: 'active',
          lastError: null,
          lastSyncedAt: new Date(),
        })
        .where(eq(socialAccounts.id, account.id));
      if (read.followers !== null) {
        await recordFollowers(db, account.id, today, read.followers);
        result.recorded++;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const reconnect = error instanceof MetaApiError && error.needsReconnect;
      await db
        .update(socialAccounts)
        .set({ status: reconnect ? 'needs_reconnect' : 'error', lastError: message })
        .where(eq(socialAccounts.id, account.id));
      (reconnect ? result.needsReconnect : result.failed).push(`${account.platform}:${account.name}`);
    }
  }

  // Every account failing for a reason other than its token is an outage worth a retry and an alert.
  if (accounts.length > 0 && result.failed.length === accounts.length) {
    throw new Error(`Could not read followers for any account: ${result.failed.join(', ')}`);
  }
  return result;
}
