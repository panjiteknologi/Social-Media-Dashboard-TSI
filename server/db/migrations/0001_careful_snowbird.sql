CREATE TABLE "app_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "gsc_daily" (
	"date" date PRIMARY KEY NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"position" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gsc_page_daily" (
	"date" date NOT NULL,
	"page" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"position" double precision NOT NULL,
	CONSTRAINT "gsc_page_daily_date_page_pk" PRIMARY KEY("date","page")
);
--> statement-breakpoint
CREATE TABLE "gsc_query_daily" (
	"date" date NOT NULL,
	"query" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"position" double precision NOT NULL,
	CONSTRAINT "gsc_query_daily_date_query_pk" PRIMARY KEY("date","query")
);
--> statement-breakpoint
CREATE TABLE "gsc_query_page_daily" (
	"date" date NOT NULL,
	"query" text NOT NULL,
	"page" text NOT NULL,
	"clicks" integer NOT NULL,
	"impressions" integer NOT NULL,
	"position" double precision NOT NULL
);
--> statement-breakpoint
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "gsc_page_daily_page_idx" ON "gsc_page_daily" USING btree ("page");--> statement-breakpoint
CREATE INDEX "gsc_query_daily_query_idx" ON "gsc_query_daily" USING btree ("query");--> statement-breakpoint
CREATE INDEX "gsc_query_page_daily_date_idx" ON "gsc_query_page_daily" USING btree ("date");