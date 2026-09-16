CREATE TABLE "topic_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"keyword" text NOT NULL,
	"title" text NOT NULL,
	"intent" text NOT NULL,
	"action" text NOT NULL,
	"existing_url" text,
	"angle" text NOT NULL,
	"reason" text NOT NULL,
	"cluster" text,
	"impressions" integer NOT NULL,
	"position" double precision NOT NULL,
	"opportunity_score" integer,
	"status" text NOT NULL,
	"content_item_id" uuid,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "brief" jsonb;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "draft" jsonb;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "qa" jsonb;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "ai_task" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "ai_status" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "ai_error" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "ai_updated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "topic_recommendations" ADD CONSTRAINT "topic_recommendations_content_item_id_content_items_id_fk" FOREIGN KEY ("content_item_id") REFERENCES "public"."content_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "topic_recommendations_status_idx" ON "topic_recommendations" USING btree ("status");