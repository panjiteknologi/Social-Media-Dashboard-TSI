import { desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  AI_TASKS,
  aiTaskBlocker,
  qaVerdict,
  QA_VERDICT_LABELS,
  type AiTask,
  type AiTaskStatus,
  type ArticleDraft,
  type ContentBrief,
  type QaResult,
} from '../../shared/aiContent';
import type { BrandKnowledge } from '../../shared/brand';
import type { ContentStage } from '../../shared/planner';
import { standardOf, type KeywordRow } from '../../shared/seo';
import type { AiGateway, AiResult } from '../ai/gateway';
import { getBrandKnowledge } from '../brand/settings';
import type { Db } from '../db/client';
import { articles, contentEvents, contentItems, topicRecommendations } from '../db/schema';
import { buildReviewMessage } from '../notify/approvals';
import { getKeywords } from '../seo/metrics';
import { getSeoSettings } from '../seo/settings';
import { draftSeoChecks, findFlaggedPhrases } from './checks';
import { AiReplyError, parseBrief, parseDraft, parseReview, parseTopics } from './parse';
import {
  buildBriefMessages,
  buildDraftMessages,
  buildReviewMessages,
  buildRevisionMessages,
  buildTopicMessages,
  type KnownArticle,
} from './prompts';

export interface ContentAiDeps {
  db: Db;
  ai: AiGateway;
  /** Tells the team something reached the Approval Queue; left out in tests. */
  notify?: (text: string) => Promise<void>;
  appBaseUrl?: string;
}

/** Most recommendations kept per run: a short list the team actually reads. */
export const MAX_TOPICS = 8;

/** Opportunity keywords sent to the model, best first. */
const MAX_OPPORTUNITIES = 40;

const errorText = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const costNote = (result: AiResult): string => `${result.model}, $${result.usage.costUsd.toFixed(3)}`;

/**
 * Longest reply per task. Indonesian runs about two characters per token: a
 * detailed brief took 5,500 tokens on 16 September, so 4,000 cut it off.
 */
const MAX_TOKENS = { topics: 6000, brief: 10_000, draft: 16_000, qa: 8000 } as const;

/** Fails a reply that stopped at its limit: its JSON or HTML is incomplete. */
function assertComplete(result: AiResult, what: string, limit: number): void {
  if (result.finishReason === 'length') {
    throw new AiReplyError(
      `The ${what} reached the ${limit.toLocaleString('en-US')}-token reply limit and was cut off, so nothing was saved.`,
    );
  }
}

/** Published articles with their public URLs, newest first. */
export async function knownArticles(db: Db, host: string): Promise<KnownArticle[]> {
  const rows = await db
    .select({ slug: articles.slug, title: articles.title, focusKeyword: articles.seoFocusKeyword })
    .from(articles)
    .where(eq(articles.status, 'publish'))
    .orderBy(desc(articles.publishedAt));
  return rows.map((row) => ({ url: `https://${host}/blog/${row.slug}/`, title: row.title, focusKeyword: row.focusKeyword }));
}

const searchData = (row: KeywordRow) => ({
  query: row.query,
  clicks: row.clicks,
  impressions: row.impressions,
  position: Math.round(row.position * 10) / 10,
});

// ---------------------------------------------------------------------------
// Topic recommendations

