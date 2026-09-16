/** The Approval Queue: what an approver may decide about content waiting in Review. */
import type { ContentStage } from './planner';

export const DECISIONS = ['approve', 'revise', 'reject'] as const;

export type Decision = (typeof DECISIONS)[number];

export const DECISION_LABELS: Record<Decision, string> = {
  approve: 'Approved',
  revise: 'Revision requested',
  reject: 'Rejected',
};

/** Where each decision sends the content. */
export const DECISION_STAGE: Record<Decision, ContentStage> = {
  approve: 'approved',
  revise: 'drafting',
  reject: 'rejected',
};

/** Only content waiting in Review can be decided. */
export const canDecide = (stage: ContentStage): boolean => stage === 'review';

/** Approving needs no words; sending something back does. */
export const decisionNeedsNote = (decision: Decision): boolean => decision !== 'approve';

export interface DecisionInput {
  decision: Decision;
  /** Why, in the approver's words. Required for revise and reject. */
  note: string;
  /** For revise: let the AI rewrite the draft from the note and the QA issues. */
  useAi: boolean;
}

/** Why a decision cannot be made, or null when it can. */
export function decisionBlocker(
  item: { stage: ContentStage; hasDraft: boolean },
  input: DecisionInput,
): string | null {
  if (!canDecide(item.stage)) return 'Only content waiting in Review can be decided.';
  if (decisionNeedsNote(input.decision) && input.note.trim() === '') {
    return input.decision === 'revise'
      ? 'Say what needs changing, so the writer or the AI can act on it.'
      : 'Say why it is rejected, so the history explains itself.';
  }
  if (input.decision === 'revise' && input.useAi && !item.hasDraft) {
    return 'There is no AI draft to revise. Ask for the change without the AI.';
  }
  return null;
}
