import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { JOB_RUN_STATUSES, JOB_TRIGGERS, USER_ROLES } from '../../shared/api';

const instant = () => timestamp({ withTimezone: true });

export const userRole = pgEnum('user_role', USER_ROLES);

/** People allowed to sign in. Access is by this list, not by email domain. */
export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  /** Always stored lowercase. */
  email: text().notNull().unique(),
  name: text(),
  role: userRole().notNull().default('viewer'),
  active: boolean().notNull().default(true),
  createdAt: instant().notNull().defaultNow(),
  lastLoginAt: instant(),
});

export const sessions = pgTable(
  'sessions',
  {
    /** SHA-256 of the cookie token, so a leaked table cannot be replayed as cookies. */
    id: text().primaryKey(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: instant().notNull(),
    createdAt: instant().notNull().defaultNow(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const jobRunStatus = pgEnum('job_run_status', JOB_RUN_STATUSES);

export const jobTrigger = pgEnum('job_trigger', JOB_TRIGGERS);

/** One row per job attempt: the data behind Workflow Logs. */
export const jobRuns = pgTable(
  'job_runs',
  {
    id: uuid().primaryKey().defaultRandom(),
    queueJobId: text().notNull(),
    jobName: text().notNull(),
    trigger: jobTrigger().notNull(),
    status: jobRunStatus().notNull(),
    attempt: integer().notNull(),
    maxAttempts: integer().notNull(),
    input: jsonb(),
    output: jsonb(),
    error: text(),
    triggeredBy: uuid().references(() => users.id, { onDelete: 'set null' }),
    startedAt: instant().notNull().defaultNow(),
    finishedAt: instant(),
  },
  (table) => [
    index('job_runs_started_at_idx').on(table.startedAt),
    index('job_runs_job_name_started_at_idx').on(table.jobName, table.startedAt),
  ],
);

/** Last check-in of each worker process; the API watches it to detect a dead worker. */
export const workerHeartbeats = pgTable('worker_heartbeats', {
  workerId: text().primaryKey(),
  startedAt: instant().notNull(),
  lastSeenAt: instant().notNull(),
});