export async function runTopicRecommendations({ db, ai }: ContentAiDeps) {
  if (!ai.configured) return { created: 0, reason: 'OPENROUTER_API_KEY is not set.' };

  const [settings, brand] = await Promise.all([getSeoSettings(db), getBrandKnowledge(db)]);
  const keywords = await getKeywords(db, settings);
  const opportunities = keywords.opportunities.slice(0, MAX_OPPORTUNITIES);
  if (opportunities.length === 0) {
    return { created: 0, reason: 'Search Console shows no opportunity keywords yet.' };
  }

  const [articleList, planned, dismissed] = await Promise.all([
    knownArticles(db, settings.contentHost),
    db.select({ title: contentItems.title, keyword: contentItems.keyword }).from(contentItems),
    db
      .select({ keyword: topicRecommendations.keyword })
      .from(topicRecommendations)
      .where(eq(topicRecommendations.status, 'dismissed')),
  ]);
  const plannedKeys = new Set(
    planned.flatMap((item) => [item.title.toLowerCase(), ...(item.keyword ? [item.keyword.toLowerCase()] : [])]),
  );
  const dismissedKeys = new Set(dismissed.map((row) => row.keyword.toLowerCase()));

  const result = await ai.complete(
    'strategy',
    buildTopicMessages(brand, {
      window: keywords.window,
      opportunities: opportunities.map((row) => ({
        ...searchData(row),
        opportunityScore: row.opportunityScore,
        cluster: row.cluster,
        landingPage: row.landingPage,
      })),
      articles: articleList,
      planned: [...plannedKeys],
      dismissed: [...dismissedKeys],
      maxTopics: MAX_TOPICS,
    }),
    { maxTokens: MAX_TOKENS.topics },
  );
  assertComplete(result, 'topic list', MAX_TOKENS.topics);

  // The model only chooses and words topics; keywords, numbers and URLs must come from the data.
  const byKeyword = new Map(opportunities.map((row) => [row.query.toLowerCase(), row]));
  const urls = new Set(articleList.map((article) => article.url));
  const seen = new Set<string>();
  const proposed = parseTopics(result.text);
  const topics = proposed
    .flatMap((topic) => {
      const key = topic.keyword.toLowerCase();
      const data = byKeyword.get(key);
      if (!data || seen.has(key) || plannedKeys.has(key) || dismissedKeys.has(key)) return [];
      seen.add(key);
      const existingUrl = topic.existingUrl && urls.has(topic.existingUrl) ? topic.existingUrl : null;
      const action = topic.action === 'update_article' && existingUrl ? 'update_article' : 'new_article';
      return [
        {
          keyword: data.query,
          title: topic.title,
          intent: topic.intent,
          action,
          existingUrl: action === 'update_article' ? existingUrl : null,
          angle: topic.angle,
          reason: topic.reason,
          cluster: data.cluster,
          impressions: data.impressions,
          position: data.position,
          opportunityScore: data.opportunityScore,
          status: 'new',
          model: result.model,
        } as const,
      ];
    })
    .slice(0, MAX_TOPICS);

  if (topics.length === 0) {
    return {
      created: 0,
      proposed: proposed.length,
      reason: 'None of the topics the AI proposed matched an open opportunity keyword. The previous recommendations are kept.',
      costUsd: result.usage.costUsd,
    };
  }

  // Recommendations nobody acted on are replaced; planned and dismissed ones stay as history.
  await db.transaction(async (tx) => {
    await tx.delete(topicRecommendations).where(eq(topicRecommendations.status, 'new'));
    await tx.insert(topicRecommendations).values(topics);
  });
  return {
    created: topics.length,
    proposed: proposed.length,
    keywords: topics.map((topic) => topic.keyword),
    model: result.model,
    costUsd: result.usage.costUsd,
  };
}

// ---------------------------------------------------------------------------
// Brief, draft and QA for one content item

export const ContentTaskInput = z.object({
  itemId: z.uuid(),
  task: z.enum(AI_TASKS),
  /** Who asked, for the content history. */
  userId: z.uuid().nullable().default(null),
  /** The approver's request, for a revision. */
  note: z.string().max(5000).nullable().default(null),
});

type ItemRow = typeof contentItems.$inferSelect;

/** Stages the AI moves forward from; content further along stays where a person put it. */
const BRIEF_FROM: readonly ContentStage[] = ['idea', 'researching'];
const REVIEW_FROM: readonly ContentStage[] = ['idea', 'researching', 'brief_ready', 'drafting'];

