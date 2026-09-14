CREATE TYPE "public"."job_run_status" AS ENUM('running', 'success', 'retrying', 'failed');--> statement-breakpoint
CREATE TYPE "public"."job_trigger" AS ENUM('schedule', 'manual', 'system');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'approver', 'editor', 'viewer');--> statement-breakpoint
CREATE TABLE "job_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"queue_job_id" text NOT NULL,
	"job_name" text NOT NULL,
	"trigger" "job_trigger" NOT NULL,
	"status" "job_run_status" NOT NULL,
	"attempt" integer NOT NULL,
	"max_attempts" integer NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"error" text,
	"triggered_by" uuid,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"role" "user_role" DEFAULT 'viewer' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "worker_heartbeats" (
	"worker_id" text PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "job_runs" ADD CONSTRAINT "job_runs_triggered_by_users_id_fk" FOREIGN KEY ("triggered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "job_runs_started_at_idx" ON "job_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "job_runs_job_name_started_at_idx" ON "job_runs" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");