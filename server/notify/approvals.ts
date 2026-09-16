import { qaVerdict, QA_VERDICT_LABELS, type QaResult } from '../../shared/aiContent';
import { DECISION_LABELS, type Decision } from '../../shared/approvals';
import { CONTENT_TYPE_LABELS, type ContentType } from '../../shared/planner';

const approvalLink = (appBaseUrl: string): string => `${appBaseUrl.replace(/\/$/, '')}/approval`;

/** Telegram message when content reaches Review and needs an approver. */
export function buildReviewMessage(
  item: { title: string; type: ContentType },
  qa: QaResult | null,
  appBaseUrl: string,
): string {
  const lines = [`Waiting for approval: ${item.title}`, CONTENT_TYPE_LABELS[item.type]];
  if (qa) {
    const review = qa.review;
    lines.push(
      `QA: ${QA_VERDICT_LABELS[qaVerdict(qa)]} · SEO ${qa.seo.score}${review ? ` · brand ${review.brandScore} · impartiality ${review.impartiality}` : ''}`,
    );
    const problems = (review?.issues.length ?? 0) + qa.flaggedPhrases.length;
    if (problems > 0) lines.push(`${problems} thing${problems === 1 ? '' : 's'} to check before publishing.`);
    if (!review && qa.reviewNote) lines.push(qa.reviewNote);
  }
  lines.push('', approvalLink(appBaseUrl));
  return lines.join('\n');
}

/** Telegram message after an approver decides. */
export function buildDecisionMessage(
  item: { title: string },
  decision: Decision,
  note: string,
  by: string,
  appBaseUrl: string,
  aiRevising: boolean,
): string {
  const lines = [`${DECISION_LABELS[decision]}: ${item.title}`, `By ${by}`];
  if (note.trim()) lines.push('', note.trim());
  if (aiRevising) lines.push('', 'The AI is writing the revision now.');
  lines.push('', approvalLink(appBaseUrl));
  return lines.join('\n');
}
