CREATE TABLE "ai_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"feature" text NOT NULL,
	"model" text NOT NULL,
	"prompt_tokens" integer NOT NULL,
	"completion_tokens" integer NOT NULL,
	"cost_usd" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"title" text NOT NULL,
	"data" jsonb NOT NULL,
	"summary" text,
	"focus" jsonb NOT NULL,
	"ai_model" text,
	"ai_note" text,
	"message" text NOT NULL,
	"telegram_sent_at" timestamp with time zone,
	"telegram_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ai_usage_created_at_idx" ON "ai_usage" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "reports_kind_period_start_idx" ON "reports" USING btree ("kind","period_start");