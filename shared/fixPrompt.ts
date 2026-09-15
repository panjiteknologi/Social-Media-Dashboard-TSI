/**
 * Turns the open SEO Action Center tasks into one prompt for a coding
 * assistant working in the website repository: every issue with its evidence
 * and recommended action, where the fix belongs, and how to work.
 */
import type { SeoAction, SeoActionsResponse } from './actions';
import { formatDate } from './seo';
import type { HealthCheckKey, TechnicalHealth } from './technical';

/** Affected pages listed per site-wide task; the rest are counted. */
const MAX_PAGES_PER_TASK = 25;

interface Section {
  title: string;
  kinds: string[];
  /** Where the fix belongs, so the assistant does not force a CMS or Search Console fix into code. */
  whereToFix: string;
}

const SECTIONS: Section[] = [
  {
    title: 'Broken pages',
    kinds: ['broken_page'],
    whereToFix:
      'Usually a link in a page template or component. When the linking page is a blog article (/blog/…), the link is inside the article body stored in the CMS: tell me the article and the exact link to change instead of editing code.',
  },
  {
    title: 'Pages with a low click-through rate in Google',
    kinds: ['low_ctr'],
    whereToFix:
      'Titles and meta descriptions of fixed pages live in this repository; for blog articles they are the SEO title and description fields in the CMS. Propose the new text first and wait for my approval.',
  },
  {
    title: 'Slow pages on mobile',
    kinds: ['technical_slowPages'],
    whereToFix:
      'Code and hosting: check the Vercel region and caching of server-rendered pages, image sizes and formats, fonts, and scripts loaded on every page.',
  },
  {
    title: 'Pages Google has not indexed',
    kinds: ['technical_index'],
    whereToFix:
      'Code can help: each page should return 200, be in the sitemap, have a self-referencing canonical, a unique title and internal links from related pages. Requesting indexing happens in Google Search Console: list the pages that matter most for me.',
  },
  {
    title: 'Duplicate titles',
    kinds: ['technical_duplicateTitles'],
    whereToFix:
      'Page titles in the layout or page files; for blog articles, the SEO title field in the CMS. Indonesian pages (/id/…) need their own Indonesian titles. Propose the titles first and wait for my approval.',
  },
  {
    title: 'Canonical tag problems',
    kinds: ['technical_canonical'],
    whereToFix:
      'The page head in the layout. Some Indonesian pages point their canonical at the English version: check whether that is intentional and ask me before changing it.',
  },
  {
    title: 'Missing titles, descriptions, alt text or structured data',
    kinds: ['technical_metadata', 'technical_altText', 'technical_schema'],
    whereToFix: 'Layouts and components in this repository; for images inside blog articles, the CMS.',
  },
  {
    title: 'Pages and keywords losing rankings',
    kinds: ['keyword_at_risk', 'ranking_decline', 'page_decline'],
    whereToFix:
      'Content work. Review each page against what searchers look for and propose concrete improvements (sections to add, facts to update, internal links) before editing anything.',
  },
  {
    title: 'Keyword cannibalization',
    kinds: ['cannibalization'],
    whereToFix:
      'A content decision. Recommend which page should be the primary one and what to do with the others. Do not merge, redirect or delete pages without my approval.',
  },
  {
    title: 'SEO opportunities',
    kinds: ['opportunity'],
    whereToFix: 'Optional. Suggest how the site could target these keywords better; change nothing without my approval.',
  },
];

const PRIORITY_ORDER: Record<SeoAction['priority'], number> = { P1: 0, P2: 1, P3: 2 };

function target(action: SeoAction, host: string): string {
  if (action.target.startsWith('http')) return action.target;
  if (action.target === host) return `https://${host} (site-wide)`;
  return `the Google search "${action.target}"`;
}

