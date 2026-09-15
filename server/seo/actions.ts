import { eq, gt, ne, or } from 'drizzle-orm';
import type { ActionPriority, ActionStatus, SeoAction, SeoActionsResponse } from '../../shared/actions';
import type { SeoKeywords, SeoSettings } from '../../shared/seo';
import type { HealthCheckKey, TechnicalHealth } from '../../shared/technical';
import type { Db } from '../db/client';
import { seoActions } from '../db/schema';

export interface ActionCandidate {
  /** Identifies the same task across runs, e.g. "keyword-drop:sertifikasi iso". */
  key: string;
  kind: string;
  priority: ActionPriority;
  issue: string;
  target: string;
  action: string;
  detail: string;
}

/** Opportunity keywords turned into tasks, best first. */
const MAX_OPPORTUNITY_TASKS = 3;

/** A task someone marked done opens again if its issue is still found this long afterwards. */
export const REOPEN_AFTER_DAYS = 14;

/** Done tasks stay listed this long, so the team sees what was cleared. */
export const DONE_VISIBLE_DAYS = 14;

const DAY_MS = 24 * 60 * 60 * 1000;

const position = (value: number | null): string => (value === null ? '—' : value.toFixed(1));

/** A page as the team reads it: the path on the website, host and path on any other host (such as a subdomain). */
const pathOf = (url: string, contentHost?: string): string => {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    return !contentHost || parsed.hostname === contentHost ? path : `${parsed.hostname}${path === '/' ? '' : path}`;
  } catch {
    return url;
  }
};

function opportunityAction(keywordPosition: number): string {
  if (keywordPosition <= 10) return 'Already on page 1: sharpen the title and meta description and deepen the content.';
  if (keywordPosition <= 20) return 'On page 2: expand the content and add internal links from related pages.';
  return 'Deeper in the results: create or rework a page that targets this keyword directly.';
}

/** Site-wide technical tasks, one per check rather than one per page, so a long list stays readable. */
const TECHNICAL_TASKS: Partial<Record<HealthCheckKey, { priority: ActionPriority; issue: (count: number) => string; action: string }>> = {
  index: {
    priority: 'P2',
    issue: (count) => `${count} page${count === 1 ? '' : 's'} not indexed by Google`,
    action:
      'Open these pages in Search Console URL Inspection. Strengthen their content and internal links, then request indexing for the ones that matter.',
  },
  metadata: {
    priority: 'P2',
    issue: (count) => `${count} page${count === 1 ? '' : 's'} missing a title or meta description`,
    action: 'Add a unique title and meta description to each page.',
  },
  slowPages: {
    priority: 'P2',
    issue: (count) => `${count} page${count === 1 ? ' is' : 's are'} slow on mobile`,
    action: 'Compress and resize images, and remove scripts the page does not need.',
  },
  duplicateTitles: {
    priority: 'P3',
    issue: (count) => `${count} pages share a title with another page`,
    action: 'Give every page a title that names its own topic, and translate the titles of the Indonesian pages.',
  },
  canonical: {
    priority: 'P3',
    issue: (count) => `${count} page${count === 1 ? '' : 's'} with canonical tag problems`,
    action: 'Check that each canonical tag points to the page Google should show, and fix the ones that are not intentional.',
  },
  altText: {
    priority: 'P3',
    issue: (count) => `${count} page${count === 1 ? '' : 's'} with images missing alt text`,
    action: 'Describe each image in its alt text.',
  },
  schema: {
    priority: 'P3',
    issue: (count) => `${count} page${count === 1 ? '' : 's'} without valid structured data`,
    action: 'Add or fix the JSON-LD structured data on these pages.',
  },
};

