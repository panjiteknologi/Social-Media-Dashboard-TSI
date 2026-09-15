import type { AgentActivity, AiOpportunity, Kpi, NavItem, TopicRecommendation } from '../types';

export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Dashboard', group: 'Overview' },
  { key: 'planner', label: 'Content Planner', group: 'Editorial' },
  { key: 'articles', label: 'Articles', group: 'Editorial' },
  { key: 'social', label: 'Social Media', group: 'Growth' },
  { key: 'seo', label: 'SEO Intelligence', group: 'Growth' },
  { key: 'analytics', label: 'Analytics', group: 'Growth' },
  { key: 'approval', label: 'Approval Queue', group: 'Workflow' },
  { key: 'reports', label: 'Reports', group: 'Workflow' },
  { key: 'media', label: 'Media Library', group: 'Workflow' },
  { key: 'workflow', label: 'Workflow Logs', group: 'Workflow' },
  { key: 'settings', label: 'Settings', group: 'System' },
];

/**
 * Dashboard KPIs. Traffic, search, leads, articles and the Content Planner
 * render live data; social engagement keeps a sample value that shows only
 * once Meta is connected.
 */
export const DASHBOARD_KPIS: Kpi[] = [
  { label: 'Organic Traffic', capability: 'ga4', value: '', change: '', dir: 'flat' },
  { label: 'SEO Visibility', capability: 'gsc', value: '', change: '', dir: 'flat' },
  { label: 'Keywords in Top 10', capability: 'gsc', value: '', change: '', dir: 'flat' },
  { label: 'Website Leads', capability: 'leads', value: '', change: '', dir: 'flat' },
  { label: 'Articles Published', capability: 'articles', value: '', change: '', dir: 'flat' },
  { label: 'Scheduled Content', capability: 'content', value: '', change: '', dir: 'flat' },
  { label: 'Social Engagement', capability: 'meta', value: '12.4K', change: '+7.8%', dir: 'up', period: 'vs previous period' },
  { label: 'Pending Approvals', capability: 'content', value: '', change: '', dir: 'flat' },
];

export const AI_OPPORTUNITIES: AiOpportunity[] = [
  {
    icon: '🔥',
    category: 'SEO Opportunity',
    priority: 'High',
    insight: 'ISO 42001 requirements gaining visibility across AI governance searches.',
    action: 'Expand content depth and add an FAQ schema block.',
    cta: 'Review Opportunity',
  },
  {
    icon: '🔥',
    category: 'SEO Opportunity',
    priority: 'High',
    insight: 'ISO 27001 fintech keyword cluster approaching Page 1.',
    action: 'Strengthen internal links from the cybersecurity hub page.',
    cta: 'Review Opportunity',
  },
  {
    icon: '⚠',
    category: 'Ranking Risk',
    priority: 'Medium',
    insight: 'ISO 9001 certification article losing ranking over the last 14 days.',
    action: 'Refresh statistics and update the publish date.',
    cta: 'Review Opportunity',
  },
  {
    icon: '⚠',
    category: 'CTR Issue',
    priority: 'Medium',
    insight: 'Low CTR detected on the "ISO certification cost" keyword.',
    action: 'Rewrite meta title and description.',
    cta: 'Review Opportunity',
  },
];

export const AGENT_ACTIVITY: AgentActivity[] = [
  { agent: 'Research Agent', text: 'Discovered 12 new keyword opportunities in the ISO 42001 cluster.', time: '10 min ago' },
  { agent: 'SEO Agent', text: 'Flagged 3 declining articles for content refresh.', time: '42 min ago' },
  { agent: 'Content Agent', text: 'Generated draft for "ISO 37001 Certification Process".', time: '1 hr ago' },
  { agent: 'Approval', text: 'ISO 27001 fintech article approved by Marketing Manager.', time: '2 hr ago' },
  { agent: 'Social Agent', text: 'LinkedIn post scheduled for the ISO 45001 campaign.', time: '3 hr ago' },
];

export const TOPIC_RECOMMENDATIONS: TopicRecommendation[] = [
  { kw: 'ISO 27001 for Fintech', score: 92, intent: 'Commercial Investigation', relevance: 'High', type: 'Create dedicated long-form article.', cta: 'Create Content Brief' },
  { kw: 'ISO 42001 Requirements', score: 88, intent: 'Informational', relevance: 'High', type: 'Pillar guide with FAQ section.', cta: 'Create Content Brief' },
  { kw: 'ISO 45001 Manufacturing', score: 81, intent: 'Commercial', relevance: 'Medium', type: 'Case study article.', cta: 'Create Content Brief' },
];

export const ARTICLE_TABS = ['Overview', 'SEO', 'Social', 'Analytics', 'History'] as const;

export type ArticleTab = (typeof ARTICLE_TABS)[number];
