CREATE TABLE "index_inspections" (
	"url" text PRIMARY KEY NOT NULL,
	"verdict" text NOT NULL,
	"coverage_state" text,
	"indexing_state" text,
	"page_fetch_state" text,
	"robots_txt_state" text,
	"google_canonical" text,
	"user_canonical" text,
	"last_crawl_time" timestamp with time zone,
	"inspected_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pagespeed_results" (
	"url" text PRIMARY KEY NOT NULL,
	"score" double precision,
	"lcp_ms" double precision,
	"cls" double precision,
	"tbt_ms" double precision,
	"field_category" text,
	"checked_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_crawls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"pages_checked" integer DEFAULT 0 NOT NULL,
	"truncated" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "site_pages" (
	"crawl_id" uuid NOT NULL,
	"url" text NOT NULL,
	"sources" text[] NOT NULL,
	"status" integer NOT NULL,
	"redirect_to" text,
	"content_type" text,
	"response_ms" integer NOT NULL,
	"title" text,
	"description" text,
	"canonical" text,
	"noindex" boolean NOT NULL,
	"h1_count" integer NOT NULL,
	"images_missing_alt" integer NOT NULL,
	"json_ld" text[] NOT NULL,
	"linked_from" text[] NOT NULL,
	"error" text,
	CONSTRAINT "site_pages_crawl_id_url_pk" PRIMARY KEY("crawl_id","url")
);
--> statement-breakpoint
ALTER TABLE "site_pages" ADD CONSTRAINT "site_pages_crawl_id_site_crawls_id_fk" FOREIGN KEY ("crawl_id") REFERENCES "public"."site_crawls"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "site_crawls_started_at_idx" ON "site_crawls" USING btree ("started_at");