/** The tasks today's data calls for. */
export function buildActionCandidates(keywords: SeoKeywords, health: TechnicalHealth): ActionCandidate[] {
  const candidates: ActionCandidate[] = [];

  for (const row of keywords.keywords) {
    const landing = row.landingPage ? pathOf(row.landingPage) : 'its landing page';
    const detail = `Position ${position(row.previousPosition)} → ${position(row.position)}, ${row.impressions} impressions in 28 days`;
    if (row.status === 'At Risk') {
      candidates.push({
        key: `keyword-at-risk:${row.query}`,
        kind: 'keyword_at_risk',
        priority: 'P1',
        issue: 'Keyword left page 1',
        target: row.query,
        action: `Refresh ${landing} and link to it from related pages.`,
        detail,
      });
    } else if (row.status === 'Dropping' && !row.isBrand) {
      candidates.push({
        key: `keyword-drop:${row.query}`,
        kind: 'ranking_decline',
        priority: 'P2',
        issue: 'Ranking decline',
        target: row.query,
        action: `Update ${landing} with current facts, deeper sections and internal links.`,
        detail,
      });
    }
  }

  for (const item of keywords.attention) {
    if (item.reason === 'Low CTR') {
      candidates.push({
        key: `low-ctr:${item.page}`,
        kind: 'low_ctr',
        priority: 'P2',
        issue: 'Low CTR',
        target: item.page,
        action: 'Rewrite the title and meta description so they answer what searchers are looking for.',
        detail: item.detail,
      });
    } else if (item.reason === 'Ranking declining') {
      candidates.push({
        key: `page-decline:${item.page}`,
        kind: 'page_decline',
        priority: 'P2',
        issue: 'Page ranking decline',
        target: item.page,
        action: 'Refresh the page content and add internal links from related pages.',
        detail: item.detail,
      });
    }
  }

  for (const item of keywords.cannibalization) {
    candidates.push({
      key: `cannibalization:${item.query}`,
      kind: 'cannibalization',
      priority: 'P2',
      issue: 'Keyword cannibalization',
      target: item.query,
      action: 'Choose one primary page for this keyword, then link the other pages to it or merge them.',
      detail: item.pages
        .map((page) => `${pathOf(page.page, health.contentHost)} ${Math.round(page.share * 100)}%`)
        .join(', '),
    });
  }

  for (const row of keywords.opportunities.slice(0, MAX_OPPORTUNITY_TASKS)) {
    candidates.push({
      key: `opportunity:${row.query}`,
      kind: 'opportunity',
      priority: 'P3',
      issue: 'SEO opportunity',
      target: row.query,
      action: opportunityAction(row.position),
      detail: `Position ${position(row.position)}, ${row.impressions} impressions in 28 days, opportunity score ${row.opportunityScore ?? '—'}`,
    });
  }

  for (const check of health.checks) {
    if (check.state !== 'issues') continue;
    if (check.key === 'brokenLinks') {
      for (const issue of check.issues) {
        const visible = issue.note.includes('Google still shows') || issue.note.includes('sitemap');
        candidates.push({
          key: `broken:${issue.url}`,
          kind: 'broken_page',
          priority: 'P1',
          issue: 'Broken page',
          target: issue.url,
          action: visible
            ? 'Redirect it (301) to the page that replaced it, or remove it from the sitemap.'
            : 'Fix or remove the link on the page that links here.',
          detail: issue.note,
        });
      }
      continue;
    }
    const task = TECHNICAL_TASKS[check.key];
    if (!task) continue;
    const examples = check.issues.slice(0, 3).map((issue) => pathOf(issue.url)).join(', ');
    candidates.push({
      key: `technical:${check.key}`,
      kind: `technical_${check.key}`,
      priority: task.priority,
      issue: task.issue(check.count),
      target: health.contentHost,
      action: task.action,
      detail: `For example ${examples}${check.count > 3 ? ` and ${check.count - 3} more` : ''}. The full list is in Technical SEO Health.`,
    });
  }

  return candidates;
}

export interface StoredAction {
  id: string;
  key: string;
  status: ActionStatus;
  resolvedAt: Date | null;
  resolvedBy: 'user' | 'system' | null;
}

/**
 * How stored tasks change for today's candidates: new issues become tasks,
 * issues no longer found are closed by the system, and a done task reopens
 * when its issue is back (at once if the system closed it, after
 * REOPEN_AFTER_DAYS if a person did, since fixes take time to show in data).
 */
