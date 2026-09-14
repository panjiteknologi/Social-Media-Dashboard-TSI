import type { ReactNode } from 'react';
import {
  CAPABILITIES,
  type CapabilityKey,
  type CapabilityState,
} from '../../shared/capabilities';
import { useCapabilities } from '../api/queries';

/**
 * Local-only switch that shows the design's sample numbers instead of the
 * not-connected states, for checking layout. Always off in a production build.
 */
const SHOW_SAMPLE_DATA = import.meta.env.DEV && import.meta.env.VITE_SAMPLE_DATA === 'true';

type ResolvedState = CapabilityState | 'loading';

type UnavailableState = Exclude<ResolvedState, 'available'>;

const TITLES: Record<UnavailableState, string> = {
  loading: 'Loading…',
  not_connected: 'Not connected',
  planned: 'Not available yet',
  on_hold: 'On hold',
};

/** Returns a lookup of each capability's current state. */
export function useCapabilityStates(): (capability: CapabilityKey) => ResolvedState {
  const { data } = useCapabilities();
  return (capability) => (SHOW_SAMPLE_DATA ? 'available' : (data?.[capability] ?? 'loading'));
}

/** One-word reason, for places with no room for the full explanation. */
export const unavailableLabel = (state: UnavailableState): string => TITLES[state];

function explain(capability: CapabilityKey, state: Exclude<UnavailableState, 'loading'>): string {
  const { label, milestone } = CAPABILITIES[capability];
  if (state === 'not_connected') return `Connects to ${label} in ${milestone}.`;
  if (state === 'planned') return `${label} arrives in ${milestone}.`;
  return `The ${label} integration is on hold.`;
}

/** Renders `children` only when their capability is live; otherwise says what is missing. */
export function Requires({
  capability,
  tall = false,
  children,
}: {
  capability: CapabilityKey;
  /** Reserve chart height, so the card does not collapse. */
  tall?: boolean;
  children: ReactNode;
}) {
  const state = useCapabilityStates()(capability);
  if (state === 'available') return <>{children}</>;

  const className = tall ? 'source-state source-state--tall' : 'source-state';
  if (state === 'loading') return <div className={className} aria-busy="true" />;

  return (
    <div className={className} role="status">
      <div className="source-state__title">{TITLES[state]}</div>
      <div className="source-state__detail">{explain(capability, state)}</div>
    </div>
  );
}

/** A KPI's value and footer, or a dash and the reason when its source is not live. */
export function KpiBody({
  capability,
  value,
  foot,
}: {
  capability: CapabilityKey;
  value: string;
  foot: ReactNode;
}) {
  const state = useCapabilityStates()(capability);
  if (state === 'available') {
    return (
      <>
        <div className="kpi__value">{value}</div>
        {foot}
      </>
    );
  }
  return (
    <>
      <div className="kpi__value kpi__value--empty">—</div>
      <div className="kpi__foot">
        <span className="kpi__period">{TITLES[state]}</span>
      </div>
    </>
  );
}
