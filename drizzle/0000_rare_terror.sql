CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" varchar(255) NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"user_id" uuid NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_provider_account_key" UNIQUE("provider_id","account_id")
);
--> statement-breakpoint
CREATE TABLE "auth_audit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"actor_user_id" uuid,
	"session_id" uuid,
	"event_type" varchar(64) NOT NULL,
	"outcome" varchar(16) NOT NULL,
	"reason_code" varchar(64),
	"provider_id" varchar(64),
	"target_account_id" uuid,
	"ip_hash" char(64),
	"user_agent_summary" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_audit_events_outcome_check" CHECK ("auth_audit_events"."outcome" in ('success', 'failure', 'denied')),
	CONSTRAINT "auth_audit_events_ip_hash_check" CHECK ("auth_audit_events"."ip_hash" is null or "auth_audit_events"."ip_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "auto_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"playlist_id" uuid NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"keyword" varchar(120) NOT NULL,
	"match_mode" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auto_rules_match_mode_check" CHECK ("auto_rules"."match_mode" in ('contains', 'starts_with'))
);
--> statement-breakpoint
CREATE TABLE "blocked_media" (
	"audio_key" char(64) PRIMARY KEY NOT NULL,
	"normalized_url" text NOT NULL,
	"report_id" uuid NOT NULL,
	"track_id" uuid,
	"reason" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "blocked_media_normalized_url_unique" UNIQUE("normalized_url"),
	CONSTRAINT "blocked_media_audio_key_check" CHECK ("blocked_media"."audio_key" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "copyright_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" bigint,
	"source_url" text NOT NULL,
	"normalized_url" text NOT NULL,
	"audio_key" char(64) NOT NULL,
	"track_id" uuid,
	"track_title" varchar(200),
	"track_author" varchar(120),
	"reporter_name" varchar(120) NOT NULL,
	"reporter_email" text NOT NULL,
	"rights_basis" varchar(120) NOT NULL,
	"details" text NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"moderation_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "copyright_reports_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "copyright_reports_status_check" CHECK ("copyright_reports"."status" in ('pending', 'actioned', 'rejected')),
	CONSTRAINT "copyright_reports_audio_key_check" CHECK ("copyright_reports"."audio_key" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
CREATE TABLE "data_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"source_hash" char(64) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"source_counts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"result_counts" jsonb,
	"error_summary" varchar(500),
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "data_migrations_name_unique" UNIQUE("name"),
	CONSTRAINT "data_migrations_source_hash_check" CHECK ("data_migrations"."source_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "data_migrations_status_check" CHECK ("data_migrations"."status" in ('pending', 'running', 'completed', 'failed', 'rolled_back'))
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "favorites_user_id_track_id_pk" PRIMARY KEY("user_id","track_id")
);
--> statement-breakpoint
CREATE TABLE "guest_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"payload_hash" char(64) NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"requested_counts" jsonb NOT NULL,
	"result_counts" jsonb,
	"conflicts" jsonb,
	"error_code" varchar(64),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	CONSTRAINT "guest_imports_user_idempotency_key" UNIQUE("user_id","idempotency_key"),
	CONSTRAINT "guest_imports_payload_hash_check" CHECK ("guest_imports"."payload_hash" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "guest_imports_status_check" CHECK ("guest_imports"."status" in ('pending', 'processing', 'completed', 'failed'))
);
--> statement-breakpoint
CREATE TABLE "listening_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	"played_at" timestamp with time zone NOT NULL,
	"duration_listened_seconds" double precision NOT NULL,
	"completion_ratio" double precision NOT NULL,
	"classification" varchar(16) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "listening_events_user_event_key" UNIQUE("user_id","event_id"),
	CONSTRAINT "listening_events_duration_check" CHECK ("listening_events"."duration_listened_seconds" >= 0),
	CONSTRAINT "listening_events_ratio_check" CHECK ("listening_events"."completion_ratio" between 0 and 1),
	CONSTRAINT "listening_events_classification_check" CHECK ("listening_events"."classification" in ('started', 'skipped', 'partial', 'completed'))
);
--> statement-breakpoint
CREATE TABLE "playlist_tracks" (
	"playlist_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by_user_id" uuid,
	CONSTRAINT "playlist_tracks_playlist_id_track_id_pk" PRIMARY KEY("playlist_id","track_id"),
	CONSTRAINT "playlist_tracks_playlist_position_key" UNIQUE("playlist_id","position") DEFERRABLE INITIALLY IMMEDIATE,
	CONSTRAINT "playlist_tracks_position_check" CHECK ("playlist_tracks"."position" >= 0)
);
--> statement-breakpoint
CREATE TABLE "playlists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_user_id" uuid,
	"kind" varchar(16) DEFAULT 'user' NOT NULL,
	"name" varchar(80) NOT NULL,
	"visibility" varchar(16) DEFAULT 'private' NOT NULL,
	"share_id" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"legacy_id" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "playlists_share_id_unique" UNIQUE("share_id"),
	CONSTRAINT "playlists_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "playlists_kind_check" CHECK ("playlists"."kind" in ('user', 'editorial')),
	CONSTRAINT "playlists_visibility_check" CHECK ("playlists"."visibility" in ('private', 'unlisted', 'public')),
	CONSTRAINT "playlists_sort_order_check" CHECK ("playlists"."sort_order" >= 0),
	CONSTRAINT "playlists_owner_check" CHECK (("playlists"."kind" = 'user' and "playlists"."owner_user_id" is not null) or ("playlists"."kind" = 'editorial' and "playlists"."owner_user_id" is null)),
	CONSTRAINT "playlists_editorial_visibility_check" CHECK ("playlists"."kind" <> 'editorial' or "playlists"."visibility" <> 'private')
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" varchar(255) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip_address" "inet",
	"user_agent" text,
	"user_id" uuid NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"device_label" varchar(120),
	"revoked_at" timestamp with time zone,
	"revoked_reason" varchar(40),
	CONSTRAINT "sessions_token_unique" UNIQUE("token"),
	CONSTRAINT "sessions_revoked_at_check" CHECK ("sessions"."revoked_at" is null or "sessions"."revoked_at" >= "sessions"."created_at")
);
--> statement-breakpoint
CREATE TABLE "tracks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"legacy_id" bigint,
	"source" varchar(20) NOT NULL,
	"source_url" text NOT NULL,
	"canonical_source_url" text NOT NULL,
	"audio_key" char(64) NOT NULL,
	"title" varchar(200) NOT NULL,
	"author" varchar(120) NOT NULL,
	"cover_url" text DEFAULT '' NOT NULL,
	"duration_seconds" double precision NOT NULL,
	"category" varchar(64) DEFAULT 'others' NOT NULL,
	"default_start_seconds" double precision,
	"default_end_seconds" double precision,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tracks_legacy_id_unique" UNIQUE("legacy_id"),
	CONSTRAINT "tracks_canonical_source_url_unique" UNIQUE("canonical_source_url"),
	CONSTRAINT "tracks_audio_key_unique" UNIQUE("audio_key"),
	CONSTRAINT "tracks_audio_key_check" CHECK ("tracks"."audio_key" ~ '^[0-9a-f]{64}$'),
	CONSTRAINT "tracks_duration_check" CHECK ("tracks"."duration_seconds" >= 0),
	CONSTRAINT "tracks_start_check" CHECK ("tracks"."default_start_seconds" is null or "tracks"."default_start_seconds" >= 0),
	CONSTRAINT "tracks_end_check" CHECK ("tracks"."default_end_seconds" is null or "tracks"."default_end_seconds" >= 0),
	CONSTRAINT "tracks_range_check" CHECK ("tracks"."default_start_seconds" is null or "tracks"."default_end_seconds" is null or "tracks"."default_end_seconds" > "tracks"."default_start_seconds")
);
--> statement-breakpoint
CREATE TABLE "user_library_tracks" (
	"user_id" uuid NOT NULL,
	"track_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_kind" varchar(20) DEFAULT 'direct' NOT NULL,
	"guest_import_id" uuid,
	"custom_title" varchar(200),
	"custom_author" varchar(120),
	"start_seconds" double precision,
	"end_seconds" double precision,
	CONSTRAINT "user_library_tracks_user_id_track_id_pk" PRIMARY KEY("user_id","track_id"),
	CONSTRAINT "user_library_tracks_source_kind_check" CHECK ("user_library_tracks"."source_kind" in ('direct', 'guest_import', 'playlist_import', 'system')),
	CONSTRAINT "user_library_tracks_start_check" CHECK ("user_library_tracks"."start_seconds" is null or "user_library_tracks"."start_seconds" >= 0),
	CONSTRAINT "user_library_tracks_end_check" CHECK ("user_library_tracks"."end_seconds" is null or "user_library_tracks"."end_seconds" >= 0),
	CONSTRAINT "user_library_tracks_range_check" CHECK ("user_library_tracks"."start_seconds" is null or "user_library_tracks"."end_seconds" is null or "user_library_tracks"."end_seconds" > "user_library_tracks"."start_seconds")
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"theme" varchar(16) DEFAULT 'system' NOT NULL,
	"locale" varchar(35) DEFAULT 'vi-VN' NOT NULL,
	"personalization_enabled" boolean DEFAULT true NOT NULL,
	"explicit_content_allowed" boolean DEFAULT true NOT NULL,
	"selected_moods" text[] DEFAULT '{}'::text[] NOT NULL,
	"use_cases" text[] DEFAULT '{}'::text[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_theme_check" CHECK ("user_preferences"."theme" in ('system', 'light', 'dark'))
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(120) NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verified_at" timestamp with time zone,
	"image" text,
	"locale" varchar(35) DEFAULT 'vi-VN' NOT NULL,
	"role" varchar(20) DEFAULT 'user' NOT NULL,
	"onboarding_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deletion_requested_at" timestamp with time zone,
	"purge_after" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_role_check" CHECK ("users"."role" in ('user', 'admin')),
	CONSTRAINT "users_deletion_timestamps_check" CHECK (("users"."purge_after" is null or "users"."deletion_requested_at" is not null)
        and ("users"."deleted_at" is null or "users"."deletion_requested_at" is not null)
        and ("users"."purge_after" is null or "users"."purge_after" >= "users"."deletion_requested_at"))
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "verifications_identifier_value_key" UNIQUE("identifier","value")
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_audit_events" ADD CONSTRAINT "auth_audit_events_target_account_id_accounts_id_fk" FOREIGN KEY ("target_account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_rules" ADD CONSTRAINT "auto_rules_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auto_rules" ADD CONSTRAINT "auto_rules_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_media" ADD CONSTRAINT "blocked_media_report_id_copyright_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "public"."copyright_reports"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "blocked_media" ADD CONSTRAINT "blocked_media_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "copyright_reports" ADD CONSTRAINT "copyright_reports_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guest_imports" ADD CONSTRAINT "guest_imports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_events" ADD CONSTRAINT "listening_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listening_events" ADD CONSTRAINT "listening_events_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_playlist_id_playlists_id_fk" FOREIGN KEY ("playlist_id") REFERENCES "public"."playlists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlist_tracks" ADD CONSTRAINT "playlist_tracks_added_by_user_id_users_id_fk" FOREIGN KEY ("added_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playlists" ADD CONSTRAINT "playlists_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_tracks" ADD CONSTRAINT "user_library_tracks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_tracks" ADD CONSTRAINT "user_library_tracks_track_id_tracks_id_fk" FOREIGN KEY ("track_id") REFERENCES "public"."tracks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_library_tracks" ADD CONSTRAINT "user_library_tracks_guest_import_id_guest_imports_id_fk" FOREIGN KEY ("guest_import_id") REFERENCES "public"."guest_imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_provider_idx" ON "accounts" USING btree ("user_id","provider_id");--> statement-breakpoint
CREATE INDEX "auth_audit_events_user_created_idx" ON "auth_audit_events" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "auth_audit_events_type_created_idx" ON "auth_audit_events" USING btree ("event_type","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "auto_rules_playlist_keyword_mode_key" ON "auto_rules" USING btree ("playlist_id",lower("keyword"),"match_mode");--> statement-breakpoint
CREATE INDEX "auto_rules_owner_created_idx" ON "auto_rules" USING btree ("owner_user_id","created_at");--> statement-breakpoint
CREATE INDEX "blocked_media_report_idx" ON "blocked_media" USING btree ("report_id");--> statement-breakpoint
CREATE INDEX "copyright_reports_status_created_idx" ON "copyright_reports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "copyright_reports_track_idx" ON "copyright_reports" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "favorites_user_created_idx" ON "favorites" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "favorites_track_idx" ON "favorites" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "guest_imports_user_created_idx" ON "guest_imports" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "guest_imports_stale_processing_idx" ON "guest_imports" USING btree ("updated_at") WHERE "guest_imports"."status" = 'processing';--> statement-breakpoint
CREATE INDEX "listening_events_user_played_idx" ON "listening_events" USING btree ("user_id","played_at");--> statement-breakpoint
CREATE INDEX "listening_events_user_track_played_idx" ON "listening_events" USING btree ("user_id","track_id","played_at");--> statement-breakpoint
CREATE INDEX "playlist_tracks_playlist_position_idx" ON "playlist_tracks" USING btree ("playlist_id","position");--> statement-breakpoint
CREATE INDEX "playlist_tracks_track_idx" ON "playlist_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE INDEX "playlists_owner_sort_idx" ON "playlists" USING btree ("owner_user_id","sort_order","id");--> statement-breakpoint
CREATE INDEX "playlists_public_updated_idx" ON "playlists" USING btree ("visibility","updated_at") WHERE "playlists"."visibility" <> 'private';--> statement-breakpoint
CREATE INDEX "sessions_user_expires_idx" ON "sessions" USING btree ("user_id","expires_at");--> statement-breakpoint
CREATE INDEX "sessions_active_user_last_seen_idx" ON "sessions" USING btree ("user_id","last_seen_at") WHERE "sessions"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "tracks_category_created_idx" ON "tracks" USING btree ("category","created_at");--> statement-breakpoint
CREATE INDEX "tracks_source_created_idx" ON "tracks" USING btree ("source","created_at");--> statement-breakpoint
CREATE INDEX "user_library_tracks_user_added_idx" ON "user_library_tracks" USING btree ("user_id","added_at");--> statement-breakpoint
CREATE INDEX "user_library_tracks_track_idx" ON "user_library_tracks" USING btree ("track_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "users_purge_after_idx" ON "users" USING btree ("purge_after") WHERE "users"."purge_after" is not null;--> statement-breakpoint
CREATE INDEX "verifications_expires_at_idx" ON "verifications" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_expires_idx" ON "verifications" USING btree ("identifier","expires_at");