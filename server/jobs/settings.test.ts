import { describe, expect, it } from 'vitest';
import type { JobDefinition } from './job';
import { applyOverrides } from './settings';

const job = (name: string, schedule?: string): JobDefinition => ({
  name,
  description: name,
  retryLimit: 2,
  retryDelaySeconds: 60,
  schedule,
  manual: true,
  run: async () => null,
});

describe('applyOverrides', () => {
  const jobs = [job('report-daily', '0 8 * * *'), job('report-weekly', '15 8 * * 1'), job('system-selftest')];

  it('keeps the defaults when nothing was saved', () => {
    const [daily, , selftest] = applyOverrides(jobs, {});
    expect(daily).toMatchObject({ schedule: '0 8 * * *', retryLimit: 2, enabled: true });
    expect(selftest).toMatchObject({ schedule: undefined, enabled: true });
  });

  it('applies saved schedules, switches and retry limits', () => {
    const [daily, weekly] = applyOverrides(jobs, {
      'report-daily': { schedule: '30 7 * * *', retryLimit: 4 },
      'report-weekly': { enabled: false },
    });
    expect(daily).toMatchObject({ schedule: '30 7 * * *', retryLimit: 4, enabled: true });
    expect(weekly).toMatchObject({ schedule: '15 8 * * 1', enabled: false });
  });

  it('ignores a saved schedule of a different shape than the default', () => {
    const [daily, weekly] = applyOverrides(jobs, {
      'report-daily': { schedule: '0 * * * *' },
      'report-weekly': { schedule: 'not cron' },
    });
    expect(daily.schedule).toBe('0 8 * * *');
    expect(weekly.schedule).toBe('15 8 * * 1');
  });
});
