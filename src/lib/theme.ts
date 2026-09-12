import type { CSSProperties } from 'react';
import type {
  ActionItem,
  ContentStatus,
  Direction,
  KeywordStatus,
  Platform,
  Severity,
} from '../types';

/** A chip's foreground and background, in that order. */
export type ChipTone = readonly [fg: string, bg: string];

const NEUTRAL: ChipTone = ['#667085', '#F2F4F7'];

const STATUS_TONES: Record<ContentStatus, ChipTone> = {
  Published: ['#1F9D68', '#E9F7EF'],
  'In Review': ['#F2A93B', '#FDF3E2'],
  Draft: ['#667085', '#F2F4F7'],
  Scheduled: ['#2D6CDF', '#EAF2FF'],
  'Needs Update': ['#D64545', '#FBEAEA'],
  Review: ['#F2A93B', '#FDF3E2'],
};

const PLATFORM_TONES: Record<Platform, ChipTone> = {
  Instagram: ['#C2185B', '#FBE7EF'],
  Facebook: ['#1877F2', '#EAF2FF'],
  LinkedIn: ['#0A66C2', '#EAF2FF'],
  Article: ['#0F2747', '#EAF2FF'],
};

const KEYWORD_STATUS_TONES: Record<KeywordStatus, ChipTone> = {
  Rising: ['#1F9D68', '#E9F7EF'],
  Dropping: ['#D64545', '#FBEAEA'],
  Stable: ['#667085', '#F2F4F7'],
  Opportunity: ['#2D6CDF', '#EAF2FF'],
  'At Risk': ['#F2A93B', '#FDF3E2'],
};

/** Used for both SEO opportunity size and technical-health severity. */
const SEVERITY_TONES: Record<Severity, ChipTone> = {
  High: ['#D64545', '#FBEAEA'],
  Medium: ['#F2A93B', '#FDF3E2'],
  Low: ['#667085', '#F2F4F7'],
};

/** Technical health inverts Low: few low-severity issues is a good thing. */
const HEALTH_TONES: Record<Severity, ChipTone> = {
  ...SEVERITY_TONES,
  Low: ['#1F9D68', '#E9F7EF'],
};

const PRIORITY_TONES: Record<ActionItem['priority'], ChipTone> = {
  P1: ['#D64545', '#FBEAEA'],
  P2: ['#F2A93B', '#FDF3E2'],
  P3: ['#667085', '#F2F4F7'],
};

const ACTION_STATUS_TONES: Record<ActionItem['status'], ChipTone> = {
  Open: ['#2D6CDF', '#EAF2FF'],
  'In Progress': ['#F2A93B', '#FDF3E2'],
};

export const statusTone = (status: ContentStatus): ChipTone => STATUS_TONES[status] ?? NEUTRAL;
export const platformTone = (platform: Platform): ChipTone => PLATFORM_TONES[platform] ?? NEUTRAL;
export const keywordStatusTone = (status: KeywordStatus): ChipTone =>
  KEYWORD_STATUS_TONES[status] ?? NEUTRAL;
export const severityTone = (severity: Severity): ChipTone => SEVERITY_TONES[severity];
export const healthTone = (severity: Severity): ChipTone => HEALTH_TONES[severity];
export const priorityTone = (priority: ActionItem['priority']): ChipTone => PRIORITY_TONES[priority];
export const actionStatusTone = (status: ActionItem['status']): ChipTone =>
  ACTION_STATUS_TONES[status];

export function toneStyle([fg, bg]: ChipTone): CSSProperties {
  return { color: fg, background: bg };
}

/** Status text shown without a chip background (upcoming content list). */
export function statusTextStyle(status: ContentStatus): CSSProperties {
  return { color: statusTone(status)[0], fontWeight: 600 };
}

const DIRECTION_CLASS: Record<Direction, string> = {
  up: 'up',
  down: 'down',
  flat: 'flat',
};

export const directionClass = (dir: Direction): string => DIRECTION_CLASS[dir];

/** "↑ +18.4%" / "↓ -2.3" / "—" — the arrow prefix the design applies to KPI deltas. */
export function changeText(dir: Direction, change: string): string {
  if (dir === 'up') return `↑ ${change}`;
  if (dir === 'down') return `↓ ${change}`;
  return change;
}

/** Movement column: flat renders as an en dash rather than an empty prefix. */
export function movementText(dir: Direction, move: number): string {
  if (dir === 'up') return `↑ ${move}`;
  if (dir === 'down') return `↓ ${move}`;
  return `– ${move}`;
}
