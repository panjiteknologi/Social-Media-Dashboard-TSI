import { describe, expect, it } from 'vitest';
import { resolveCapabilityStates } from './capabilities';

describe('resolveCapabilityStates', () => {
  it('separates missing integrations from features that are not built yet', () => {
    const states = resolveCapabilityStates(new Set());
    expect(states.gsc).toBe('not_connected');
    expect(states.content).toBe('planned');
  });

  it('marks live capabilities available', () => {
    expect(resolveCapabilityStates(new Set(['gsc'])).gsc).toBe('available');
  });

  it('keeps an on-hold capability on hold even if listed as live', () => {
    expect(resolveCapabilityStates(new Set(['linkedin'])).linkedin).toBe('on_hold');
  });
});