export function planActionSync(stored: StoredAction[], candidates: ActionCandidate[], now: Date) {
  const byKey = new Map(stored.map((action) => [action.key, action]));
  const seen = new Set<string>();
  const inserts: ActionCandidate[] = [];
  const updates: Array<{ id: string; candidate: ActionCandidate; reopen: boolean }> = [];

  for (const candidate of candidates) {
    if (seen.has(candidate.key)) continue;
    seen.add(candidate.key);
    const existing = byKey.get(candidate.key);
    if (!existing) {
      inserts.push(candidate);
      continue;
    }
    const personClosedLongAgo =
      existing.resolvedBy === 'user' &&
      existing.resolvedAt !== null &&
      now.getTime() - existing.resolvedAt.getTime() > REOPEN_AFTER_DAYS * DAY_MS;
    const reopen = existing.status === 'done' && (existing.resolvedBy !== 'user' || personClosedLongAgo);
    updates.push({ id: existing.id, candidate, reopen });
  }

  const resolves = stored.filter((action) => !seen.has(action.key) && action.status !== 'done').map((action) => action.id);
  return { inserts, updates, resolves };
}

/** Applies today's candidates to the stored tasks. */
export async function syncActions(db: Db, candidates: ActionCandidate[], now = new Date()) {
  const stored = await db
    .select({
      id: seoActions.id,
      key: seoActions.key,
      status: seoActions.status,
      resolvedAt: seoActions.resolvedAt,
      resolvedBy: seoActions.resolvedBy,
    })
    .from(seoActions);
  const plan = planActionSync(stored, candidates, now);

  await db.transaction(async (tx) => {
    for (const candidate of plan.inserts) {
      await tx.insert(seoActions).values({ ...candidate, status: 'open', firstSeenAt: now, lastSeenAt: now, updatedAt: now });
    }
    for (const { id, candidate, reopen } of plan.updates) {
      const { key: _key, ...fields } = candidate;
      await tx
        .update(seoActions)
        .set({
          ...fields,
          lastSeenAt: now,
          ...(reopen ? { status: 'open' as const, resolvedAt: null, resolvedBy: null, updatedAt: now } : {}),
        })
        .where(eq(seoActions.id, id));
    }
    for (const id of plan.resolves) {
      await tx
        .update(seoActions)
        .set({ status: 'done', resolvedAt: now, resolvedBy: 'system', updatedAt: now })
        .where(eq(seoActions.id, id));
    }
  });

  return {
    candidates: candidates.length,
    created: plan.inserts.length,
    reopened: plan.updates.filter((update) => update.reopen).length,
    resolvedBySystem: plan.resolves.length,
  };
}

type ActionRow = typeof seoActions.$inferSelect;

const toSeoAction = (row: ActionRow): SeoAction => ({
  id: row.id,
  kind: row.kind,
  priority: row.priority,
  issue: row.issue,
  target: row.target,
  action: row.action,
  detail: row.detail,
  status: row.status,
  firstSeenAt: row.firstSeenAt.toISOString(),
  lastSeenAt: row.lastSeenAt.toISOString(),
  resolvedAt: row.resolvedAt?.toISOString() ?? null,
  resolvedBy: row.resolvedBy,
});

const STATUS_ORDER: Record<ActionStatus, number> = { in_progress: 0, open: 1, done: 2 };

/** Open and in-progress tasks, then those done in the last two weeks. */
export async function listSeoActions(db: Db, settings: SeoSettings, now = new Date()): Promise<SeoActionsResponse> {
  const rows = await db
    .select()
    .from(seoActions)
    .where(or(ne(seoActions.status, 'done'), gt(seoActions.resolvedAt, new Date(now.getTime() - DONE_VISIBLE_DAYS * DAY_MS))));
  const actions = rows
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        a.priority.localeCompare(b.priority) ||
        b.lastSeenAt.getTime() - a.lastSeenAt.getTime(),
    )
    .map(toSeoAction);
  return { contentHost: settings.contentHost, actions };
}

/** A person sets a task's status; marking it done records who closed it. */
export async function updateActionStatus(
  db: Db,
  id: string,
  status: ActionStatus,
  userId: string | null,
): Promise<SeoAction | null> {
  const now = new Date();
  const [row] = await db
    .update(seoActions)
    .set({
      status,
      updatedBy: userId,
      updatedAt: now,
      resolvedAt: status === 'done' ? now : null,
      resolvedBy: status === 'done' ? 'user' : null,
    })
    .where(eq(seoActions.id, id))
    .returning();
  return row ? toSeoAction(row) : null;
}
