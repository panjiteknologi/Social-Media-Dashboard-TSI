/**
 * Keeping the same article from being written twice.
 *
 * On 17 September the AI recommended a topic, wrote it, and it turned out the
 * same article was already on the website: an earlier Content Machine draft the
 * team had pasted into the CMS by hand. Instructions in the prompt were not
 * enough, so both the topic list and the publishing step now check the real
 * articles themselves.
 */

/** Lowercase words only, so punctuation, casing and accents cannot hide a match. */
export function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export interface ArticleLike {
  id?: number;
  title: string;
  slug?: string | null;
  focusKeyword?: string | null;
  status?: string | null;
}

/**
 * The article that already answers this search, if there is one: it either
 * targets the keyword outright, or its title opens with it. A keyword that only
 * appears somewhere inside a longer title is not covered, since a more specific
 * article can still be worth writing.
 */
export function keywordCovered(articles: readonly ArticleLike[], keyword: string): ArticleLike | null {
  const wanted = normalizeText(keyword);
  if (!wanted) return null;
  return (
    articles.find((article) => {
      if (article.focusKeyword && normalizeText(article.focusKeyword) === wanted) return true;
      const title = normalizeText(article.title);
      return title === wanted || title.startsWith(`${wanted} `);
    }) ?? null
  );
}

/** An article that is effectively this one already, other than the row this content owns. */
export function findDuplicate(
  articles: readonly ArticleLike[],
  target: { title: string; slug: string; ownPostId: number | null },
): ArticleLike | null {
  const wantedTitle = normalizeText(target.title);
  const wantedSlug = normalizeText(target.slug);
  return (
    articles.find((article) => {
      if (target.ownPostId !== null && article.id === target.ownPostId) return false;
      if (normalizeText(article.title) === wantedTitle) return true;
      return Boolean(article.slug) && normalizeText(article.slug ?? '') === wantedSlug;
    }) ?? null
  );
}

/** Raised instead of writing a second copy of an article the CMS already holds. */
export class DuplicateArticleError extends Error {
  constructor(readonly existing: ArticleLike) {
    const where = existing.slug ? `/blog/${existing.slug}/` : `id ${existing.id}`;
    super(
      `The CMS already holds this article: "${existing.title}" (${existing.status ?? 'unknown status'}, ${where}). ` +
        'Update that one instead, or send this anyway if it is deliberately a second version.',
    );
    this.name = 'DuplicateArticleError';
  }
}
