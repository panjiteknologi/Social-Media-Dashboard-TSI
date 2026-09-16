import { describe, expect, it } from 'vitest';
import { canDecide, DECISION_STAGE, decisionBlocker, decisionNeedsNote } from './approvals';

const item = { stage: 'review' as const, hasDraft: true };
const input = { decision: 'approve' as const, note: '', useAi: true };

describe('decisionBlocker', () => {
  it('approves without a note', () => {
    expect(decisionBlocker(item, input)).toBeNull();
  });

  it('asks for a reason before sending something back', () => {
    expect(decisionBlocker(item, { ...input, decision: 'revise' })).toBe(
      'Say what needs changing, so the writer or the AI can act on it.',
    );
    expect(decisionBlocker(item, { ...input, decision: 'reject' })).toBe(
      'Say why it is rejected, so the history explains itself.',
    );
    expect(decisionBlocker(item, { ...input, decision: 'revise', note: '  Tambah contoh  ' })).toBeNull();
  });

  it('refuses a decision on content that is not in Review', () => {
    expect(decisionBlocker({ ...item, stage: 'approved' }, input)).toBe(
      'Only content waiting in Review can be decided.',
    );
  });

  it('cannot ask the AI to revise what it never wrote', () => {
    const revise = { ...input, decision: 'revise' as const, note: 'Perbaiki CTA' };
    expect(decisionBlocker({ ...item, hasDraft: false }, revise)).toBe(
      'There is no AI draft to revise. Ask for the change without the AI.',
    );
    expect(decisionBlocker({ ...item, hasDraft: false }, { ...revise, useAi: false })).toBeNull();
  });
});

describe('decision rules', () => {
  it('sends each decision to its stage', () => {
    expect(DECISION_STAGE).toEqual({ approve: 'approved', revise: 'drafting', reject: 'rejected' });
    expect(canDecide('review')).toBe(true);
    expect(canDecide('drafting')).toBe(false);
    expect(decisionNeedsNote('approve')).toBe(false);
    expect(decisionNeedsNote('reject')).toBe(true);
  });
});
