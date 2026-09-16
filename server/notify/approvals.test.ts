import { describe, expect, it } from 'vitest';
import type { QaResult } from '../../shared/aiContent';
import { buildDecisionMessage, buildReviewMessage } from './approvals';

const qa: QaResult = {
  checkedAt: '2026-09-16T01:00:00Z',
  seo: { score: 91, checks: [] },
  flaggedPhrases: [{ phrase: 'terbaik', rule: 'No unproven superlatives', context: '…' }],
  review: {
    model: 'anthropic/claude-sonnet-5',
    brandScore: 90,
    impartiality: 'pass',
    summary: 'Good.',
    issues: [{ severity: 'medium', category: 'accuracy', quote: 'x', problem: 'y', fix: 'z' }],
  },
  reviewNote: null,
};

const item = { title: 'Sertifikasi ISO', type: 'article' as const };

describe('buildReviewMessage', () => {
  it('names the article, its QA verdict and how much needs checking', () => {
    const message = buildReviewMessage(item, qa, 'https://cm.example.com/');
    expect(message).toContain('Waiting for approval: Sertifikasi ISO');
    expect(message).toContain('QA: Needs attention · SEO 91 · brand 90 · impartiality pass');
    expect(message).toContain('2 things to check before publishing.');
    expect(message.endsWith('https://cm.example.com/approval')).toBe(true);
  });

  it('says when there was no AI review, and works without QA at all', () => {
    expect(buildReviewMessage(item, { ...qa, review: null, reviewNote: 'No AI review: no key.' }, 'https://cm.example.com')).toContain(
      'No AI review: no key.',
    );
    expect(buildReviewMessage(item, null, 'https://cm.example.com')).toContain('Waiting for approval');
  });
});

describe('buildDecisionMessage', () => {
  it('carries the decision, who made it and their words', () => {
    const message = buildDecisionMessage(item, 'revise', 'Perbaiki CTA', 'Rizky', 'https://cm.example.com', true);
    expect(message).toContain('Revision requested: Sertifikasi ISO');
    expect(message).toContain('By Rizky');
    expect(message).toContain('Perbaiki CTA');
    expect(message).toContain('The AI is writing the revision now.');
  });

  it('leaves out an empty note and the AI line', () => {
    const message = buildDecisionMessage(item, 'approve', '   ', 'Rizky', 'https://cm.example.com', false);
    expect(message).not.toContain('The AI is writing');
    expect(message.split('\n').filter(Boolean)).toEqual([
      'Approved: Sertifikasi ISO',
      'By Rizky',
      'https://cm.example.com/approval',
    ]);
  });
});
