import { describe, expect, it } from 'vitest';
import { evaluateHeartbeat, WORKER_SILENCE_ALERT_MS } from './monitor';

const now = new Date('2026-09-13T08:00:00Z');
const ago = (ms: number) => new Date(now.getTime() - ms);

describe('evaluateHeartbeat', () => {
  it('stays quiet when no worker has ever checked in', () => {
    expect(evaluateHeartbeat(null, now, false)).toEqual({ alerting: false, message: null });
  });

  it('stays quiet while the worker checks in on time', () => {
    expect(evaluateHeartbeat(ago(30_000), now, false)).toEqual({ alerting: false, message: null });
  });

  it('alerts once when the worker goes silent', () => {
    const silentSince = ago(WORKER_SILENCE_ALERT_MS + 60_000);
    const first = evaluateHeartbeat(silentSince, now, false);
    expect(first.alerting).toBe(true);
    expect(first.message).toContain('stopped checking in');

    expect(evaluateHeartbeat(silentSince, now, first.alerting)).toEqual({
      alerting: true,
      message: null,
    });
  });

  it('announces when the worker recovers', () => {
    const verdict = evaluateHeartbeat(ago(10_000), now, true);
    expect(verdict.alerting).toBe(false);
    expect(verdict.message).toContain('checking in again');
  });
});
