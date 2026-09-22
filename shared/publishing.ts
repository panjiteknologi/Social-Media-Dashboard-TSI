/**
 * Publishing an approved article to the website's CMS.
 *
 * Content Machine writes the article into the CMS as a draft. A person adds the
 * cover image and presses Publish there; the hourly CMS sync notices that it
 * went live and moves the content to Published here.
 */

export const PUBLISH_STATUSES = ['queued', 'running', 'failed'] as const;

/** Null once the last attempt finished, successfully or not. */
export type PublishStatus = (typeof PUBLISH_STATUSES)[number];

/** A queued or running publish silent for this long counts as stopped. */
export const PUBLISH_STALE_MINUTES = 15;

export interface PublishSummary {
  status: PublishStatus | null;
  error: string | null;
  updatedAt: string | null;
  /** The CMS row this content became, once it exists. */
  cmsPostId: number | null;
  cmsSlug: string | null;
  /** The CMS's own status: draft, scheduling or publish. */
  cmsStatus: string | null;
  /** Where it will live, or lives, on the website. */
  url: string | null;
}

export const EMPTY_PUBLISH: PublishSummary = {
  status: null,
  error: null,
  updatedAt: null,
  cmsPostId: null,
  cmsSlug: null,
  cmsStatus: null,
  url: null,
};

/** Whether a publish is still waiting or running. */
export function isPublishBusy(publish: Pick<PublishSummary, 'status' | 'updatedAt'>, now = Date.now()): boolean {
  if (publish.status !== 'queued' && publish.status !== 'running') return false;
  if (!publish.updatedAt) return true;
  return now - new Date(publish.updatedAt).getTime() < PUBLISH_STALE_MINUTES * 60_000;
}

/** What the team sees about an article's place in the CMS. */
export function publishStateLabel(publish: PublishSummary): string {
  if (isPublishBusy(publish)) return 'Sending to the CMS…';
  if (publish.status === 'failed') return 'Could not be sent to the CMS';
  if (publish.cmsStatus === 'publish') return 'Live on the website';
  if (publish.cmsStatus === 'scheduling') return 'Scheduled in the CMS';
  if (publish.cmsStatus === 'draft') return 'Draft in the CMS, waiting for a cover image';
  return 'Not in the CMS yet';
}

/** Why this content cannot be sent to the CMS, or null when it can. */
export function publishBlocker(item: { type: string; hasDraft: boolean; stage: string }): string | null {
  if (item.type !== 'article') return 'Only articles go to the CMS. Social posts arrive with M7.';
  if (!item.hasDraft) return 'There is no article to send. Write the draft first.';
  if (['idea', 'researching', 'brief_ready', 'drafting', 'review'].includes(item.stage)) {
    return 'Approve the article before sending it to the CMS.';
  }
  if (item.stage === 'rejected') return 'This article was rejected.';
  return null;
}
