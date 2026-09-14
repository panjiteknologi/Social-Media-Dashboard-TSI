/**
 * Every data source or feature a screen section depends on.
 *
 * A section renders its content only once its capability is available; until
 * then it says what is missing. That keeps the dashboard from ever showing a
 * number that did not come from real data.
 */

export type CapabilityKind = 'integration' | 'feature';

export type CapabilityState = 'available' | 'not_connected' | 'planned' | 'on_hold';

interface CapabilityInfo {
  label: string;
  kind: CapabilityKind;
  /** The milestone in docs/Build Plan and Status.md that delivers it. */
  milestone: string;
  onHold?: boolean;
}

const DEFINITIONS = {
  gsc: { label: 'Google Search Console', kind: 'integration', milestone: 'M2' },
  ga4: { label: 'Google Analytics 4', kind: 'integration', milestone: 'M3' },
  articles: { label: 'Article inventory', kind: 'feature', milestone: 'M3' },
  technicalSeo: { label: 'Technical SEO checks', kind: 'feature', milestone: 'M4' },
  seoActions: { label: 'SEO Action Center', kind: 'feature', milestone: 'M4' },
  reports: { label: 'Automated reports', kind: 'feature', milestone: 'M4' },
  content: { label: 'Content workflow', kind: 'feature', milestone: 'M5' },
  ai: { label: 'AI recommendations', kind: 'feature', milestone: 'M5' },
  meta: { label: 'Facebook & Instagram', kind: 'integration', milestone: 'M7' },
  campaigns: { label: 'Campaign tracking', kind: 'feature', milestone: 'M8' },
  seoHealthScore: { label: 'SEO Health Score', kind: 'feature', milestone: 'M8' },
  socialTrends: { label: 'Social trend research', kind: 'feature', milestone: 'M8' },
  linkedin: { label: 'LinkedIn', kind: 'integration', milestone: 'on hold', onHold: true },
} satisfies Record<string, CapabilityInfo>;

export type CapabilityKey = keyof typeof DEFINITIONS;

export const CAPABILITIES: Record<CapabilityKey, CapabilityInfo> = DEFINITIONS;

export type CapabilityStates = Record<CapabilityKey, CapabilityState>;

/** Resolves every capability's state from the set that is live right now. */
export function resolveCapabilityStates(available: ReadonlySet<CapabilityKey>): CapabilityStates {
  const entries = (Object.keys(CAPABILITIES) as CapabilityKey[]).map((key) => {
    const info = CAPABILITIES[key];
    let state: CapabilityState;
    if (info.onHold) state = 'on_hold';
    else if (available.has(key)) state = 'available';
    else state = info.kind === 'integration' ? 'not_connected' : 'planned';
    return [key, state] as const;
  });
  return Object.fromEntries(entries) as CapabilityStates;
}
