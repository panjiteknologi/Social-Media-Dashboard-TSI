import { describe, expect, it } from 'vitest';
import type { JobDefinition } from './job';
import { executeJob, type QueuedJob, type RunRecorder } from './runner';

type RecordedRun = Parameters<RunRecorder['start']>[0] & Parameters<RunRecorder['finish']>[1];

function harness(alert: (text: string) => Promise<void> = async () => {}) {
  const runs: Partial<RecordedRun>[] = [];
  const alerts: string[] = [];
  const recorder: RunRecorder = {
    async start(run) {
      runs.push(run);
      return String(runs.length - 1);
    },
    async finish(runId, result) {
      Object.assign(runs[Number(runId)], result);
    },
  };
  const alerter = {
    async send(text: string) {
      alerts.push(text);
      await alert(text);
    },
  };
  return { runs, alerts, deps: { recorder, alerter } };
}

const definition = (run: JobDefinition['run']): JobDefinition => ({
  name: 'test-job',
  description: 'Test job',
  retryLimit: 1,
  retryDelaySeconds: 0,
  manual: true,
  run,
});

const queued = (retryCount: number, retryLimit = 1): QueuedJob => ({
  id: 'queue-job-1',
  data: { trigger: 'manual', input: { value: 1 } },
  retryCount,
  retryLimit,
  signal: new AbortController().signal,
});

describe('executeJob', () => {
  it('records a successful attempt with its output', async () => {
    const { runs, alerts, deps } = harness();
    const output = await executeJob(definition(async () => ({ rows: 3 })), queued(0), deps);

    expect(output).toEqual({ rows: 3 });
    expect(runs).toEqual([
      expect.objectContaining({ status: 'success', attempt: 1, maxAttempts: 2, output: { rows: 3 } }),
    ]);
    expect(alerts).toEqual([]);
  });

  it('marks a failed attempt with retries left as retrying, without alerting', async () => {
    const { runs, alerts, deps } = harness();
    const failing = definition(async () => {
      throw new Error('GSC timed out');
    });

    await expect(executeJob(failing, queued(0), deps)).rejects.toThrow('GSC timed out');
    expect(runs[0]).toEqual(expect.objectContaining({ status: 'retrying', error: 'GSC timed out' }));
    expect(alerts).toEqual([]);
  });

  it('marks the last attempt failed and alerts', async () => {
    const { runs, alerts, deps } = harness();
    const failing = definition(async () => {
      throw new Error('GSC timed out');
    });

    await expect(executeJob(failing, queued(1), deps)).rejects.toThrow('GSC timed out');
    expect(runs[0]).toEqual(expect.objectContaining({ status: 'failed', attempt: 2, maxAttempts: 2 }));
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toContain('test-job');
    expect(alerts[0]).toContain('GSC timed out');
  });

  it('does not alert for jobs whose failures a person already sees on screen', async () => {
    const { runs, alerts, deps } = harness();
    const failing = {
      ...definition(async () => {
        throw new Error('The brief was cut off');
      }),
      retryLimit: 0,
      alertOnFailure: false,
    };

    await expect(executeJob(failing, queued(0, 0), deps)).rejects.toThrow('The brief was cut off');
    expect(runs[0]).toEqual(expect.objectContaining({ status: 'failed', attempt: 1, maxAttempts: 1 }));
    expect(alerts).toEqual([]);
  });

  it('still surfaces the job error when the alert cannot be sent', async () => {
    const { deps } = harness(async () => {
      throw new Error('Telegram down');
    });
    const failing = definition(async () => {
      throw new Error('GSC timed out');
    });

    await expect(executeJob(failing, queued(1), deps)).rejects.toThrow('GSC timed out');
  });
});
