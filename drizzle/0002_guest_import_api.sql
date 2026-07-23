ALTER TABLE "guest_imports" ADD COLUMN "snapshot_version" integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE "guest_imports" ADD COLUMN "snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL;
--> statement-breakpoint
ALTER TABLE "guest_imports" ADD COLUMN "preview_expires_at" timestamp with time zone DEFAULT now() NOT NULL;
--> statement-breakpoint
ALTER TABLE "guest_imports" ALTER COLUMN "snapshot" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "guest_imports" ALTER COLUMN "preview_expires_at" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "guest_imports" ADD CONSTRAINT "guest_imports_snapshot_version_check" CHECK ("guest_imports"."snapshot_version" = 1);
