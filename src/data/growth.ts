import type {
  AcquisitionChannel,
  ActionItem,
  AnalyticsKpi,
  CampaignPerformance,
  Cannibalization,
  ContentPerformanceRow,
  DistributionBand,
  FunnelStage,
  Kpi,
  PlatformPerformance,
  Post,
  SeoOpportunity,
  SocialSummaryItem,
  SocialTrend,
  TechHealthItem,
  TrackedKeyword,
} from '../types';

export const SOCIAL_SUMMARY: SocialSummaryItem[] = [
  { label: 'Instagram Followers', value: '18,420', change: '+2.1%' },
  { label: 'LinkedIn Followers', value: '9,860', change: '+4.6%' },
  { label: 'Facebook Followers', value: '12,050', change: '+0.8%' },
  { label: 'Total Engagement', value: '12.4K', change: '+7.8%' },
  { label: 'Scheduled Posts', value: '14', change: '+3' },
];

export const POSTS: Post[] = [
  { platform: 'Instagram', caption: '5 Common Mistakes Before Your ISO 9001 Audit', date: '22 Aug', campaign: 'QMS Awareness', status: 'Scheduled' },
  { platform: 'LinkedIn', caption: 'Why ISO 42001 Matters for AI Governance in Indonesia', date: '23 Aug', campaign: 'AI Governance', status: 'Scheduled' },
  { platform: 'Facebook', caption: 'TSI Sertifikasi kini melayani sertifikasi ISO 37001', date: '24 Aug', campaign: 'Anti-Bribery Launch', status: 'Draft' },
  { platform: 'Instagram', caption: 'Checklist: Dokumen Wajib Sertifikasi ISO 14001', date: '25 Aug', campaign: 'Environmental Series', status: 'Scheduled' },
  { platform: 'LinkedIn', caption: 'Case Study: ISO 45001 Implementation in Manufacturing', date: '27 Aug', campaign: 'OHS Series', status: 'Scheduled' },
  { platform: 'Facebook', caption: 'Kenapa Perusahaan Anda Perlu ISO 22000?', date: '29 Aug', campaign: 'Food Safety Series', status: 'Draft' },
];

export const SOCIAL_TABS = ['All', 'Instagram', 'Facebook', 'LinkedIn'] as const;

export type SocialTab = (typeof SOCIAL_TABS)[number];

export const SOCIAL_TRENDS: SocialTrend[] = [
  { trend: 'Sustainability reporting is rising across LinkedIn B2B posts.', action: 'Create Social Content' },
  { trend: 'ISO 42001 discussion is increasing among Indonesian tech companies.', action: 'Create Social Content' },
  { trend: 'Cybersecurity awareness is trending after regional data breach news.', action: 'Create Social Content' },
];

export const SEO_KPIS: Kpi[] = [
  { label: 'Organic Traffic', value: '28,421', change: '+18.4%', dir: 'up' },
  { label: 'SEO Visibility', value: '64.2%', change: '+5.1%', dir: 'up' },
  { label: 'Average Position', value: '14.6', change: '-2.3', dir: 'up' },
  { label: 'Keywords Top 3', value: '24', change: '+3', dir: 'up' },
  { label: 'Keywords Top 10', value: '142', change: '+12', dir: 'up' },
  { label: 'Indexed Pages', value: '318', change: '+9', dir: 'up' },
  { label: 'Organic CTR', value: '4.8%', change: '+0.4%', dir: 'up' },
  { label: 'SEO Health Score', value: '82/100', change: '+4', dir: 'up' },
];

export const KEYWORD_TRACKER: TrackedKeyword[] = [
  { kw: 'ISO 27001 Certification', cur: '5.2', page: 'Page 1', intent: 'Commercial', clicks: '1,240', impr: '18,200', ctr: '6.8%', opp: 88, status: 'Rising' },
  { kw: 'ISO 42001 Indonesia', cur: '13.8', page: 'Page 2', intent: 'Informational', clicks: '420', impr: '11,400', ctr: '3.7%', opp: 92, status: 'Opportunity' },
  { kw: 'ISO 9001 Certification', cur: '11.1', page: 'Page 2', intent: 'Commercial', clicks: '980', impr: '15,600', ctr: '6.3%', opp: 54, status: 'Dropping' },
  { kw: 'ISO 37001 Anti Bribery', cur: '6.4', page: 'Page 1', intent: 'Commercial', clicks: '860', impr: '9,800', ctr: '8.8%', opp: 71, status: 'Rising' },
  { kw: 'ISO 14001 Certification', cur: '8.9', page: 'Page 1', intent: 'Commercial', clicks: '1,050', impr: '14,100', ctr: '7.4%', opp: 66, status: 'Rising' },
  { kw: 'ISO 22000 Food Safety', cur: '19.2', page: 'Page 2', intent: 'Informational', clicks: '210', impr: '7,300', ctr: '2.9%', opp: 48, status: 'Stable' },
  { kw: 'ISO Certification Cost', cur: '9.4', page: 'Page 1', intent: 'Commercial Investigation', clicks: '1,420', impr: '19,800', ctr: '7.2%', opp: 38, status: 'At Risk' },
  { kw: 'ISO 45001 Manufacturing', cur: '10.6', page: 'Page 1', intent: 'Commercial', clicks: '640', impr: '8,900', ctr: '7.2%', opp: 75, status: 'Rising' },
];

export const KEYWORD_DIST: DistributionBand[] = [
  { label: 'Top 3', count: 24, color: '#0F2747' },
  { label: 'Pos 4–10', count: 118, color: '#2D6CDF' },
  { label: 'Pos 11–20', count: 96, color: '#7BA6ED' },
  { label: 'Pos 21–50', count: 142, color: '#DCE4EE' },
  { label: 'Pos 51+', count: 210, color: '#F2F4F7' },
];

