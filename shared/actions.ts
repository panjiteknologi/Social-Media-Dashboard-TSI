/** SEO Action Center: tasks generated from search data and the weekly crawl. */

export const ACTION_PRIORITIES = ['P1', 'P2', 'P3'] as const;

export type ActionPriority = (typeof ACTION_PRIORITIES)[number];

export const ACTION_STATUSES = ['open', 'in_progress', 'done'] as const;

export type ActionStatus = (typeof ACTION_STATUSES)[number];

export const ACTION_STATUS_LABELS: Record<ActionStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  done: 'Done',
};

export const PRIORITY_IMPACT: Record<ActionPriority, 'High' | 'Medium' | 'Low'> = {
  P1: 'High',
  P2: 'Medium',
  P3: 'Low',
};

export interface SeoAction {
  id: string;
  kind: string;
  priority: ActionPriority;
  issue: string;
  /** A keyword, a page URL, or the website host for site-wide tasks. */
  target: string;
  action: string;
  detail: string;
  status: ActionStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  resolvedAt: string | null;
  /** "user" when someone marked it done, "system" when the issue was no longer found. */
  resolvedBy: 'user' | 'system' | null;
}

export interface SeoActionsResponse {
  contentHost: string;
  actions: SeoAction[];
}
