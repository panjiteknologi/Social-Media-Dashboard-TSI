import { eq } from 'drizzle-orm';
import type { Db } from '../db/client';
import { jobRuns } from '../db/schema';
import type { RunRecorder } from './runner';

export function createDbRecorder(db: Db): RunRecorder {
  return {
    async start(run) {
      const [row] = await db
        .insert(jobRuns)
        .values({ ...run, status: 'running' })
        .returning({ id: jobRuns.id });
      return row.id;
    },
    async finish(runId, result) {
      await db
        .update(jobRuns)
        .set({
          status: result.status,
          output: result.output ?? null,
          error: result.error ?? null,
          finishedAt: new Date(),
        })
        .where(eq(jobRuns.id, runId));
    },
  };
}
