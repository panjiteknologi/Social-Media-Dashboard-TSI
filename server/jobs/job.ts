import type { JobTrigger } from '../../shared/api';

/** The payload every queued job carries, whatever started it. */
export interface JobEnvelope {
  trigger: JobTrigger;
  triggeredBy?: string;
  input?: unknown;
}

export interface JobDefinition {
  /** Queue name. Letters, digits and hyphens. */
  name: string;
  description: string;
  /** Retries allowed after the first attempt fails. */
  retryLimit: number;
  /** Seconds before the first retry; later retries back off exponentially. */
  retryDelaySeconds: number;
  /** Cron expression in the app timezone, for jobs that run on their own. */
  schedule?: string;
  /** Whether an admin may start the job by hand. */
  manual: boolean;
  /** Validates its own input; the queue only guarantees JSON. */
  run(input: unknown, signal: AbortSignal): Promise<unknown>;
}
