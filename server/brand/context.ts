import type { BrandKnowledge } from '../../shared/brand';

const LANGUAGE_NAMES = { id: 'Indonesian', en: 'English' } as const;

/**
 * The knowledge base as one block for an AI system prompt. The impartiality
 * rules come first and are marked as binding: a draft still applies.
 */
export function buildBrandContext(knowledge: BrandKnowledge): string {
  const approval =
    knowledge.impartialityStatus === 'approved'
      ? `approved by ${knowledge.impartialityApprovedBy} on ${knowledge.impartialityApprovedOn}`
      : 'a draft awaiting compliance approval, binding all the same';

  const examples = knowledge.exampleArticles
    .map((article) => `- ${article.title} (${article.url})${article.reason ? `: ${article.reason}` : ''}`)
    .join('\n');

  const { ai } = knowledge;
  return [
    'You write for PT TSI Sertifikasi Internasional, an independent third-party certification body in Indonesia.',
    'Follow every rule below. When a request would break an impartiality rule, do not write that part; say which rule it breaks.',
    '',
    `## Impartiality rules (${approval})`,
    knowledge.impartialityRules,
    '',
    '## Company profile (use only these facts about TSI)',
    knowledge.companyProfile,
    '',
    '## Tone of voice',
    knowledge.toneOfVoice,
    '',
    '## Calls to action',
    knowledge.ctaRules,
    '',
    '## Article settings',
    `- Language: ${LANGUAGE_NAMES[ai.language]}.`,
    `- Length: ${ai.minWords}–${ai.maxWords} words.`,
    `- FAQ section: ${ai.includeFaq ? 'add 3–5 questions when the topic suits it' : 'do not add one'}.`,
    ai.authorLine ? `- Byline: "${ai.authorLine}".` : '- Byline: none.',
    '',
    '## Articles that perform well on this site (match their structure and depth, never copy their text)',
    examples || '- None listed yet.',
  ].join('\n');
}
