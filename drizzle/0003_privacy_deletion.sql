ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "purge_after" timestamp with time zone;
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp with time zone;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_purge_after_idx" ON "users" ("purge_after") WHERE "purge_after" IS NOT NULL;
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_deletion_timestamps_check" CHECK (("purge_after" IS NULL OR "deletion_requested_at" IS NOT NULL) AND ("deleted_at" IS NULL OR "deletion_requested_at" IS NOT NULL) AND ("purge_after" IS NULL OR "purge_after" >= "deletion_requested_at"));
