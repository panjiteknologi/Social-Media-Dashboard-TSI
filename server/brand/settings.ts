import { and, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  ARTICLE_LANGUAGES,
  IMPARTIALITY_STATUSES,
  type BrandKnowledge,
  type BrandSettingsResponse,
} from '../../shared/brand';
import type { Db } from '../db/client';
import { appSettings, users } from '../db/schema';
import type { Env } from '../env';
import { DEFAULT_BRAND_KNOWLEDGE } from './defaults';

const BRAND_SETTINGS_KEY = 'brand';

const longText = (label: string) => z.string().trim().min(1, `${label} cannot be empty.`).max(30_000);

export const BrandKnowledgeSchema = z
  .object({
    companyProfile: longText('The company profile'),
    toneOfVoice: longText('Tone of voice'),
    ctaRules: longText('The CTA rules'),
    impartialityRules: longText('The impartiality rules'),
    impartialityStatus: z.enum(IMPARTIALITY_STATUSES),
    impartialityApprovedBy: z.string().trim().max(200).nullable(),
    impartialityApprovedOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    exampleArticles: z
      .array(
        z.object({
          url: z.url('Each example needs a full URL.'),
          title: z.string().trim().min(1).max(300),
          reason: z.string().trim().max(1000),
        }),
      )
      .max(20),
    ai: z.object({
      language: z.enum(ARTICLE_LANGUAGES),
      minWords: z.number().int().min(200).max(5000),
      maxWords: z.number().int().min(200).max(8000),
      includeFaq: z.boolean(),
      authorLine: z.string().trim().max(200),
    }),
  })
  .refine((value) => value.ai.minWords <= value.ai.maxWords, {
    message: 'The minimum word count cannot be above the maximum.',
    path: ['ai', 'minWords'],
  })
  .refine((value) => value.impartialityStatus === 'draft' || (value.impartialityApprovedBy && value.impartialityApprovedOn), {
    message: 'Approved impartiality rules need who approved them and when.',
    path: ['impartialityApprovedBy'],
  });

export async function getBrandKnowledge(db: Db): Promise<BrandKnowledge> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, BRAND_SETTINGS_KEY))
    .limit(1);
  if (!row) return DEFAULT_BRAND_KNOWLEDGE;
  const stored = row.value as Partial<BrandKnowledge>;
  const parsed = BrandKnowledgeSchema.safeParse({
    ...DEFAULT_BRAND_KNOWLEDGE,
    ...stored,
    ai: { ...DEFAULT_BRAND_KNOWLEDGE.ai, ...stored.ai },
  });
  return parsed.success ? parsed.data : DEFAULT_BRAND_KNOWLEDGE;
}

export async function saveBrandKnowledge(db: Db, knowledge: BrandKnowledge, userId: string | null): Promise<void> {
  const value: BrandKnowledge =
    knowledge.impartialityStatus === 'draft'
      ? { ...knowledge, impartialityApprovedBy: null, impartialityApprovedOn: null }
      : knowledge;
  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key: BRAND_SETTINGS_KEY, value, updatedBy: userId, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: userId, updatedAt: now } });
}

/** The knowledge base with who saved it, who can approve content, and the AI models in use. */
export async function getBrandSettings(db: Db, env: Env): Promise<BrandSettingsResponse> {
  const [[saved], approvers, knowledge] = await Promise.all([
    db
      .select({ updatedAt: appSettings.updatedAt, name: users.name, email: users.email })
      .from(appSettings)
      .leftJoin(users, eq(users.id, appSettings.updatedBy))
      .where(eq(appSettings.key, BRAND_SETTINGS_KEY))
      .limit(1),
    db
      .select({ email: users.email, name: users.name, role: users.role })
      .from(users)
      .where(and(eq(users.active, true), inArray(users.role, ['approver', 'admin'])))
      .orderBy(users.email),
    getBrandKnowledge(db),
  ]);

  return {
    knowledge,
    savedAt: saved?.updatedAt.toISOString() ?? null,
    savedBy: saved ? (saved.name ?? saved.email ?? null) : null,
    approvers,
    models: [
      { feature: 'Article drafts and revisions', model: env.AI_MODEL_ARTICLE },
      { feature: 'QA before approval', model: env.AI_MODEL_QA },
      { feature: 'Briefs and topic recommendations', model: env.AI_MODEL_STRATEGY },
      { feature: 'Search intent and clustering', model: env.AI_MODEL_CLASSIFY },
      { feature: 'Report summaries', model: env.AI_MODEL_REPORT },
    ],
  };
}
