CREATE TABLE "seo_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"priority" text NOT NULL,
	"issue" text NOT NULL,
	"target" text NOT NULL,
	"action" text NOT NULL,
	"detail" text NOT NULL,
	"status" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" text,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "seo_actions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
ALTER TABLE "seo_actions" ADD CONSTRAINT "seo_actions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;