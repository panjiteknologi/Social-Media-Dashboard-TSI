import type {
  AgentActivity,
  AiOpportunity,
  Article,
  AttentionItem,
  CalendarEntry,
  HistoryEntry,
  KanbanColumn,
  KeywordMovement,
  Kpi,
  NavItem,
  TopContent,
  TopicRecommendation,
  UpcomingItem,
} from '../types';

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

export const DASHBOARD_KPIS: Kpi[] = [
  { label: 'Organic Traffic', capability: 'ga4', value: '28,421', change: '+18.4%', dir: 'up', period: 'vs previous period' },
  { label: 'SEO Visibility', capability: 'gsc', value: '64.2%', change: '+5.1%', dir: 'up', period: 'vs previous period' },
  { label: 'Keywords in Top 10', capability: 'gsc', value: '142', change: '+12', dir: 'up', period: 'vs previous period' },
  { label: 'Organic Leads', capability: 'ga4', value: '386', change: '+9.2%', dir: 'up', period: 'vs previous period' },
  { label: 'Articles Published', capability: 'articles', value: '58', change: '+4', dir: 'up', period: 'this quarter' },
  { label: 'Scheduled Content', capability: 'content', value: '23', change: '—', dir: 'flat', period: 'next 14 days' },
  { label: 'Social Engagement', capability: 'meta', value: '12.4K', change: '+7.8%', dir: 'up', period: 'vs previous period' },
  { label: 'Pending Approvals', capability: 'content', value: '9', change: '+3', dir: 'up', period: 'awaiting review' },
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

export const KEYWORD_MOVEMENTS: KeywordMovement[] = [
  { kw: 'ISO 27001 Certification', cur: 5, prev: 9, move: 4, dir: 'up', intent: 'Commercial', page: '/article/iso-27001-certification' },
  { kw: 'ISO 14001 Certification', cur: 8, prev: 13, move: 5, dir: 'up', intent: 'Commercial', page: '/article/iso-14001-certification' },
  { kw: 'ISO 9001 Certification', cur: 11, prev: 7, move: 4, dir: 'down', intent: 'Commercial', page: '/article/iso-9001-certification' },
  { kw: 'ISO 42001 Indonesia', cur: 14, prev: 14, move: 0, dir: 'flat', intent: 'Informational', page: '/article/iso-42001-indonesia' },
  { kw: 'ISO 37001 Anti Bribery', cur: 6, prev: 10, move: 4, dir: 'up', intent: 'Commercial', page: '/article/iso-37001-anti-bribery' },
];

export const TOP_CONTENT: TopContent[] = [
  { title: 'ISO 27001 Certification: Complete Guide', traffic: '4,820', pos: '#5', ctr: '6.2%', leads: 42, trend: 'up' },
  { title: 'ISO 9001 vs ISO 14001: Key Differences', traffic: '3,910', pos: '#7', ctr: '5.4%', leads: 31, trend: 'up' },
  { title: 'How Much Does ISO Certification Cost', traffic: '3,140', pos: '#9', ctr: '3.1%', leads: 18, trend: 'down' },
];

export const ATTENTION_CONTENT: AttentionItem[] = [
  { title: 'ISO 9001 Certification Requirements', reason: 'Ranking declining' },
  { title: 'ISO Certification Cost Breakdown', reason: 'Low CTR' },
  { title: 'What is ISO 22000', reason: 'Content outdated' },
  { title: 'ISO 27001 Implementation Steps', reason: 'Keyword cannibalization' },
];

export const UPCOMING_CONTENT: UpcomingItem[] = [
  { date: '22 Aug', title: 'ISO 42001 AI Management Explained', channel: 'Article', owner: 'Nadia R.', status: 'Scheduled' },
  { date: '23 Aug', title: '5 Benefits of ISO 45001 for Manufacturing', channel: 'LinkedIn', owner: 'Bagus P.', status: 'Draft' },
  { date: '25 Aug', title: 'ISO 14001 Renewal Checklist', channel: 'Article', owner: 'Nadia R.', status: 'Review' },
];

export const AGENT_ACTIVITY: AgentActivity[] = [
  { agent: 'Research Agent', text: 'Discovered 12 new keyword opportunities in the ISO 42001 cluster.', time: '10 min ago' },
  { agent: 'SEO Agent', text: 'Flagged 3 declining articles for content refresh.', time: '42 min ago' },
  { agent: 'Content Agent', text: 'Generated draft for "ISO 37001 Certification Process".', time: '1 hr ago' },
  { agent: 'Approval', text: 'ISO 27001 fintech article approved by Marketing Manager.', time: '2 hr ago' },
  { agent: 'Social Agent', text: 'LinkedIn post scheduled for the ISO 45001 campaign.', time: '3 hr ago' },
];

export const KANBAN_DATA: KanbanColumn[] = [
  { name: 'Ideas', cards: [{ title: 'ISO 50001 Energy Management Overview', keyword: 'ISO 50001', platform: 'Article', due: '—' }] },
  { name: 'Researching', cards: [{ title: 'ISO 42001 vs NIST AI Framework', keyword: 'ISO 42001 comparison', platform: 'Article', due: 'Sep 2' }] },
  { name: 'Brief Ready', cards: [{ title: 'ISO 27001 for Fintech', keyword: 'ISO 27001 fintech', platform: 'Article', due: 'Aug 28' }] },
  {
    name: 'Drafting',
    cards: [
      { title: 'ISO 42001 AI Management Explained', keyword: 'ISO 42001 requirements', platform: 'Article', due: 'Aug 22' },
      { title: '5 Benefits of ISO 45001', keyword: 'ISO 45001 manufacturing', platform: 'LinkedIn', due: 'Aug 23' },
    ],
  },
  { name: 'Review', cards: [{ title: 'ISO 14001 Renewal Checklist', keyword: 'ISO 14001 renewal', platform: 'Article', due: 'Aug 25' }] },
  { name: 'Approved', cards: [{ title: 'ISO 37001 Anti Bribery Certification', keyword: 'ISO 37001 anti bribery', platform: 'Article', due: 'Aug 26' }] },
  { name: 'Scheduled', cards: [{ title: 'Checklist Dokumen ISO 37001', keyword: 'ISO 37001 dokumen', platform: 'Instagram', due: 'Aug 24' }] },
  { name: 'Published', cards: [{ title: 'ISO 27001 Certification: Complete Guide', keyword: 'ISO 27001 certification', platform: 'Article', due: 'Jul 12' }] },
];

export const PLANNER_FILTERS = [
  'Date',
  'Campaign',
  'Content Type',
  'Platform',
  'Status',
  'Priority',
  'Topic Cluster',
];

export const CALENDAR_DAY_NAMES = ['Mon 18', 'Tue 19', 'Wed 20', 'Thu 21', 'Fri 22', 'Sat 23', 'Sun 24'];

export const CALENDAR_SEED: CalendarEntry[][] = [
  [{ title: 'ISO 27001 Fintech brief', platform: 'Article' }],
  [],
  [{ title: 'LinkedIn: AI Governance', platform: 'LinkedIn' }],
  [{ title: 'IG: ISO 9001 mistakes', platform: 'Instagram' }],
  [{ title: 'ISO 42001 draft due', platform: 'Article' }],
  [],
  [{ title: 'FB: ISO 37001 launch', platform: 'Facebook' }],
];

export const TOPIC_RECOMMENDATIONS: TopicRecommendation[] = [
  { kw: 'ISO 27001 for Fintech', score: 92, intent: 'Commercial Investigation', relevance: 'High', type: 'Create dedicated long-form article.', cta: 'Create Content Brief' },
  { kw: 'ISO 42001 Requirements', score: 88, intent: 'Informational', relevance: 'High', type: 'Pillar guide with FAQ section.', cta: 'Create Content Brief' },
  { kw: 'ISO 45001 Manufacturing', score: 81, intent: 'Commercial', relevance: 'Medium', type: 'Case study article.', cta: 'Create Content Brief' },
];

export const ARTICLES: Article[] = [
  {
    title: 'ISO 27001 Certification: Complete Guide',
    kw: 'ISO 27001 certification',
    cluster: 'Information Security',
    status: 'Published',
    author: 'Nadia R.',
    seo: 92,
    rank: '#5',
    traffic: '4,820',
    leads: 42,
    date: '12 Jul 2026',
    url: '/article/iso-27001-certification',
    secondaryKw: 'ISO 27001 requirements, ISMS implementation',
    summary:
      'A comprehensive guide covering ISO 27001 requirements, implementation steps and certification timeline for Indonesian organizations.',
  },
  {
    title: 'ISO 9001 Certification Requirements',
    kw: 'ISO 9001 requirements',
    cluster: 'Quality Management',
    status: 'Published',
    author: 'Bagus P.',
    seo: 74,
    rank: '#11',
    traffic: '2,140',
    leads: 14,
    date: '03 Jun 2026',
    url: '/article/iso-9001-certification',
    secondaryKw: 'QMS documentation, ISO 9001 clauses',
    summary:
      'Overview of ISO 9001:2015 clause requirements and the documentation an organization needs before audit.',
  },
  {
    title: 'ISO 42001 AI Management Explained',
    kw: 'ISO 42001 requirements',
    cluster: 'AI Governance',
    status: 'In Review',
    author: 'Nadia R.',
    seo: 81,
    rank: '#14',
    traffic: '—',
    leads: 0,
    date: '22 Aug 2026',
    url: '/article/iso-42001-ai-management',
    secondaryKw: 'AI management system, AI governance Indonesia',
    summary:
      'Explains the AI Management System requirements under ISO 42001 and why it matters for AI governance in Indonesia.',
  },
  {
    title: 'ISO 14001 Renewal Checklist',
    kw: 'ISO 14001 renewal',
    cluster: 'Environmental',
    status: 'Draft',
    author: 'Nadia R.',
    seo: '—',
    rank: '—',
    traffic: '—',
    leads: 0,
    date: '25 Aug 2026',
    url: '/article/iso-14001-renewal',
    secondaryKw: 'EMS recertification, environmental audit',
    summary: 'A step-by-step checklist for organizations preparing to renew their ISO 14001 certification.',
  },
  {
    title: 'ISO 45001 for Manufacturing',
    kw: 'ISO 45001 manufacturing',
    cluster: 'Occupational Safety',
    status: 'Scheduled',
    author: 'Bagus P.',
    seo: 86,
    rank: '#9',
    traffic: '—',
    leads: 0,
    date: '28 Aug 2026',
    url: '/article/iso-45001-manufacturing',
    secondaryKw: 'OH&S management system, workplace safety',
    summary:
      'How manufacturing companies can implement ISO 45001 to reduce workplace incidents and pass certification audits.',
  },
  {
    title: 'ISO 37001 Anti Bribery Certification',
    kw: 'ISO 37001 anti bribery',
    cluster: 'Governance',
    status: 'Published',
    author: 'Dewi A.',
    seo: 88,
    rank: '#6',
    traffic: '3,020',
    leads: 22,
    date: '18 May 2026',
    url: '/article/iso-37001-anti-bribery',
    secondaryKw: 'anti-bribery management system, SMAP',
    summary:
      'Covers the anti-bribery management system requirements of ISO 37001 and its relevance for public-facing companies.',
  },
  {
    title: 'ISO Certification Cost Breakdown',
    kw: 'ISO certification cost',
    cluster: 'Quality Management',
    status: 'Needs Update',
    author: 'Bagus P.',
    seo: 63,
    rank: '#9',
    traffic: '3,140',
    leads: 18,
    date: '02 Feb 2026',
    url: '/article/iso-certification-cost',
    secondaryKw: 'certification body fees, audit mandays',
    summary:
      'Breaks down the cost factors of ISO certification including audit mandays, certification body fees and company size.',
  },
  {
    title: 'ISO 22000 Food Safety Guide',
    kw: 'ISO 22000 food safety',
    cluster: 'Food Safety',
    status: 'Needs Update',
    author: 'Dewi A.',
    seo: 58,
    rank: '#19',
    traffic: '980',
    leads: 6,
    date: '14 Jan 2026',
    url: '/article/iso-22000-food-safety',
    secondaryKw: 'FSMS, HACCP Indonesia',
    summary:
      'Introduces the ISO 22000 Food Safety Management System and its relationship with HACCP requirements.',
  },
  {
    title: 'ISO 27001 Implementation Steps',
    kw: 'ISO 27001 implementation',
    cluster: 'Information Security',
    status: 'Published',
    author: 'Nadia R.',
    seo: 79,
    rank: '#12',
    traffic: '1,860',
    leads: 11,
    date: '29 Apr 2026',
    url: '/article/iso-27001-implementation',
    secondaryKw: 'risk assessment ISO 27001, ISMS rollout',
    summary:
      'A practical walkthrough of the implementation steps required before an ISO 27001 certification audit.',
  },
  {
    title: 'ISO 9001 vs ISO 14001',
    kw: 'ISO 9001 vs ISO 14001',
    cluster: 'Quality Management',
    status: 'Published',
    author: 'Bagus P.',
    seo: 84,
    rank: '#7',
    traffic: '3,910',
    leads: 31,
    date: '20 Mar 2026',
    url: '/article/iso-9001-vs-iso-14001',
    secondaryKw: 'integrated management system, IMS',
    summary:
      'Compares the scope and clause structure of ISO 9001 and ISO 14001 for companies considering an integrated management system.',
  },
];

export const ARTICLE_TABS = ['Overview', 'SEO', 'Social', 'Analytics', 'History'] as const;

export type ArticleTab = (typeof ARTICLE_TABS)[number];

export const ARTICLE_HISTORY: HistoryEntry[] = [
  { text: 'Draft generated by Content Agent', time: 'Aug 20, 09:14' },
  { text: 'AI QA and SEO review completed', time: 'Aug 20, 10:05' },
  { text: 'Submitted for approval', time: 'Aug 20, 10:06' },
  { text: 'Approved by Marketing Manager', time: 'Aug 20, 15:40' },
];
