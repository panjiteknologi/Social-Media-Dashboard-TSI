import type { JobRunStatus } from '../../shared/api';
import type { JobDefinition, JobEnvelope } from './job';

/** The parts of a queued job the runner needs; pg-boss jobs fetched with metadata satisfy it. */
export interface QueuedJob {
  id: string;
  data: JobEnvelope;
  retryCount: number;
  retryLimit: number;
  signal: AbortSignal;
}

export interface RunRecorder {
  start(run: {
    queueJobId: string;
    jobName: string;
    trigger: JobEnvelope['trigger'];
    triggeredBy: string | null;
    attempt: number;
    maxAttempts: number;
    input: unknown;
  }): Promise<string>;
  finish(
    runId: string,
    result: { status: Exclude<JobRunStatus, 'running'>; output?: unknown; error?: string },
  ): Promise<void>;
}

export interface Alerter {
  send(text: string): Promise<void>;
}

export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Runs one attempt of a queued job and records it.
 *
 * Rethrows on failure so the queue schedules the retry. Only the last attempt
 * raises an alert: a failure that a retry fixes is not worth waking anyone for.
 */
export async function executeJob(
  definition: JobDefinition,
  job: QueuedJob,
  deps: { recorder: RunRecorder; alerter: Alerter },
): Promise<unknown> {
  const attempt = job.retryCount + 1;
  const maxAttempts = job.retryLimit + 1;

  const runId = await deps.recorder.start({
    queueJobId: job.id,
    jobName: definition.name,
    trigger: job.data.trigger,
    triggeredBy: job.data.triggeredBy ?? null,
    attempt,
    maxAttempts,
    input: job.data.input ?? null,
  });

  try {
    const output = await definition.run(job.data.input, job.signal);
    await deps.recorder.finish(runId, { status: 'success', output: output ?? null });
    return output;
  } catch (error) {
    const message = errorMessage(error);
    const isFinalAttempt = attempt >= maxAttempts;
    await deps.recorder.finish(runId, {
      status: isFinalAttempt ? 'failed' : 'retrying',
      error: message,
    });

    if (isFinalAttempt) {
      try {
        await deps.alerter.send(
          `Job failed: ${definition.name}\nAttempt ${attempt} of ${maxAttempts}\n${message}`,
        );
      } catch (alertError) {
        console.error(`[jobs] Could not send the failure alert for ${definition.name}:`, alertError);
      }
    }
    throw error;
  }
}
