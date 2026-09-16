import type { CapabilityKey } from '../shared/capabilities';

export type { KeywordStatus } from '../shared/seo';

export type ScreenKey =
  | 'dashboard'
  | 'planner'
  | 'articles'
  | 'social'
  | 'seo'
  | 'analytics'
  | 'approval'
  | 'reports'
  | 'media'
  | 'workflow'
  | 'settings';

export type NavGroupLabel = 'Overview' | 'Editorial' | 'Growth' | 'Workflow' | 'System';

export interface NavItem {
  key: ScreenKey;
  label: string;
  group: NavGroupLabel;
  badge?: number;
}

/** Direction of a period-over-period change. */
export type Direction = 'up' | 'down' | 'flat';

/** A value the source data leaves blank, rendered as an em dash. */
export type Blank = '—';

export interface Kpi {
  label: string;
  /** The data source the metric comes from; the card shows a dash until it is live. */
  capability: CapabilityKey;
  value: string;
  change: string;
  dir: Direction;
  period?: string;
}

export interface AiOpportunity {
  icon: string;
  category: string;
  priority: 'High' | 'Medium' | 'Low';
  insight: string;
  action: string;
  cta: string;
}

export type ContentStatus =
  | 'Published'
  | 'In Review'
  | 'Draft'
  | 'Scheduled'
  | 'Needs Update'
  | 'Review';

export interface AgentActivity {
  agent: string;
  text: string;
  time: string;
}

export type Platform = 'Instagram' | 'Facebook' | 'LinkedIn' | 'Article';

export interface SocialSummaryItem {
  label: string;
  capability: CapabilityKey;
  value: string;
  change: string;
}

export type SocialPlatform = Exclude<Platform, 'Article'>;

export interface Post {
  platform: SocialPlatform;
  caption: string;
  date: string;
  campaign: string;
  status: ContentStatus;
}

export interface SocialTrend {
  trend: string;
  action: string;
}

export type Severity = 'High' | 'Medium' | 'Low';

export interface PlatformPerformance {
  platform: SocialPlatform;
  reach: string;
  impr: string;
  engagement: string;
  clicks: string;
  followers: string;
  ctr: string;
}

export interface CampaignPerformance {
  name: string;
  created: number;
  traffic: string;
  engagement: string;
  leads: number;
  conv: string;
}

export type ReportPeriod = 'Daily' | 'Weekly' | 'Monthly';
