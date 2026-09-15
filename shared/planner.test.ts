import { describe, expect, it } from 'vitest';
import { canMoveToStage, contentSummary, weekStart, type ContentItem } from './planner';

const item = (overrides: Partial<ContentItem>): ContentItem => ({
  id: overrides.title ?? 'id',
  title: 'Item',
  type: 'article',
  stage: 'idea',
  keyword: null,
  campaign: null,
  priority: 'medium',
  dueDate: null,
  ownerId: null,
  notes: null,
  cluster: null,
  ownerName: null,
  createdAt: '2026-09-15T00:00:00Z',
  updatedAt: '2026-09-15T00:00:00Z',
  ...overrides,
});

describe('weekStart', () => {
  it('finds the Monday of the week', () => {
    expect(weekStart('2026-09-15')).toBe('2026-09-14');
    expect(weekStart('2026-09-14')).toBe('2026-09-14');
    expect(weekStart('2026-09-20')).toBe('2026-09-14');
  });
});

describe('canMoveToStage', () => {
  it('keeps Approved for approvers and admins', () => {
    expect(canMoveToStage('editor', 'approved')).toBe(false);
    expect(canMoveToStage('approver', 'approved')).toBe(true);
    expect(canMoveToStage('admin', 'approved')).toBe(true);
    expect(canMoveToStage('editor', 'review')).toBe(true);
  });
});

describe('contentSummary', () => {
  const items = [
    item({ title: 'scheduled soon', stage: 'scheduled', dueDate: '2026-09-20' }),
    item({ title: 'scheduled later', stage: 'scheduled', dueDate: '2026-09-29' }),
    item({ title: 'in review', stage: 'review', dueDate: '2026-09-16' }),
    item({ title: 'overdue', stage: 'drafting', dueDate: '2026-09-10' }),
    item({ title: 'published', stage: 'published', dueDate: '2026-09-17' }),
    item({ title: 'idea without date', stage: 'idea' }),
  ];

  it('counts scheduled content in the next 14 days and content in review', () => {
    const summary = contentSummary(items, '2026-09-15');
    expect(summary.scheduledSoon).toBe(1);
    expect(summary.inReview).toBe(1);
  });

  it('lists the next unpublished items by due date', () => {
    expect(contentSummary(items, '2026-09-15').upcoming.map((entry) => entry.title)).toEqual([
      'in review',
      'scheduled soon',
      'scheduled later',
    ]);
  });
});
