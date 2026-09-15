import {
  boolean,
  date,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { JOB_RUN_STATUSES, JOB_TRIGGERS, USER_ROLES } from '../../shared/api';
import type { SeoCheck } from '../../shared/content';

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

/** Team-editable settings, one JSON document per area, keyed like "seo". */
export const appSettings = pgTable('app_settings', {
  key: text().primaryKey(),
  value: jsonb().notNull(),
  updatedAt: instant().notNull().defaultNow(),
  updatedBy: uuid().references(() => users.id, { onDelete: 'set null' }),
});

// ---------------------------------------------------------------------------
// Search Console, stored at four levels of detail. Each level is fetched from
// Google separately because the numbers differ by level: queries Google
// anonymises are missing from every level that includes the query, and a
// query's position counts only its best-ranking page.

const searchMetrics = () => ({
  clicks: integer().notNull(),
  impressions: integer().notNull(),
  /** Google's average position for the row; combine rows weighted by impressions. */
  position: doublePrecision().notNull(),
});

/** Totals for the whole property per day. Headline numbers come from here. */
export const gscDaily = pgTable('gsc_daily', {
  date: date({ mode: 'string' }).primaryKey(),
  ...searchMetrics(),
});

/** Per day and query. Keyword positions come from here. */
export const gscQueryDaily = pgTable(
  'gsc_query_daily',
  {
    date: date({ mode: 'string' }).notNull(),
    query: text().notNull(),
    ...searchMetrics(),
  },
  (table) => [
    primaryKey({ columns: [table.date, table.query] }),
    index('gsc_query_daily_query_idx').on(table.query),
  ],
);

/** Per day and page. */
export const gscPageDaily = pgTable(
  'gsc_page_daily',
  {
    date: date({ mode: 'string' }).notNull(),
    page: text().notNull(),
    ...searchMetrics(),
  },
  (table) => [primaryKey({ columns: [table.date, table.page] }), index('gsc_page_daily_page_idx').on(table.page)],
);

/** Per day, query and page: which pages rank for a query, for landing pages and cannibalization. */
export const gscQueryPageDaily = pgTable(
  'gsc_query_page_daily',
  {
    date: date({ mode: 'string' }).notNull(),
    query: text().notNull(),
    page: text().notNull(),
    ...searchMetrics(),
  },
  (table) => [index('gsc_query_page_daily_date_idx').on(table.date)],
);

// ---------------------------------------------------------------------------
// Website content from the CMS database, replaced in full by every CMS sync.

/** The CMS's articles (its blog_posts table), with the CMS's SEO checklist worked out at sync time. */
export const articles = pgTable('articles', {
  /** The CMS's id. */
  id: integer().primaryKey(),
  slug: text().notNull().unique(),
  title: text().notNull(),
  excerpt: text(),
  /** As the CMS stores it: publish, scheduling or draft. */
  status: text().notNull(),
  publishedAt: date({ mode: 'string' }),
  modifiedAt: date({ mode: 'string' }),
  authorName: text(),
  categories: text().array().notNull(),
  tags: text().array().notNull(),
  readingTimeMinutes: integer(),
  seoTitle: text(),
  seoDescription: text(),
  seoFocusKeyword: text(),
  featuredImageUrl: text(),
  wordCount: integer().notNull(),
  seoScore: integer().notNull(),
  seoChecks: jsonb().$type<SeoCheck[]>().notNull(),
  cmsUpdatedAt: instant().notNull(),
});

/**
 * Contact form submissions, without anything that identifies the sender: the
 * CMS role Content Machine reads with cannot see those columns.
 */
export const leads = pgTable(
  'leads',
  {
    /** The CMS's id. */
    id: integer().primaryKey(),
    serviceInquiry: text().notNull(),
    language: text().notNull(),
    sourcePage: text(),
    status: text().notNull(),
    createdAt: instant().notNull(),
    updatedAt: instant().notNull(),
  },
  (table) => [index('leads_created_at_idx').on(table.createdAt)],
);

// ---------------------------------------------------------------------------
// Google Analytics 4, per day. Everything is stored per channel so organic
// search can be told apart from other traffic.

const sessionMetrics = () => ({
  sessions: integer().notNull(),
  engagedSessions: integer().notNull(),
  /** Total engagement time in seconds; divide by sessions for the average. */
  engagementSeconds: doublePrecision().notNull(),
});

/** Sessions per day and channel. Traffic totals come from here. */
export const ga4ChannelDaily = pgTable(
  'ga4_channel_daily',
  {
    date: date({ mode: 'string' }).notNull(),
    channel: text().notNull(),
    ...sessionMetrics(),
  },
  (table) => [primaryKey({ columns: [table.date, table.channel] })],
);

/** Sessions per day, landing page and channel: visits that started on each page. */
export const ga4LandingDaily = pgTable(
  'ga4_landing_daily',
  {
    date: date({ mode: 'string' }).notNull(),
    landingPage: text().notNull(),
    channel: text().notNull(),
    ...sessionMetrics(),
  },
  (table) => [primaryKey({ columns: [table.date, table.landingPage, table.channel] })],
);

/** The website's tracked events (TRACKED_EVENTS) per day, channel and landing page. */
export const ga4EventDaily = pgTable(
  'ga4_event_daily',
  {
    date: date({ mode: 'string' }).notNull(),
    eventName: text().notNull(),
    channel: text().notNull(),
    landingPage: text().notNull(),
    eventCount: integer().notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.eventName, table.channel, table.landingPage] })],
);
