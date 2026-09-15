import { desc, eq, isNotNull } from 'drizzle-orm';
import type { SeoSettings } from '../../shared/seo';
import type { TechnicalHealth } from '../../shared/technical';
import type { Db } from '../db/client';
import { indexInspections, pagespeedResults, siteCrawls, sitePages } from '../db/schema';
import { summarizeHealth } from './summary';

/** Technical health from the latest finished crawl and the stored index and speed results. */
export async function getTechnicalHealth(
  db: Db,
  settings: SeoSettings,
  pagespeedConfigured: boolean,
): Promise<TechnicalHealth> {
  const [crawl] = await db
    .select()
    .from(siteCrawls)
    .where(isNotNull(siteCrawls.finishedAt))
    .orderBy(desc(siteCrawls.startedAt))
    .limit(1);

  const noPages: Array<typeof sitePages.$inferSelect> = [];
  const [pages, inspections, speeds] = await Promise.all([
    crawl ? db.select().from(sitePages).where(eq(sitePages.crawlId, crawl.id)) : Promise.resolve(noPages),
    db.select().from(indexInspections),
    db.select().from(pagespeedResults),
  ]);

  return summarizeHealth({
    contentHost: settings.contentHost,
    crawledAt: crawl?.finishedAt ?? null,
    truncated: crawl?.truncated ?? false,
    pages,
    inspections,
    speeds,
    pagespeedConfigured,
  });
}
