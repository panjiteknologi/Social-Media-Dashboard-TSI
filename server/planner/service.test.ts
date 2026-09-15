import { describe, expect, it } from 'vitest';
import type { ContentInput } from '../../shared/planner';
import { changedFields, ContentInputSchema } from './service';

const input: ContentInput = {
  title: 'ISO 9001 checklist',
  type: 'article',
  stage: 'idea',
  keyword: 'iso 9001',
  campaign: null,
  priority: 'medium',
  dueDate: '2026-09-30',
  ownerId: null,
  notes: null,
};

describe('changedFields', () => {
  it('names the changed fields, leaving the stage to its own history entry', () => {
    expect(changedFields(input, { ...input, stage: 'drafting', title: 'ISO 9001 audit checklist', dueDate: null })).toEqual([
      'title',
      'due date',
    ]);
    expect(changedFields(input, { ...input })).toEqual([]);
  });
});

describe('ContentInputSchema', () => {
  it('turns blank optional text into null and trims the title', () => {
    const parsed = ContentInputSchema.parse({ ...input, title: '  Checklist  ', keyword: '   ', notes: '' });
    expect(parsed).toMatchObject({ title: 'Checklist', keyword: null, notes: null });
  });

  it('rejects a missing title, an unknown stage and a malformed date', () => {
    expect(ContentInputSchema.safeParse({ ...input, title: ' ' }).success).toBe(false);
    expect(ContentInputSchema.safeParse({ ...input, stage: 'live' }).success).toBe(false);
    expect(ContentInputSchema.safeParse({ ...input, dueDate: '30/09/2026' }).success).toBe(false);
  });
});
