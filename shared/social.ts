/** Social accounts connected on the Social Media screen, shared by the API and the web app. */

export const SOCIAL_PLATFORMS = ['facebook', 'instagram'] as const;

export type SocialPlatformKey = (typeof SOCIAL_PLATFORMS)[number];

export const SOCIAL_ACCOUNT_STATUSES = ['active', 'needs_reconnect', 'error'] as const;

export type SocialAccountStatus = (typeof SOCIAL_ACCOUNT_STATUSES)[number];

/**
 * Permissions asked for when connecting through Facebook, when the app has no
 * Facebook Login for Business configuration. Pages only, read-only for now:
 * Instagram connects through its own login. Scheduled posting (later in M7)
 * adds pages_manage_posts and asks people to connect again.
 */
export const META_PERMISSIONS = ['pages_show_list', 'pages_read_engagement', 'read_insights', 'business_management'] as const;

/**
 * Permissions asked for when an Instagram professional account connects with
 * Instagram Login, which needs no Facebook Page. Posting later adds
 * instagram_business_content_publish.
 */
export const INSTAGRAM_PERMISSIONS = ['instagram_business_basic', 'instagram_business_manage_insights'] as const;

/** How an account was connected, which decides which API and token refresh it uses. */
export const SOCIAL_CONNECTIONS = ['facebook', 'instagram'] as const;

export type SocialConnection = (typeof SOCIAL_CONNECTIONS)[number];

/** Followers are compared with the snapshot this many days earlier. */
export const FOLLOWER_CHANGE_DAYS = 28;

export interface SocialAccount {
  id: string;
  platform: SocialPlatformKey;
  connection: SocialConnection;
  name: string;
  username: string | null;
  pictureUrl: string | null;
  /** The Facebook Page an Instagram account is linked to. */
  pageName: string | null;
  followers: number | null;
  /** Followers gained since the snapshot FOLLOWER_CHANGE_DAYS earlier; null without one. */
  followersChange: number | null;
  /** The first day followers were recorded, so "no comparison yet" can say since when. */
  trackedSince: string | null;
  status: SocialAccountStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  connectedAt: string;
  connectedBy: string | null;
}

export interface PlatformTotals {
  accounts: number;
  followers: number | null;
  followersChange: number | null;
}

export interface SocialOverview {
  accounts: SocialAccount[];
  totals: Record<SocialPlatformKey, PlatformTotals>;
}

/**
 * Which login buttons this server can offer. The apps behind them are set up
 * once by whoever installs Content Machine (docs/Social Media Setup.md), so
 * the people adding accounts only ever see the buttons.
 */
export interface SocialConnectOptions {
  facebook: boolean;
  instagram: boolean;
  /** Tokens are stored encrypted, which needs SECRETS_KEY on the server. */
  secretsKeySet: boolean;
}

/** One Facebook Page found while connecting, with the Instagram account linked to it. */
export interface DiscoveredPage {
  id: string;
  name: string;
  pictureUrl: string | null;
  followers: number | null;
  /** Already connected, so connecting again only refreshes its token. */
  connected: boolean;
  instagram: {
    id: string;
    username: string;
    pictureUrl: string | null;
    followers: number | null;
    connected: boolean;
  } | null;
}

export interface ConnectRequest {
  id: string;
  expiresAt: string;
  pages: DiscoveredPage[];
}

export interface ConnectSelection {
  pageId: string;
  facebook: boolean;
  instagram: boolean;
}
