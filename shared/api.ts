/** Shapes shared by the API server and the web app. */

export const USER_ROLES = ['admin', 'approver', 'editor', 'viewer'] as const;

export type UserRole = (typeof USER_ROLES)[number];

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: UserRole;
}

export const JOB_RUN_STATUSES = ['running', 'success', 'retrying', 'failed'] as const;

export type JobRunStatus = (typeof JOB_RUN_STATUSES)[number];

export const JOB_TRIGGERS = ['schedule', 'manual', 'system'] as const;

export type JobTrigger = (typeof JOB_TRIGGERS)[number];

/** One attempt of a background job, as listed in Workflow Logs. */
export interface JobRun {
  id: string;
  jobName: string;
  trigger: JobTrigger;
  status: JobRunStatus;
  attempt: number;
  maxAttempts: number;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

/** One run with everything Workflow Logs shows when it is opened. */
export interface JobRunDetail extends JobRun {
  input: unknown;
  output: unknown;
  triggeredByName: string | null;
}

export interface AiUsageSummary {
  configured: boolean;
  budgetUsd: number;
  spentUsd: number;
  calls: number;
  byFeature: Array<{ feature: string; calls: number; costUsd: number; tokens: number }>;
}