async function setTaskState(db: Db, itemId: string, task: AiTask, status: AiTaskStatus | null, error: string | null) {
  await db
    .update(contentItems)
    .set({ aiTask: task, aiStatus: status, aiError: error, aiUpdatedAt: new Date() })
    .where(eq(contentItems.id, itemId));
}

/** Saves a finished task's output, its history note and any stage move in one go; true when the stage moved. */
async function finishTask(
  db: Db,
  item: ItemRow,
  task: AiTask,
  output: Partial<Pick<ItemRow, 'brief' | 'draft' | 'qa'>>,
  note: string,
  userId: string | null,
  moveFrom: readonly ContentStage[],
  moveTo: ContentStage | null,
): Promise<boolean> {
  const moves = moveTo !== null && moveFrom.includes(item.stage);
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(contentItems)
      .set({
        ...output,
        ...(moves ? { stage: moveTo } : {}),
        aiTask: task,
        aiStatus: null,
        aiError: null,
        aiUpdatedAt: now,
        updatedAt: now,
      })
      .where(eq(contentItems.id, item.id));
    await tx.insert(contentEvents).values({ itemId: item.id, kind: 'ai', note, userId });
    if (moves) {
      await tx
        .insert(contentEvents)
        .values({ itemId: item.id, kind: 'stage_changed', fromStage: item.stage, toStage: moveTo, userId });
    }
  });
  return moves;
}

/** Tells the team on Telegram that content is waiting for approval. A failed message must not fail the task. */
async function notifyReview(deps: ContentAiDeps, item: ItemRow, qa: QaResult): Promise<void> {
  if (!deps.notify) return;
  try {
    await deps.notify(buildReviewMessage(item, qa, deps.appBaseUrl ?? ''));
  } catch (error) {
    console.error('[contentAi] Could not send the approval notification:', errorText(error));
  }
}

/** Share of a keyword's words found in a search query, 0–1. */
function overlap(words: string[], query: string): number {
  if (words.length === 0) return 0;
  const queryWords = new Set(query.toLowerCase().split(/\s+/));
  return words.filter((word) => queryWords.has(word)).length / words.length;
}

/** The brief prompt for an item, with the brand settings and the articles its links are checked against. */
export async function prepareBrief(db: Db, item: ItemRow) {
  const [settings, brand] = await Promise.all([getSeoSettings(db), getBrandKnowledge(db)]);
  const [keywords, articleList] = await Promise.all([getKeywords(db, settings), knownArticles(db, settings.contentHost)]);

  const focus = item.keyword ?? item.title;
  const words = focus.toLowerCase().split(/\s+/).filter((word) => word.length > 1);
  const standard = standardOf(focus);
  const queries = keywords.keywords
    .filter((row) => !row.isBrand)
    .filter((row) => overlap(words, row.query) >= 0.5 || (standard !== null && row.cluster === standard))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25)
    .map(searchData);

  const sameTopic = (article: KnownArticle) =>
    standard !== null && standardOf(`${article.title} ${article.focusKeyword ?? ''}`) === standard;
  const linkable = [...articleList.filter(sameTopic), ...articleList.filter((article) => !sameTopic(article))].slice(0, 40);

  const messages = buildBriefMessages(brand, {
    item: { title: item.title, keyword: item.keyword, campaign: item.campaign, notes: item.notes },
    search: { window: keywords.window, queries },
    articles: linkable,
  });
  return { brand, articleList, messages };
}

