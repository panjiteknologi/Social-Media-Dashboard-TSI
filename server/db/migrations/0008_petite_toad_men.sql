ALTER TABLE "content_items" ADD COLUMN "cms_post_id" integer;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "cms_slug" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "cms_status" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "publish_status" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "publish_error" text;--> statement-breakpoint
ALTER TABLE "content_items" ADD COLUMN "publish_updated_at" timestamp with time zone;