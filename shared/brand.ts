/**
 * The brand knowledge base (Settings > Brand and AI): what the AI must know and
 * follow when it writes for PT TSI Sertifikasi Internasional.
 */

export const IMPARTIALITY_STATUSES = ['draft', 'approved'] as const;

export type ImpartialityStatus = (typeof IMPARTIALITY_STATUSES)[number];

export const ARTICLE_LANGUAGES = ['id', 'en'] as const;

export type ArticleLanguage = (typeof ARTICLE_LANGUAGES)[number];

export interface ExampleArticle {
  url: string;
  title: string;
  /** Why it is a good example, so the team can judge the list. */
  reason: string;
}

export interface ArticleAiSettings {
  language: ArticleLanguage;
  minWords: number;
  maxWords: number;
  /** Add a short FAQ section when the topic suits it. */
  includeFaq: boolean;
  /** The byline under each article. */
  authorLine: string;
}

export interface BrandKnowledge {
  companyProfile: string;
  toneOfVoice: string;
  ctaRules: string;
  impartialityRules: string;
  /** The rules apply either way; "approved" records that compliance signed them off. */
  impartialityStatus: ImpartialityStatus;
  impartialityApprovedBy: string | null;
  /** YYYY-MM-DD */
  impartialityApprovedOn: string | null;
  exampleArticles: ExampleArticle[];
  ai: ArticleAiSettings;
}

export interface BrandSettingsResponse {
  knowledge: BrandKnowledge;
  /** Null while the knowledge base still holds the defaults nobody has saved. */
  savedAt: string | null;
  savedBy: string | null;
  /** Active users who may approve content: approvers and admins. */
  approvers: Array<{ email: string; name: string | null; role: string }>;
  /** The model each AI feature uses, from the server configuration. */
  models: Array<{ feature: string; model: string }>;
}
