import type { Direction } from '../types';

const numberFormat = new Intl.NumberFormat('en-US');

export const formatNumber = (value: number): string => numberFormat.format(Math.round(value));

/** A 0–1 ratio as a percentage; a dash when there is nothing to divide. */
export const formatPercent = (ratio: number | null, digits = 1): string =>
  ratio === null ? '—' : `${(ratio * 100).toFixed(digits)}%`;

export const formatPosition = (position: number | null): string =>
  position === null ? '—' : position.toFixed(1);

import { formatDate } from '../../shared/seo';

export { formatDate };

/** Seconds as "3m 05s", or "42s" under a minute; a dash when there is nothing to show. */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds)) return '—';
  const whole = Math.round(seconds);
  if (whole < 60) return `${whole}s`;
  return `${Math.floor(whole / 60)}m ${String(whole % 60).padStart(2, '0')}s`;
}

/** A timestamp in the viewer's local time: "15 Sep, 14:10". */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  return `${formatDate(day, false)}, ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export interface Change {
  text: string;
  /** Whether the change is good (up), bad (down) or neither, not which way the number moved. */
  dir: Direction;
}

const signed = (value: number, digits: number, suffix = ''): string =>
  `${value > 0 ? '+' : '−'}${Math.abs(value).toFixed(digits)}${suffix}`;

/** Relative change for a count; null without a previous value to compare with. */
export function percentChange(current: number, previous: number | null): Change | null {
  if (previous === null || previous === 0) return null;
  const change = (current - previous) / previous;
  if (Math.abs(change) < 0.0005) return { text: '0.0%', dir: 'flat' };
  return { text: signed(change * 100, 1, '%'), dir: change > 0 ? 'up' : 'down' };
}

/** Difference in average position, where a lower number is better. */
export function positionChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  const delta = current - previous;
  if (Math.abs(delta) < 0.05) return { text: '0.0', dir: 'flat' };
  return { text: signed(delta, 1), dir: delta < 0 ? 'up' : 'down' };
}

/** Difference between two 0–1 rates in percentage points. */
export function pointChange(current: number | null, previous: number | null): Change | null {
  if (current === null || previous === null) return null;
  const delta = (current - previous) * 100;
  if (Math.abs(delta) < 0.05) return { text: '0.0 pp', dir: 'flat' };
  return { text: signed(delta, 1, ' pp'), dir: delta > 0 ? 'up' : 'down' };
}

/** Difference between two whole counts. */
export function countChange(current: number, previous: number | null): Change | null {
  if (previous === null) return null;
  const delta = current - previous;
  if (delta === 0) return { text: '0', dir: 'flat' };
  return { text: signed(delta, 0), dir: delta > 0 ? 'up' : 'down' };
}

/** A page as the team reads it: the path on the main website, host and path anywhere else. */
export function displayPage(url: string, contentHost: string): string {
  try {
    const parsed = new URL(url);
    const path = `${parsed.pathname}${parsed.search}`;
    return parsed.hostname === contentHost ? path : `${parsed.hostname}${path === '/' ? '' : path}`;
  } catch {
    return url;
  }
}
