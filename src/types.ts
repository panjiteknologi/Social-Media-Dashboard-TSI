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

export interface UpcomingItem {
  date: string;
  title: string;
  channel: string;
  owner: string;
  status: ContentStatus;
}

export interface AgentActivity {
  agent: string;
  text: string;
  time: string;
}

export type Platform = 'Instagram' | 'Facebook' | 'LinkedIn' | 'Article';

export interface KanbanCard {
  title: string;
  keyword: string;
  platform: Platform;
  due: string;
}

export interface KanbanColumn {
  name: string;
  cards: KanbanCard[];
}

export interface TopicRecommendation {
  kw: string;
  score: number;
  intent: string;
  relevance: string;
  type: string;
  cta: string;
}

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

export interface TechHealthItem {
  label: string;
  count: number;
  severity: Severity;
}

export interface ActionItem {
  priority: 'P1' | 'P2' | 'P3';
  issue: string;
  kw: string;
  action: string;
  impact: string;
  status: 'Open' | 'In Progress';
}

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

export interface ApprovalItem {
  id: number;
  title: string;
  type: string;
  author: string;
  qa: number;
  seo: number | Blank;
  brand: number;
  submitted: string;
  sources: number;
  risks: string;
  preview: string;
}

export interface TimelineStep {
  step: string;
  time: string;
  done: boolean;
}

export type ReportPeriod = 'Daily' | 'Weekly' | 'Monthly';

export interface ReportCard {
  period: string;
  status: string;
  generated: string;
  telegram: boolean;
  whatsapp: boolean;
  email: boolean;
}

export interface CalendarEntry {
  title: string;
  platform: Platform;
}
