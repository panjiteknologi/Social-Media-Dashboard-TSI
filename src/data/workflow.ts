import type { ApprovalItem, ReportCard, ReportPeriod, TimelineStep } from '../types';

export const APPROVAL_QUEUE: ApprovalItem[] = [
  {
    id: 1,
    title: 'ISO 42001 AI Management Explained',
    type: 'Article',
    author: 'Nadia R.',
    qa: 94,
    seo: 81,
    brand: 96,
    submitted: '2 hr ago',
    sources: 14,
    risks: 'None detected. Statistics traced to two primary sources.',
    preview:
      "ISO/IEC 42001 establishes requirements for an Artificial Intelligence Management System (AIMS), helping organizations govern AI development and use responsibly. This article explains the standard's scope, key clauses and why Indonesian organizations building or deploying AI systems should consider certification...",
  },
  {
    id: 2,
    title: '5 Benefits of ISO 45001 for Manufacturing',
    type: 'LinkedIn Post',
    author: 'Bagus P.',
    qa: 88,
    seo: '—',
    brand: 90,
    submitted: '4 hr ago',
    sources: 6,
    risks: 'Claim about incident reduction percentage needs a cited source.',
    preview:
      'Manufacturing floors carry some of the highest occupational risk of any industry. ISO 45001 gives manufacturers a structured way to identify hazards before they become incidents. Here are five concrete benefits certified manufacturers report...',
  },
  {
    id: 3,
    title: 'ISO 14001 Renewal Checklist',
    type: 'Article',
    author: 'Nadia R.',
    qa: 91,
    seo: 78,
    brand: 93,
    submitted: '6 hr ago',
    sources: 9,
    risks: 'None detected.',
    preview:
      'Recertification against ISO 14001 follows the same three-year cycle as most management system standards. This checklist walks through the documentation, internal audit and management review steps needed ahead of the recertification audit...',
  },
  {
    id: 4,
    title: 'Checklist Dokumen ISO 37001',
    type: 'Instagram Post',
    author: 'Dewi A.',
    qa: 85,
    seo: '—',
    brand: 88,
    submitted: '1 day ago',
    sources: 4,
    risks: 'Bahasa Indonesia terminology should be reviewed by a native speaker.',
    preview:
      'Sebelum audit sertifikasi ISO 37001, pastikan dokumen-dokumen berikut telah disiapkan: kebijakan anti penyuapan, penilaian risiko penyuapan, dan prosedur whistleblowing...',
  },
];

export const APPROVAL_TIMELINE: TimelineStep[] = [
  { step: 'Draft generated', time: 'Aug 20, 09:14', done: true },
  { step: 'AI QA completed', time: 'Aug 20, 09:22', done: true },
  { step: 'SEO review completed', time: 'Aug 20, 10:05', done: true },
  { step: 'Submitted for approval', time: 'Aug 20, 10:06', done: true },
  { step: 'Approved / Rejected', time: 'Pending', done: false },
];

export const REPORT_PERIODS: ReportPeriod[] = ['Daily', 'Weekly', 'Monthly'];

export const REPORT_CARDS: Record<ReportPeriod, ReportCard[]> = {
  Daily: [
    { period: 'Daily — 20 Aug 2026', status: 'Sent', generated: '20 Aug, 07:00', telegram: true, whatsapp: true, email: false },
  ],
  Weekly: [
    { period: 'Weekly — 11–17 Aug 2026', status: 'Sent', generated: '18 Aug, 07:00', telegram: true, whatsapp: true, email: true },
  ],
  Monthly: [
    { period: 'Monthly — July 2026', status: 'Sent', generated: '01 Aug, 07:00', telegram: true, whatsapp: false, email: true },
  ],
};

export const EXECUTIVE_SUMMARY =
  "Organic traffic increased 18% this week. 7 keywords entered Google's first page. ISO 42001 content generated the highest organic growth. ISO 9001 cluster requires attention due to declining rankings.";

export const RECOMMENDED_FOCUS = [
  'ISO 27001 for Financial Services',
  'ISO 42001 Requirements',
  'ISO 14001 Update',
];