async function writeBrief({ db, ai }: ContentAiDeps, item: ItemRow, userId: string | null) {
  const { brand, articleList, messages } = await prepareBrief(db, item);
  const result = await ai.complete('strategy', messages, { maxTokens: MAX_TOKENS.brief });
  assertComplete(result, 'brief', MAX_TOKENS.brief);
  const brief = parseBrief(result.text, {
    knownUrls: new Map(articleList.map((article) => [article.url, article.title])),
    wordTarget: { min: brand.ai.minWords, max: brand.ai.maxWords },
  });

  await finishTask(db, item, 'brief', { brief }, `AI wrote the brief (${costNote(result)})`, userId, BRIEF_FROM, 'brief_ready');
  return { task: 'brief', sections: brief.outline.length, internalLinks: brief.internalLinks.length, costUsd: result.usage.costUsd };
}

/** The QA check: the SEO checklist and forbidden wording by rule, then the AI review. */
async function checkDraft(
  ai: AiGateway,
  brand: BrandKnowledge,
  brief: ContentBrief | null,
  draft: ArticleDraft,
  host: string,
): Promise<{ qa: QaResult; note: string; costUsd: number }> {
  const seo = draftSeoChecks(draft, brand.ai, host);
  const flaggedPhrases = findFlaggedPhrases(draft.html);

  let review: QaResult['review'] = null;
  let reviewNote: string | null = null;
  let cost = '';
  let costUsd = 0;
  if (!ai.configured) {
    reviewNote = 'No AI review: OPENROUTER_API_KEY is not set.';
  } else {
    // The rule checks stand on their own; a failed review leaves a note for the approver instead of failing QA.
    try {
      const result = await ai.complete('qa', buildReviewMessages(brand, { brief, draft }), { maxTokens: MAX_TOKENS.qa });
      costUsd = result.usage.costUsd;
      cost = ` (${costNote(result)})`;
      assertComplete(result, 'QA review', MAX_TOKENS.qa);
      review = parseReview(result.text, result.model);
    } catch (error) {
      reviewNote = `No AI review: ${errorText(error)}`;
    }
  }

  const qa: QaResult = { checkedAt: new Date().toISOString(), seo, flaggedPhrases, review, reviewNote };
  const scores = review ? `SEO ${seo.score}, brand ${review.brandScore}, impartiality ${review.impartiality}` : `SEO ${seo.score}, ${reviewNote}`;
  return { qa, note: `QA: ${QA_VERDICT_LABELS[qaVerdict(qa)]}. ${scores}${cost}`, costUsd };
}