function taskLines(action: SeoAction, host: string, technical: TechnicalHealth | null): string[] {
  if (action.kind.startsWith('technical_')) {
    const key = action.kind.slice('technical_'.length) as HealthCheckKey;
    const check = technical?.checks.find((item) => item.key === key && item.state === 'issues');
    const lines = [`- ${action.issue}`, `  Recommended action: ${action.action}`];
    if (!check) return [...lines, `  Examples: ${action.detail}`];
    lines.push('  Affected pages:');
    for (const issue of check.issues.slice(0, MAX_PAGES_PER_TASK)) lines.push(`  - ${issue.url}: ${issue.note}`);
    const listed = Math.min(check.issues.length, MAX_PAGES_PER_TASK);
    if (check.count > listed) {
      lines.push(`  - …and ${check.count - listed} more, listed under Technical SEO Health in Content Machine`);
    }
    return lines;
  }
  return [
    `- ${action.issue}: ${target(action, host)}`,
    `  Evidence: ${action.detail}`,
    `  Recommended action: ${action.action}`,
  ];
}

/** The prompt for the open tasks, or null when there are none. */
export function buildFixPrompt(input: {
  actions: SeoActionsResponse;
  technical: TechnicalHealth | null;
  /** YYYY-MM-DD */
  generatedOn: string;
}): string | null {
  const host = input.actions.contentHost;
  const open = input.actions.actions
    .filter((action) => action.status !== 'done')
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
  if (open.length === 0) return null;

  const { technical } = input;
  const crawlDate = technical?.crawledAt?.slice(0, 10);
  const sources = [
    technical?.crawledAt
      ? `a crawl of ${technical.pagesCrawled} URLs${crawlDate === input.generatedOn ? '' : ` on ${formatDate(crawlDate!)}`}`
      : null,
    technical?.inspectedAt ? 'Google URL Inspection' : null,
    technical?.pagespeedAt ? 'PageSpeed Insights' : null,
    'Google Search Console data for the last 28 days',
  ].filter((source): source is string => Boolean(source));
  const sourceList =
    sources.length > 1 ? `${sources.slice(0, -1).join(', ')} and ${sources[sources.length - 1]}` : sources[0];

  const lines: string[] = [
    `# Fix SEO issues on ${host}`,
    '',
    `Content Machine, the TSI marketing dashboard, found these issues on ${formatDate(input.generatedOn)}, from ${sourceList}.`,
    '',
    '## Context',
    `- The website https://${host} is built with Astro and hosted on Vercel.`,
    '- Blog articles (/blog/…) come from a custom CMS (Next.js with a Neon Postgres database). Article bodies and their SEO titles and descriptions are stored in the CMS, not in this repository.',
    '- Pages exist in English and in Indonesian (/id/…). Keep all text in the language of its page.',
    '',
    '## How to work',
    '1. Verify each issue before changing anything: open the URL or find the code. Tell me about any issue you cannot reproduce.',
    '2. Fix what can be fixed in this repository.',
    '3. When a fix belongs in the CMS or in Google Search Console, do not work around it in code. List it for me with exact steps.',
    '4. For new titles, meta descriptions and page content, propose the text first and wait for my approval.',
    '5. Make one commit per type of issue. Do not push until I say so.',
    '6. Finish with a summary in four lists: fixed in code, needs a CMS edit, needs Google Search Console, could not reproduce.',
    '',
    `## Issues (${open.length} tasks, most urgent first)`,
  ];

  const known = new Set(SECTIONS.flatMap((section) => section.kinds));
  const sections = [
    ...SECTIONS,
    { title: 'Other issues', kinds: [...new Set(open.map((action) => action.kind).filter((kind) => !known.has(kind)))], whereToFix: 'Check where the fix belongs before changing anything.' },
  ];

  let number = 0;
  for (const section of sections) {
    const tasks = open.filter((action) => section.kinds.includes(action.kind));
    if (tasks.length === 0) continue;
    number++;
    lines.push('', `### ${number}. ${section.title}`, `Where to fix: ${section.whereToFix}`, '');
    for (const task of tasks) lines.push(...taskLines(task, host, technical));
  }

  return lines.join('\n');
}
