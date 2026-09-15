/** Content Planner: ideas and content moving through the editorial stages. */
import type { UserRole } from './api';
import { addDays } from './seo';

export const CONTENT_STAGES = [
  'idea',
  'researching',
  'brief_ready',
  'drafting',
  'review',
  'approved',
  'scheduled',
  'published',
] as const;

export type ContentStage = (typeof CONTENT_STAGES)[number];

export const STAGE_LABELS: Record<ContentStage, string> = {
  idea: 'Ideas',
  researching: 'Researching',
  brief_ready: 'Brief Ready',
  drafting: 'Drafting',
  review: 'Review',
  approved: 'Approved',
  scheduled: 'Scheduled',
  published: 'Published',
};

/** Stages only an approver or an admin may move content into. */
export const APPROVER_STAGES: readonly ContentStage[] = ['approved'];

export const canMoveToStage = (role: UserRole, stage: ContentStage): boolean =>
  !APPROVER_STAGES.includes(stage) || role === 'approver' || role === 'admin';

export const CONTENT_TYPES = ['article', 'instagram', 'facebook', 'linkedin'] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, 'Article' | 'Instagram' | 'Facebook' | 'LinkedIn'> = {
  article: 'Article',
  instagram: 'Instagram',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

export const CONTENT_PRIORITIES = ['high', 'medium', 'low'] as const;

export type ContentPriority = (typeof CONTENT_PRIORITIES)[number];

export const PRIORITY_LABELS: Record<ContentPriority, string> = { high: 'High', medium: 'Medium', low: 'Low' };

/** What a person fills in for one piece of content. */
export interface ContentInput {
  title: string;
  type: ContentType;
  stage: ContentStage;
  keyword: string | null;
  campaign: string | null;
  priority: ContentPriority;
  /** YYYY-MM-DD */
  dueDate: string | null;
  ownerId: string | null;
  notes: string | null;
}

export interface ContentItem extends ContentInput {
  id: string;
  /** The standard the content is about, from its keyword or title. */
  cluster: string | null;
  ownerName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ContentEvent {
  id: string;
  kind: 'created' | 'stage_changed' | 'edited';
  fromStage: ContentStage | null;
  toStage: ContentStage | null;
  note: string | null;
  userName: string | null;
  createdAt: string;
}

export interface TeamMember {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
}

/** Monday of the week an ISO date falls in. */
export function weekStart(isoDate: string): string {
  const weekday = new Date(`${isoDate}T00:00:00Z`).getUTCDay();
  return addDays(isoDate, weekday === 0 ? -6 : 1 - weekday);
}

/** The planner numbers the Dashboard shows. */
export function contentSummary(items: ContentItem[], today: string, days = 14) {
  const lastDay = addDays(today, days - 1);
  return {
    /** Scheduled content due from today through the next `days` days. */
    scheduledSoon: items.filter(
      (item) => item.stage === 'scheduled' && item.dueDate !== null && item.dueDate >= today && item.dueDate <= lastDay,
    ).length,
    inReview: items.filter((item) => item.stage === 'review').length,
    /** The next three unpublished items by due date. */
    upcoming: items
      .filter((item) => item.stage !== 'published' && item.dueDate !== null && item.dueDate >= today)
      .sort((a, b) => (a.dueDate ?? '').localeCompare(b.dueDate ?? ''))
      .slice(0, 3),
  };
}