export const CANNIBALIZATION: Cannibalization = {
  kw: 'ISO 27001',
  urls: ['/iso-27001', '/article/what-is-iso-27001', '/article/iso-27001-guide'],
  rec: 'Define /iso-27001 as the primary landing page and reposition supporting articles as top-of-funnel content.',
};

export const SEO_OPPORTUNITIES: SeoOpportunity[] = [
  { title: 'Move ISO 42001 Indonesia to Page 1', pos: '13.8', impr: '4,280', opp: 'High', action: 'Update content, strengthen internal links, add an FAQ section.' },
  { title: 'Recover ISO 9001 Certification ranking', pos: '11.1', impr: '6,120', opp: 'High', action: 'Refresh statistics and add 2026 regulatory updates.' },
  { title: 'Improve CTR on ISO Certification Cost', pos: '9.4', impr: '19,800', opp: 'Medium', action: 'Rewrite meta title and description, add a price table schema.' },
];

export const TECH_HEALTH: TechHealthItem[] = [
  { label: 'Index Issues', count: 4, severity: 'Medium' },
  { label: 'Broken Links', count: 11, severity: 'High' },
  { label: 'Missing Metadata', count: 6, severity: 'Medium' },
  { label: 'Duplicate Titles', count: 2, severity: 'Low' },
  { label: 'Slow Pages', count: 5, severity: 'Medium' },
  { label: 'Missing Alt Text', count: 18, severity: 'Low' },
  { label: 'Canonical Issues', count: 1, severity: 'Low' },
  { label: 'Schema Issues', count: 3, severity: 'Medium' },
];

export const ACTION_CENTER: ActionItem[] = [
  { priority: 'P1', issue: 'Ranking Decline', kw: 'ISO 9001', action: 'Refresh content', impact: 'High', status: 'Open' },
  { priority: 'P1', issue: 'CTR Drop', kw: 'ISO Certification Cost', action: 'Rewrite meta title', impact: 'High', status: 'Open' },
  { priority: 'P2', issue: 'Keyword Cannibalization', kw: 'ISO 27001', action: 'Consolidate landing pages', impact: 'Medium', status: 'In Progress' },
  { priority: 'P2', issue: 'Missing Internal Links', kw: 'ISO 42001', action: 'Add 4 internal links from hub page', impact: 'Medium', status: 'Open' },
  { priority: 'P3', issue: 'Content Outdated', kw: 'ISO 22000', action: 'Update stats and examples', impact: 'Low', status: 'Open' },
];

export const ANALYTICS_TOP: AnalyticsKpi[] = [
  { label: 'Organic Sessions', value: '42,180', change: '+14.2%' },
  { label: 'Social Traffic', value: '8,940', change: '+9.1%' },
  { label: 'Conversions', value: '612', change: '+11.4%' },
  { label: 'CTA Clicks', value: '2,340', change: '+6.7%' },
  { label: 'Leads', value: '386', change: '+9.2%' },
  { label: 'Content Engagement', value: '6.8 min', change: '+3.4%' },
];

export const ACQUISITION: AcquisitionChannel[] = [
  { label: 'Organic Search', pct: 58, color: '#0F2747' },
  { label: 'Direct', pct: 19, color: '#2D6CDF' },
  { label: 'Social', pct: 15, color: '#7BA6ED' },
  { label: 'Referral', pct: 8, color: '#B7C0CC' },
];

export const CONTENT_PERFORMANCE: ContentPerformanceRow[] = [
  { title: 'ISO 27001 Certification: Complete Guide', traffic: '4,820', engagement: '5.2 min', rank: '#5', conv: '3.4%', leads: 42, trend: 'up' },
  { title: 'ISO 9001 vs ISO 14001', traffic: '3,910', engagement: '4.6 min', rank: '#7', conv: '2.9%', leads: 31, trend: 'up' },
  { title: 'ISO Certification Cost Breakdown', traffic: '3,140', engagement: '3.1 min', rank: '#9', conv: '1.8%', leads: 18, trend: 'down' },
  { title: 'ISO 37001 Anti Bribery Certification', traffic: '3,020', engagement: '4.9 min', rank: '#6', conv: '2.6%', leads: 22, trend: 'up' },
];

export const FUNNEL: FunnelStage[] = [
  { label: 'Search Impression', value: '210,400' },
  { label: 'Search Click', value: '12,840' },
  { label: 'Landing Page', value: '11,920' },
  { label: 'Engaged Session', value: '7,240' },
  { label: 'CTA Click', value: '2,340' },
  { label: 'Form / WhatsApp', value: '890' },
  { label: 'Lead', value: '386' },
];

export const SOCIAL_PERFORMANCE: PlatformPerformance[] = [
  { platform: 'Instagram', reach: '86.4K', impr: '142K', engagement: '9,820', clicks: '2,140', followers: '18,420', ctr: '2.6%' },
  { platform: 'Facebook', reach: '41.2K', impr: '68K', engagement: '3,110', clicks: '860', followers: '12,050', ctr: '1.4%' },
  { platform: 'LinkedIn', reach: '52.8K', impr: '79K', engagement: '6,920', clicks: '1,980', followers: '9,860', ctr: '3.1%' },
];

export const CAMPAIGN_PERFORMANCE: CampaignPerformance[] = [
  { name: 'AI Governance Launch', created: 8, traffic: '12,400', engagement: '4,210', leads: 64, conv: '3.8%' },
  { name: 'QMS Awareness', created: 6, traffic: '9,180', engagement: '2,940', leads: 41, conv: '2.9%' },
  { name: 'Anti-Bribery Launch', created: 5, traffic: '6,820', engagement: '3,110', leads: 38, conv: '3.2%' },
];
