ALTER TABLE "data_migrations" ADD CONSTRAINT "data_migrations_source_hash_unique" UNIQUE("source_hash");
--> statement-breakpoint
ALTER TABLE "tracks" ADD COLUMN "migration_id" uuid;
--> statement-breakpoint
ALTER TABLE "playlists" ADD COLUMN "migration_id" uuid;
--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD COLUMN "migration_id" uuid;
--> statement-breakpoint
ALTER TABLE "copyright_reports" ADD COLUMN "migration_id" uuid;
--> statement-breakpoint
ALTER TABLE "blocked_media" ADD COLUMN "migration_id" uuid;
--> statement-breakpoint
ALTER TABLE "tracks" ADD CONSTRAINT "tracks_migration_id_data_migrations_id_fk" FOREIGN KEY ("migration_id") REFERENCES "public"."data_migrations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_migration_id_data_migrations_id_fk" FOREIGN KEY ("migration_id") REFERENCES "public"."data_migrations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_migration_id_data_migrations_id_fk" FOREIGN KEY ("migration_id") REFERENCES "public"."data_migrations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "copyright_reports" ADD CONSTRAINT "copyright_reports_migration_id_data_migrations_id_fk" FOREIGN KEY ("migration_id") REFERENCES "public"."data_migrations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "blocked_media" ADD CONSTRAINT "blocked_media_migration_id_data_migrations_id_fk" FOREIGN KEY ("migration_id") REFERENCES "public"."data_migrations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "tracks_migration_idx" ON "tracks" USING btree ("migration_id");
--> statement-breakpoint
CREATE INDEX "playlists_migration_idx" ON "playlists" USING btree ("migration_id");
--> statement-breakpoint
CREATE INDEX "playlist_tracks_migration_idx" ON "playlist_tracks" USING btree ("migration_id");
--> statement-breakpoint
CREATE INDEX "copyright_reports_migration_idx" ON "copyright_reports" USING btree ("migration_id");
--> statement-breakpoint
CREATE INDEX "blocked_media_migration_idx" ON "blocked_media" USING btree ("migration_id");
