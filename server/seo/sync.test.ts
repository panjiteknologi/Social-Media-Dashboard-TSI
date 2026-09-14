import { describe, expect, it } from 'vitest';
import { chunkDates, planSync, todayIn } from './sync';

describe('planSync', () => {
  const base = { today: '2026-09-15', dataStartDate: '2026-05-07' };

  it('fetches the full history from the data start date on the first sync', () => {
    expect(planSync({ ...base, lastSyncedDate: null, coveredFrom: null })).toEqual({
      startDate: '2026-05-07',
      endDate: '2026-09-15',
      full: true,
    });
  });

  it('fetches only the last five days again once history is stored', () => {
    expect(planSync({ ...base, lastSyncedDate: '2026-09-12', coveredFrom: '2026-05-07' })).toEqual({
      startDate: '2026-09-08',
      endDate: '2026-09-15',
      full: false,
    });
  });

  it('refetches the full history when the data start date moves earlier', () => {
    expect(
      planSync({ ...base, dataStartDate: '2026-01-01', lastSyncedDate: '2026-09-12', coveredFrom: '2026-05-07' }).full,
    ).toBe(true);
  });

  it('never asks for more history than Search Console keeps', () => {
    expect(
      planSync({ ...base, dataStartDate: '2020-01-01', lastSyncedDate: null, coveredFrom: null }).startDate,
    ).toBe('2025-05-03');
  });
});

describe('chunkDates', () => {
  it('splits a range into consecutive chunks ending on the last day', () => {
    expect(chunkDates('2026-09-01', '2026-09-10', 4)).toEqual([
      { start: '2026-09-01', end: '2026-09-04' },
      { start: '2026-09-05', end: '2026-09-08' },
      { start: '2026-09-09', end: '2026-09-10' },
    ]);
  });
});

describe('todayIn', () => {
  it('uses the calendar date of the given timezone', () => {
    const lateEveningUtc = new Date('2026-09-14T20:00:00Z');
    expect(todayIn('Asia/Jakarta', lateEveningUtc)).toBe('2026-09-15');
    expect(todayIn('UTC', lateEveningUtc)).toBe('2026-09-14');
  });
});
