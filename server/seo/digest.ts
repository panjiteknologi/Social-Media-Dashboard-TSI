import { formatDate, type KeywordRow, type SeoKeywords } from '../../shared/seo';

const DROPPED_STATUSES = new Set<KeywordRow['status']>(['Dropping', 'At Risk']);

/** Priority keywords that dropped, worst first, and those with no search data in the window. */
export function priorityKeywordChanges(
  data: SeoKeywords,
  priorityKeywords: string[],
): { dropped: KeywordRow[]; missing: string[] } {
  const wanted = new Set(priorityKeywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean));
  const found = new Map(
    data.keywords.filter((row) => wanted.has(row.query.toLowerCase())).map((row) => [row.query.toLowerCase(), row]),
  );
  const dropped = [...found.values()]
    .filter((row) => DROPPED_STATUSES.has(row.status))
    .sort((a, b) => (a.movement ?? 0) - (b.movement ?? 0));
  return { dropped, missing: [...wanted].filter((keyword) => !found.has(keyword)) };
}

/**
 * The weekly Telegram message about priority keywords, or null when there is
 * nothing to report: a message only goes out when one of them dropped, so the
 * group does not learn to ignore it.
 */
export function buildPriorityDigest(data: SeoKeywords, priorityKeywords: string[], appBaseUrl: string): string | null {
  if (!data.window || !data.comparable) return null;
  const { dropped, missing } = priorityKeywordChanges(data, priorityKeywords);
  if (dropped.length === 0) return null;

  const lines = [
    `Weekly SEO check: ${dropped.length} priority keyword${dropped.length === 1 ? '' : 's'} dropped`,
    `${formatDate(data.window.start)} – ${formatDate(data.window.end)}, compared with the 28 days before`,
    '',
  ];
  for (const row of dropped) {
    const change = `position ${row.previousPosition?.toFixed(1) ?? '—'} → ${row.position.toFixed(1)}`;
    const leftPageOne = row.status === 'At Risk' ? ', left page 1' : '';
    lines.push(`• ${row.query}: ${change}${leftPageOne} (${row.impressions} impressions)`);
    if (row.landingPage) lines.push(`  ${row.landingPage}`);
  }
  if (missing.length > 0) lines.push('', `No search data this period for: ${missing.join(', ')}`);
  lines.push('', `Details: ${appBaseUrl.replace(/\/$/, '')}/seo`);
  return lines.join('\n');
}
