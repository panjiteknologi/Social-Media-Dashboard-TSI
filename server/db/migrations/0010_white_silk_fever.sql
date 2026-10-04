ALTER TABLE "social_accounts" ALTER COLUMN "page_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_accounts" ALTER COLUMN "page_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "connection" text DEFAULT 'facebook' NOT NULL;--> statement-breakpoint
ALTER TABLE "social_accounts" ADD COLUMN "token_expires_at" timestamp with time zone;