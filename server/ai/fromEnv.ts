import { sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { aiUsage } from '../db/schema';
import type { Env } from '../env';
import { createAiGateway, type AiGateway } from './gateway';

/** The AI gateway, with usage stored in the database and the month counted in the app timezone. */
export function aiGatewayFromEnv(db: Db, env: Env): AiGateway {
  return createAiGateway({
    apiKey: env.OPENROUTER_API_KEY,
    baseUrl: env.OPENROUTER_BASE_URL,
    appName: env.OPENROUTER_APP_NAME,
    appUrl: env.OPENROUTER_APP_URL,
    monthlyBudgetUsd: env.AI_MONTHLY_BUDGET_USD,
    models: {
      report: env.AI_MODEL_REPORT,
      strategy: env.AI_MODEL_STRATEGY,
      article: env.AI_MODEL_ARTICLE,
      qa: env.AI_MODEL_QA,
    },
    store: {
      async spentThisMonth() {
        const [row] = await db
          .select({ spent: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8` })
          .from(aiUsage)
          .where(
            sql`${aiUsage.createdAt} >= (date_trunc('month', now() AT TIME ZONE ${env.TIMEZONE}) AT TIME ZONE ${env.TIMEZONE})`,
          );
        return row?.spent ?? 0;
      },
      async record(entry) {
        await db.insert(aiUsage).values(entry);
      },
    },
  });
}
