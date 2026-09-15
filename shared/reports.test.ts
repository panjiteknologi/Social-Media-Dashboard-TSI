import { describe, expect, it } from 'vitest';
import { reportPeriods, reportTitle } from './reports';

describe('reportPeriods', () => {
  it('covers yesterday for the daily report, against the same weekday a week before', () => {
    expect(reportPeriods('daily', '2026-09-15')).toEqual({
      current: { start: '2026-09-14', end: '2026-09-14' },
      previous: { start: '2026-09-07', end: '2026-09-07' },
    });
  });

  it('covers the last full Monday to Sunday week', () => {
    // 15 September 2026 is a Tuesday.
    expect(reportPeriods('weekly', '2026-09-15')).toEqual({
      current: { start: '2026-09-07', end: '2026-09-13' },
      previous: { start: '2026-08-31', end: '2026-09-06' },
    });
    // On a Monday, the week that just ended.
    expect(reportPeriods('weekly', '2026-09-14').current).toEqual({ start: '2026-09-07', end: '2026-09-13' });
    // On a Sunday, the week before, which is complete.
    expect(reportPeriods('weekly', '2026-09-13').current).toEqual({ start: '2026-08-31', end: '2026-09-06' });
  });

  it('covers the last full calendar month, across a year boundary too', () => {
    expect(reportPeriods('monthly', '2026-09-01')).toEqual({
      current: { start: '2026-08-01', end: '2026-08-31' },
      previous: { start: '2026-07-01', end: '2026-07-31' },
    });
    expect(reportPeriods('monthly', '2027-01-15')).toEqual({
      current: { start: '2026-12-01', end: '2026-12-31' },
      previous: { start: '2026-11-01', end: '2026-11-30' },
    });
  });
});

describe('reportTitle', () => {
  it('names the period', () => {
    expect(reportTitle('daily', { start: '2026-09-14', end: '2026-09-14' })).toBe('Daily report, 14 Sep 2026');
    expect(reportTitle('weekly', { start: '2026-09-07', end: '2026-09-13' })).toBe('Weekly report, 7 Sep – 13 Sep 2026');
    expect(reportTitle('monthly', { start: '2026-08-01', end: '2026-08-31' })).toBe('Monthly report, August 2026');
  });
});