async function writeDraft(deps: ContentAiDeps, item: ItemRow, userId: string | null) {
  const { db, ai } = deps;
  const [settings, brand] = await Promise.all([getSeoSettings(db), getBrandKnowledge(db)]);
  const brief = item.brief!;
  const contactPath = brand.ai.language === 'id' ? '/id/contact-us/' : '/contact-us/';

  const result = await ai.complete(
    'article',
    buildDraftMessages(brand, { brief, notes: item.notes, contactUrl: `https://${settings.contentHost}${contactPath}` }),
    // 1,500 Indonesian words of HTML with an FAQ is roughly 6,000–8,000 tokens; the margin covers longer settings.
    { maxTokens: MAX_TOKENS.draft },
  );
  assertComplete(result, 'draft', MAX_TOKENS.draft);
  const draft: ArticleDraft = { ...parseDraft(result.text), model: result.model, writtenAt: new Date().toISOString() };

  // The draft is saved before QA, so a problem in QA never loses a paid draft.
  await db
    .update(contentItems)
    .set({ draft, qa: null, aiTask: 'qa', aiStatus: 'running', aiUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(contentItems.id, item.id));
  await db
    .insert(contentEvents)
    .values({ itemId: item.id, kind: 'ai', note: `AI wrote the draft: ${draft.wordCount} words (${costNote(result)})`, userId });

  const checked = await checkDraft(ai, brand, brief, draft, settings.contentHost);
  const moved = await finishTask(db, { ...item, draft }, 'qa', { qa: checked.qa }, checked.note, userId, REVIEW_FROM, 'review');
  if (moved) await notifyReview(deps, { ...item, draft }, checked.qa);
  return {
    task: 'draft',
    words: draft.wordCount,
    verdict: qaVerdict(checked.qa),
    costUsd: result.usage.costUsd + checked.costUsd,
  };
}

/** Rewrites the draft after an approver sent it back, then checks and returns it to Review. */
async function reviseDraft(deps: ContentAiDeps, item: ItemRow, userId: string | null, note: string | null) {
  const { db, ai } = deps;
  const [settings, brand] = await Promise.all([getSeoSettings(db), getBrandKnowledge(db)]);
  const contactPath = brand.ai.language === 'id' ? '/id/contact-us/' : '/contact-us/';

  const result = await ai.complete(
    'article',
    buildRevisionMessages(brand, {
      brief: item.brief,
      draft: item.draft!,
      qa: item.qa,
      note: note?.trim() || 'No request was written down; fix the QA issues.',
      contactUrl: `https://${settings.contentHost}${contactPath}`,
    }),
    { maxTokens: MAX_TOKENS.draft },
  );
  assertComplete(result, 'revision', MAX_TOKENS.draft);
  const draft: ArticleDraft = { ...parseDraft(result.text), model: result.model, writtenAt: new Date().toISOString() };

  await db
    .update(contentItems)
    .set({ draft, qa: null, aiTask: 'qa', aiStatus: 'running', aiUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(contentItems.id, item.id));
  await db
    .insert(contentEvents)
    .values({ itemId: item.id, kind: 'ai', note: `AI revised the draft: ${draft.wordCount} words (${costNote(result)})`, userId });

  const checked = await checkDraft(ai, brand, item.brief, draft, settings.contentHost);
  const moved = await finishTask(db, { ...item, draft }, 'qa', { qa: checked.qa }, checked.note, userId, REVIEW_FROM, 'review');
  if (moved) await notifyReview(deps, { ...item, draft }, checked.qa);
  return {
    task: 'revise',
    words: draft.wordCount,
    verdict: qaVerdict(checked.qa),
    costUsd: result.usage.costUsd + checked.costUsd,
  };
}

async function recheckDraft({ db, ai }: ContentAiDeps, item: ItemRow, userId: string | null) {
  const [settings, brand] = await Promise.all([getSeoSettings(db), getBrandKnowledge(db)]);
  const checked = await checkDraft(ai, brand, item.brief, item.draft!, settings.contentHost);
  await finishTask(db, item, 'qa', { qa: checked.qa }, checked.note, userId, [], null);
  return { task: 'qa', verdict: qaVerdict(checked.qa), costUsd: checked.costUsd };
}

/** Runs one AI writer task. A failure is saved on the item, so the planner shows it, and rethrown for the retry. */
export async function runContentTask(deps: ContentAiDeps, rawInput: unknown) {
  const { itemId, task, userId, note } = ContentTaskInput.parse(rawInput);
  const { db, ai } = deps;
  const [item] = await db.select().from(contentItems).where(eq(contentItems.id, itemId)).limit(1);
  if (!item) return { skipped: true, reason: 'The content item was deleted.' };

  const blocker =
    aiTaskBlocker(task, { type: item.type, hasBrief: item.brief !== null, hasDraft: item.draft !== null }) ??
    // QA runs its rule checks without a key; brief and draft need the model.
    (!ai.configured && task !== 'qa' ? 'OPENROUTER_API_KEY is not set.' : null);
  if (blocker) {
    await setTaskState(db, itemId, task, 'failed', blocker);
    return { skipped: true, reason: blocker };
  }

  await setTaskState(db, itemId, task, 'running', null);
  try {
    if (task === 'brief') return await writeBrief(deps, item, userId);
    if (task === 'draft') return await writeDraft(deps, item, userId);
    if (task === 'revise') return await reviseDraft(deps, item, userId, note);
    return await recheckDraft(deps, item, userId);
  } catch (error) {
    await setTaskState(db, itemId, task, 'failed', errorText(error));
    throw error;
  }
}
