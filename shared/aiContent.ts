/**
 * The AI writing chain: topic recommendations from search data, then a brief,
 * a draft and a QA check for one article in the Content Planner.
 */
import type { JobRunStatus } from './api';
import type { SeoCheck } from './content';

export const SEARCH_INTENTS = ['informational', 'commercial', 'transactional', 'navigational'] as const;

export type SearchIntent = (typeof SEARCH_INTENTS)[number];

export const INTENT_LABELS: Record<SearchIntent, string> = {
  informational: 'Informational',
  commercial: 'Commercial investigation',
  transactional: 'Transactional',
  navigational: 'Navigational',
};

export const TOPIC_ACTIONS = ['new_article', 'update_article'] as const;

export type TopicAction = (typeof TOPIC_ACTIONS)[number];

export const TOPIC_STATUSES = ['new', 'planned', 'dismissed'] as const;

export type TopicStatus = (typeof TOPIC_STATUSES)[number];

export interface TopicRecommendation {
  id: string;
  /** A real search query from Search Console. */
  keyword: string;
  title: string;
  intent: SearchIntent;
  action: TopicAction;
  /** The article to improve, for update_article. */
  existingUrl: string | null;
  angle: string;
  reason: string;
  cluster: string | null;
  /** Search Console numbers for the keyword over the last 28 days, when recommended. */
  impressions: number;
  position: number;
  opportunityScore: number | null;
  status: TopicStatus;
  contentItemId: string | null;
  createdAt: string;
}

export interface TopicsResponse {
  configured: boolean;
  items: TopicRecommendation[];
  lastRun: { status: JobRunStatus; startedAt: string; finishedAt: string | null; error: string | null } | null;
}

export const AI_TASKS = ['brief', 'draft', 'qa', 'revise'] as const;

export type AiTask = (typeof AI_TASKS)[number];

export const AI_TASK_LABELS: Record<AiTask, string> = {
  brief: 'brief',
  draft: 'draft',
  qa: 'QA check',
  revise: 'revision',
};

export const AI_TASK_STATUSES = ['queued', 'running', 'failed'] as const;

export type AiTaskStatus = (typeof AI_TASK_STATUSES)[number];

/** A queued or running task that has not moved for this long was cut off, and may be started again. */
export const AI_STALE_MINUTES = 30;

export interface ContentBrief {
  workingTitle: string;
  focusKeyword: string;
  searchIntent: SearchIntent;
  targetReader: string;
  angle: string;
  outline: Array<{ heading: string; points: string[] }>;
  mustCover: string[];
  internalLinks: Array<{ url: string; title: string; reason: string }>;
  faq: string[];
  cta: string;
  impartialityNotes: string[];
  wordTarget: { min: number; max: number };
}

export interface ArticleDraft {
  /** The article title, shown as the page H1. */
  title: string;
  seoTitle: string;
  metaDescription: string;
  slug: string;
  excerpt: string;
  focusKeyword: string;
  tags: string[];
  /** The article body without the H1, starting at the first paragraph. */
  html: string;
  wordCount: number;
  model: string;
  writtenAt: string;
}

export const QA_SEVERITIES = ['high', 'medium', 'low'] as const;

export type QaSeverity = (typeof QA_SEVERITIES)[number];

export interface QaIssue {
  severity: QaSeverity;
  category: string;
  quote: string;
  problem: string;
  fix: string;
}

export interface FlaggedPhrase {
  phrase: string;
  rule: string;
  context: string;
}

export interface QaResult {
  checkedAt: string;
  seo: { score: number; checks: SeoCheck[] };
  /** Wording the rules forbid, found by plain text matching. */
  flaggedPhrases: FlaggedPhrase[];
  review: {
    model: string;
    brandScore: number;
    impartiality: 'pass' | 'fail';
    summary: string;
    issues: QaIssue[];
  } | null;
  /** Why there is no AI review, when there is none. */
  reviewNote: string | null;
}

export type QaVerdict = 'pass' | 'attention' | 'fail';

export const QA_VERDICT_LABELS: Record<QaVerdict, string> = {
  pass: 'Passed QA',
  attention: 'Needs attention',
  fail: 'Failed QA',
};

/** Fail on an impartiality failure or a high-severity issue; attention on anything a reviewer should look at. */
export function qaVerdict(qa: QaResult): QaVerdict {
  if (qa.review?.impartiality === 'fail' || qa.review?.issues.some((issue) => issue.severity === 'high')) return 'fail';
  if (
    !qa.review ||
    qa.flaggedPhrases.length > 0 ||
    qa.seo.score < 80 ||
    qa.review.brandScore < 80 ||
    qa.review.issues.some((issue) => issue.severity === 'medium')
  ) {
    return 'attention';
  }
  return 'pass';
}

/** A content item's AI progress, as the planner lists it. */
export interface ContentAiSummary {
  task: AiTask | null;
  status: AiTaskStatus | null;
  error: string | null;
  updatedAt: string | null;
  hasBrief: boolean;
  hasDraft: boolean;
  qaVerdict: QaVerdict | null;
}

export interface ContentAiDetail {
  configured: boolean;
  summary: ContentAiSummary;
  brief: ContentBrief | null;
  draft: ArticleDraft | null;
  qa: QaResult | null;
}

/** Whether a task is waiting or running; one silent for AI_STALE_MINUTES counts as stopped. */
export function isAiBusy(summary: Pick<ContentAiSummary, 'status' | 'updatedAt'>, now = Date.now()): boolean {
  if (summary.status !== 'queued' && summary.status !== 'running') return false;
  if (!summary.updatedAt) return true;
  return now - new Date(summary.updatedAt).getTime() < AI_STALE_MINUTES * 60_000;
}

/** Why a task cannot start yet, or null when it can. */
export function aiTaskBlocker(
  task: AiTask,
  item: { type: string; hasBrief: boolean; hasDraft: boolean },
): string | null {
  if (item.type !== 'article') return 'The AI writer handles articles. Social posts arrive with M7.';
  if (task === 'draft' && !item.hasBrief) return 'Generate the brief first.';
  if ((task === 'qa' || task === 'revise') && !item.hasDraft) return 'Write the draft first.';
  return null;
}
