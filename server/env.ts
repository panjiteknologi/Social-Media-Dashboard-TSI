import { existsSync } from 'node:fs';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_BASE_URL: z.url().default('http://localhost:5173'),
  API_PORT: z.coerce.number().int().positive().default(8787),
  TIMEZONE: z.string().default('Asia/Jakarta'),
  DATABASE_URL: z.string({ error: 'DATABASE_URL is required' }).min(1),
  INITIAL_ADMIN_EMAIL: z.email().optional(),
  AUTH_DEV_LOGIN_EMAIL: z.email().optional(),
  GOOGLE_OAUTH_CLIENT_ID: z.string().optional(),
  GOOGLE_OAUTH_CLIENT_SECRET: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_JSON_PATH: z.string().optional(),
  GSC_SITE_URL: z.string().optional(),
  GA4_PROPERTY_ID: z
    .string()
    .regex(/^\d+$/, 'GA4_PROPERTY_ID is the numeric property id, not the G-XXXX measurement id')
    .optional(),
  PAGESPEED_API_KEY: z.string().optional(),
  CMS_DATABASE_URL: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_BASE_URL: z.url().default('https://openrouter.ai/api/v1'),
  OPENROUTER_APP_NAME: z.string().default('Content Machine'),
  OPENROUTER_APP_URL: z.url().optional(),
  AI_MONTHLY_BUDGET_USD: z.coerce.number().nonnegative().default(50),
  AI_MODEL_REPORT: z.string().default('anthropic/claude-sonnet-5'),
  AI_MODEL_ARTICLE: z.string().default('anthropic/claude-opus-5'),
  // Sonnet follows the brand rules closely enough for briefs and QA at a third of the cost;
  // the draft itself stays on Opus, where the quality difference shows.
  AI_MODEL_QA: z.string().default('anthropic/claude-sonnet-5'),
  AI_MODEL_STRATEGY: z.string().default('anthropic/claude-sonnet-5'),
  AI_MODEL_CLASSIFY: z.string().default('anthropic/claude-haiku-4.5'),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_CHAT_ID: z.string().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates configuration from a raw environment.
 *
 * Blank values count as unset, so a template line like `TELEGRAM_BOT_TOKEN=`
 * reads as "not configured" instead of failing validation.
 */
export function parseEnv(raw: Record<string, string | undefined>): Env {
  const present = Object.fromEntries(
    Object.entries(raw).filter(([, value]) => value !== undefined && value.trim() !== ''),
  );
  const result = EnvSchema.safeParse(present);
  if (!result.success) {
    throw new Error(`Invalid configuration:\n${z.prettifyError(result.error)}`);
  }

  const env = result.data;
  if (env.NODE_ENV === 'production' && env.AUTH_DEV_LOGIN_EMAIL) {
    throw new Error(
      'AUTH_DEV_LOGIN_EMAIL must not be set in production: it signs a user in without Google.',
    );
  }
  return env;
}

let cached: Env | undefined;

/** Loads `.env` into the process environment when present, then validates it once. */
export function getEnv(): Env {
  if (!cached) {
    if (existsSync('.env')) process.loadEnvFile('.env');
    cached = parseEnv(process.env);
  }
  return cached;
}
