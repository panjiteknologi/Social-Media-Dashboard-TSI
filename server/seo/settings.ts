import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { DEFAULT_SEO_SETTINGS, type SeoSettings } from '../../shared/seo';
import type { Db } from '../db/client';
import { appSettings } from '../db/schema';

const terms = z.array(z.string().trim().min(1).max(100)).max(200);

export const SeoSettingsSchema = z.object({
  minImpressions: z.number().int().min(1).max(10_000),
  brandTerms: terms,
  priorityKeywords: terms,
  dataStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format'),
  contentHost: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9.-]+$/, 'Use a host name such as tsicertification.com'),
});

const SEO_SETTINGS_KEY = 'seo';

/** Lowercased, trimmed and without duplicates, so matching is predictable. */
const normalizeTerms = (list: string[]): string[] => [
  ...new Set(list.map((term) => term.trim().toLowerCase()).filter(Boolean)),
];

/**
 * Stored SEO settings over the defaults, so a setting added in a later release
 * has a value before anyone saves it. Unreadable stored values fall back to
 * the defaults rather than breaking every SEO screen.
 */
export async function getSeoSettings(db: Db): Promise<SeoSettings> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, SEO_SETTINGS_KEY))
    .limit(1);
  const parsed = SeoSettingsSchema.safeParse({ ...DEFAULT_SEO_SETTINGS, ...(row?.value as object | undefined) });
  return parsed.success ? parsed.data : DEFAULT_SEO_SETTINGS;
}

export async function saveSeoSettings(db: Db, settings: SeoSettings, userId: string | null): Promise<void> {
  const value: SeoSettings = {
    ...settings,
    brandTerms: normalizeTerms(settings.brandTerms),
    priorityKeywords: normalizeTerms(settings.priorityKeywords),
  };
  const now = new Date();
  await db
    .insert(appSettings)
    .values({ key: SEO_SETTINGS_KEY, value, updatedBy: userId, updatedAt: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updatedBy: userId, updatedAt: now } });
}
