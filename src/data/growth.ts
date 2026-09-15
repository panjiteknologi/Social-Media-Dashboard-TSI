import type {
  CampaignPerformance,
  PlatformPerformance,
  Post,
  SocialSummaryItem,
  SocialTrend,
} from '../types';

export const SOCIAL_SUMMARY: SocialSummaryItem[] = [
  { label: 'Instagram Followers', capability: 'meta', value: '18,420', change: '+2.1%' },
  { label: 'LinkedIn Followers', capability: 'linkedin', value: '9,860', change: '+4.6%' },
  { label: 'Facebook Followers', capability: 'meta', value: '12,050', change: '+0.8%' },
  { label: 'Total Engagement', capability: 'meta', value: '12.4K', change: '+7.8%' },
  { label: 'Scheduled Posts', capability: 'meta', value: '14', change: '+3' },
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
