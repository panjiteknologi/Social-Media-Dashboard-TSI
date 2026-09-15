import { describe, expect, it } from 'vitest';
import { describeSchedule, formatSchedule, parseSchedule } from './automation';

describe('parseSchedule and formatSchedule', () => {
  it('round-trips every schedule the app ships with', () => {
    for (const cron of ['10 * * * *', '0 7 * * *', '30 7 * * *', '45 7 * * *', '0 8 * * *', '15 8 * * 1', '0 2 * * 0', '30 8 1 * *']) {
      const shape = parseSchedule(cron);
      expect(shape).not.toBeNull();
      expect(formatSchedule(shape!)).toBe(cron);
    }
  });

  it('recognises each kind', () => {
    expect(parseSchedule('10 * * * *')).toEqual({ kind: 'hourly', minute: 10 });
    expect(parseSchedule('15 8 * * 1')).toEqual({ kind: 'weekly', weekday: 1, hour: 8, minute: 15 });
    expect(parseSchedule('30 8 1 * *')).toEqual({ kind: 'monthly', day: 1, hour: 8, minute: 30 });
  });

  it('rejects patterns the settings screen cannot edit', () => {
    for (const cron of ['*/5 * * * *', '0 8 31 * *', '0 24 * * *', '0 8 * 1 *', '0 8 1 * 1', '0 8 * * 1-5', '0 8 * *', '']) {
      expect(parseSchedule(cron)).toBeNull();
    }
  });
});

describe('describeSchedule', () => {
  it('reads like a sentence', () => {
    expect(describeSchedule({ kind: 'hourly', minute: 5 })).toBe('Every hour at minute 05');
    expect(describeSchedule({ kind: 'daily', hour: 8, minute: 0 })).toBe('Every day at 08:00');
    expect(describeSchedule({ kind: 'weekly', weekday: 1, hour: 8, minute: 15 })).toBe('Every Monday at 08:15');
    expect(describeSchedule({ kind: 'monthly', day: 1, hour: 8, minute: 30 })).toBe('On day 1 of every month at 08:30');
  });
});
