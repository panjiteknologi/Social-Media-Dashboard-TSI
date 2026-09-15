import { sql } from 'drizzle-orm';
import type { AiUsageSummary } from '../../shared/api';
import type { Db } from '../db/client';
import { aiUsage } from '../db/schema';
import type { Env } from '../env';

/** AI calls and spend this calendar month in the app timezone, against the monthly budget. */
export async function aiUsageThisMonth(db: Db, env: Env): Promise<AiUsageSummary> {
  const rows = await db
    .select({
      feature: aiUsage.feature,
      calls: sql<number>`count(*)::int`,
      costUsd: sql<number>`coalesce(sum(${aiUsage.costUsd}), 0)::float8`,
      tokens: sql<number>`coalesce(sum(${aiUsage.promptTokens} + ${aiUsage.completionTokens}), 0)::int`,
    })
    .from(aiUsage)
    .where(
      sql`${aiUsage.createdAt} >= (date_trunc('month', now() AT TIME ZONE ${env.TIMEZONE}) AT TIME ZONE ${env.TIMEZONE})`,
    )
    .groupBy(aiUsage.feature);

  return {
    configured: Boolean(env.OPENROUTER_API_KEY),
    budgetUsd: env.AI_MONTHLY_BUDGET_USD,
    spentUsd: rows.reduce((sum, row) => sum + row.costUsd, 0),
    calls: rows.reduce((sum, row) => sum + row.calls, 0),
    byFeature: rows.sort((a, b) => b.costUsd - a.costUsd),
  };
}
