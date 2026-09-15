import { describe, expect, it } from 'vitest';
import { DEFAULT_TIMEOUT_SECONDS, HEARTBEAT_SECONDS, queueOptions } from './queue';

describe('queueOptions', () => {
  it('gives every queue a heartbeat and the default timeout', () => {
    expect(queueOptions({ retryLimit: 2, retryDelaySeconds: 300 })).toEqual({
      retryLimit: 2,
      retryDelay: 300,
      retryBackoff: true,
      expireInSeconds: DEFAULT_TIMEOUT_SECONDS,
      heartbeatSeconds: HEARTBEAT_SECONDS,
    });
  });

  it('lets a long job run past the default timeout', () => {
    expect(queueOptions({ retryLimit: 2, retryDelaySeconds: 1800, timeoutSeconds: 3600 }).expireInSeconds).toBe(3600);
  });
});
