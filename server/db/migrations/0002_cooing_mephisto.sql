CREATE TABLE "articles" (
	"id" integer PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text,
	"status" text NOT NULL,
	"published_at" date,
	"modified_at" date,
	"author_name" text,
	"categories" text[] NOT NULL,
	"tags" text[] NOT NULL,
	"reading_time_minutes" integer,
	"seo_title" text,
	"seo_description" text,
	"seo_focus_keyword" text,
	"featured_image_url" text,
	"word_count" integer NOT NULL,
	"seo_score" integer NOT NULL,
	"seo_checks" jsonb NOT NULL,
	"cms_updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "ga4_channel_daily" (
	"date" date NOT NULL,
	"channel" text NOT NULL,
	"sessions" integer NOT NULL,
	"engaged_sessions" integer NOT NULL,
	"engagement_seconds" double precision NOT NULL,
	CONSTRAINT "ga4_channel_daily_date_channel_pk" PRIMARY KEY("date","channel")
);
--> statement-breakpoint
CREATE TABLE "ga4_event_daily" (
	"date" date NOT NULL,
	"event_name" text NOT NULL,
	"channel" text NOT NULL,
	"landing_page" text NOT NULL,
	"event_count" integer NOT NULL,
	CONSTRAINT "ga4_event_daily_date_event_name_channel_landing_page_pk" PRIMARY KEY("date","event_name","channel","landing_page")
);
--> statement-breakpoint
CREATE TABLE "ga4_landing_daily" (
	"date" date NOT NULL,
	"landing_page" text NOT NULL,
	"channel" text NOT NULL,
	"sessions" integer NOT NULL,
	"engaged_sessions" integer NOT NULL,
	"engagement_seconds" double precision NOT NULL,
	CONSTRAINT "ga4_landing_daily_date_landing_page_channel_pk" PRIMARY KEY("date","landing_page","channel")
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" integer PRIMARY KEY NOT NULL,
	"service_inquiry" text NOT NULL,
	"language" text NOT NULL,
	"source_page" text,
	"status" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "leads_created_at_idx" ON "leads" USING btree ("created_at");