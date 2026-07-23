import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  char,
  check,
  doublePrecision,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
};

export const users = pgTable(
  'users',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull(),
    email: text('email').notNull(),
    emailVerified: boolean('email_verified').default(false).notNull(),
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),
    image: text('image'),
    locale: varchar('locale', { length: 35 }).default('vi-VN').notNull(),
    role: varchar('role', { length: 20 }).default('user').notNull(),
    onboardingCompletedAt: timestamp('onboarding_completed_at', {
      withTimezone: true,
    }),
    ...timestamps,
    deletionRequestedAt: timestamp('deletion_requested_at', {
      withTimezone: true,
    }),
    purgeAfter: timestamp('purge_after', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    uniqueIndex('users_email_key').on(sql`lower(${table.email})`),
    index('users_purge_after_idx')
      .on(table.purgeAfter)
      .where(sql`${table.purgeAfter} is not null`),
    check('users_role_check', sql`${table.role} in ('user', 'admin')`),
    check(
      'users_deletion_timestamps_check',
      sql`(${table.purgeAfter} is null or ${table.deletionRequestedAt} is not null)
        and (${table.deletedAt} is null or ${table.deletionRequestedAt} is not null)
        and (${table.purgeAfter} is null or ${table.purgeAfter} >= ${table.deletionRequestedAt})`,
    ),
  ],
);

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    providerId: varchar('provider_id', { length: 64 }).notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }),
    scope: text('scope'),
    password: text('password'),
    ...timestamps,
  },
  (table) => [
    unique('accounts_provider_account_key').on(
      table.providerId,
      table.accountId,
    ),
    index('accounts_user_provider_idx').on(table.userId, table.providerId),
  ],
);

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    ...timestamps,
    ipAddress: inet('ip_address'),
    userAgent: text('user_agent'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    deviceLabel: varchar('device_label', { length: 120 }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    revokedReason: varchar('revoked_reason', { length: 40 }),
  },
  (table) => [
    index('sessions_user_expires_idx').on(table.userId, table.expiresAt),
    index('sessions_active_user_last_seen_idx')
      .on(table.userId, table.lastSeenAt)
      .where(sql`${table.revokedAt} is null`),
    check(
      'sessions_revoked_at_check',
      sql`${table.revokedAt} is null or ${table.revokedAt} >= ${table.createdAt}`,
    ),
  ],
);

export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ...timestamps,
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
  },
  (table) => [
    unique('verifications_identifier_value_key').on(
      table.identifier,
      table.value,
    ),
    index('verifications_expires_at_idx').on(table.expiresAt),
    index('verifications_identifier_expires_idx').on(
      table.identifier,
      table.expiresAt,
    ),
  ],
);

export const userPreferences = pgTable(
  'user_preferences',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id, { onDelete: 'cascade' }),
    theme: varchar('theme', { length: 16 }).default('system').notNull(),
    locale: varchar('locale', { length: 35 }).default('vi-VN').notNull(),
    personalizationEnabled: boolean('personalization_enabled')
      .default(true)
      .notNull(),
    explicitContentAllowed: boolean('explicit_content_allowed')
      .default(true)
      .notNull(),
    selectedMoods: text('selected_moods')
      .array()
      .default(sql`'{}'::text[]`)
      .notNull(),
    useCases: text('use_cases').array().default(sql`'{}'::text[]`).notNull(),
    ...timestamps,
  },
  (table) => [
    check(
      'user_preferences_theme_check',
      sql`${table.theme} in ('system', 'light', 'dark')`,
    ),
  ],
);

export const dataMigrations = pgTable(
  'data_migrations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    name: varchar('name', { length: 120 }).notNull().unique(),
    sourceHash: char('source_hash', { length: 64 }).notNull().unique(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    sourceCounts: jsonb('source_counts').default(sql`'{}'::jsonb`).notNull(),
    resultCounts: jsonb('result_counts'),
    errorSummary: varchar('error_summary', { length: 500 }),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    ...timestamps,
  },
  (table) => [
    check(
      'data_migrations_source_hash_check',
      sql`${table.sourceHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'data_migrations_status_check',
      sql`${table.status} in ('pending', 'running', 'completed', 'failed', 'rolled_back')`,
    ),
  ],
);

export const tracks = pgTable(
  'tracks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    legacyId: bigint('legacy_id', { mode: 'number' }).unique(),
    source: varchar('source', { length: 20 }).notNull(),
    sourceUrl: text('source_url').notNull(),
    canonicalSourceUrl: text('canonical_source_url').notNull().unique(),
    audioKey: char('audio_key', { length: 64 }).notNull().unique(),
    title: varchar('title', { length: 200 }).notNull(),
    author: varchar('author', { length: 120 }).notNull(),
    coverUrl: text('cover_url').default('').notNull(),
    durationSeconds: doublePrecision('duration_seconds').notNull(),
    category: varchar('category', { length: 64 }).default('others').notNull(),
    defaultStartSeconds: doublePrecision('default_start_seconds'),
    defaultEndSeconds: doublePrecision('default_end_seconds'),
    ...timestamps,
    migrationId: uuid('migration_id').references(() => dataMigrations.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    index('tracks_category_created_idx').on(table.category, table.createdAt),
    index('tracks_source_created_idx').on(table.source, table.createdAt),
    check('tracks_audio_key_check', sql`${table.audioKey} ~ '^[0-9a-f]{64}$'`),
    check('tracks_duration_check', sql`${table.durationSeconds} >= 0`),
    check(
      'tracks_start_check',
      sql`${table.defaultStartSeconds} is null or ${table.defaultStartSeconds} >= 0`,
    ),
    check(
      'tracks_end_check',
      sql`${table.defaultEndSeconds} is null or ${table.defaultEndSeconds} >= 0`,
    ),
    check(
      'tracks_range_check',
      sql`${table.defaultStartSeconds} is null or ${table.defaultEndSeconds} is null or ${table.defaultEndSeconds} > ${table.defaultStartSeconds}`,
    ),
  ],
);

export const guestImports = pgTable(
  'guest_imports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    idempotencyKey: uuid('idempotency_key').notNull(),
    payloadHash: char('payload_hash', { length: 64 }).notNull(),
    snapshotVersion: integer('snapshot_version').default(1).notNull(),
    snapshot: jsonb('snapshot').notNull(),
    previewExpiresAt: timestamp('preview_expires_at', {
      withTimezone: true,
    }).notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    requestedCounts: jsonb('requested_counts').notNull(),
    resultCounts: jsonb('result_counts'),
    conflicts: jsonb('conflicts'),
    errorCode: varchar('error_code', { length: 64 }),
    ...timestamps,
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [
    unique('guest_imports_user_idempotency_key').on(
      table.userId,
      table.idempotencyKey,
    ),
    index('guest_imports_user_created_idx').on(table.userId, table.createdAt),
    index('guest_imports_stale_processing_idx')
      .on(table.updatedAt)
      .where(sql`${table.status} = 'processing'`),
    check(
      'guest_imports_payload_hash_check',
      sql`${table.payloadHash} ~ '^[0-9a-f]{64}$'`,
    ),
    check(
      'guest_imports_status_check',
      sql`${table.status} in ('pending', 'processing', 'completed', 'failed')`,
    ),
    check(
      'guest_imports_snapshot_version_check',
      sql`${table.snapshotVersion} = 1`,
    ),
  ],
);

export const userLibraryTracks = pgTable(
  'user_library_tracks',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'restrict' }),
    addedAt: timestamp('added_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    sourceKind: varchar('source_kind', { length: 20 })
      .default('direct')
      .notNull(),
    guestImportId: uuid('guest_import_id').references(() => guestImports.id, {
      onDelete: 'set null',
    }),
    customTitle: varchar('custom_title', { length: 200 }),
    customAuthor: varchar('custom_author', { length: 120 }),
    startSeconds: doublePrecision('start_seconds'),
    endSeconds: doublePrecision('end_seconds'),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.trackId] }),
    index('user_library_tracks_user_added_idx').on(table.userId, table.addedAt),
    index('user_library_tracks_track_idx').on(table.trackId),
    check(
      'user_library_tracks_source_kind_check',
      sql`${table.sourceKind} in ('direct', 'guest_import', 'playlist_import', 'system')`,
    ),
    check(
      'user_library_tracks_start_check',
      sql`${table.startSeconds} is null or ${table.startSeconds} >= 0`,
    ),
    check(
      'user_library_tracks_end_check',
      sql`${table.endSeconds} is null or ${table.endSeconds} >= 0`,
    ),
    check(
      'user_library_tracks_range_check',
      sql`${table.startSeconds} is null or ${table.endSeconds} is null or ${table.endSeconds} > ${table.startSeconds}`,
    ),
  ],
);

export const favorites = pgTable(
  'favorites',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.trackId] }),
    index('favorites_user_created_idx').on(table.userId, table.createdAt),
    index('favorites_track_idx').on(table.trackId),
  ],
);

export const playlists = pgTable(
  'playlists',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ownerUserId: uuid('owner_user_id').references(() => users.id, {
      onDelete: 'cascade',
    }),
    kind: varchar('kind', { length: 16 }).default('user').notNull(),
    name: varchar('name', { length: 80 }).notNull(),
    visibility: varchar('visibility', { length: 16 })
      .default('private')
      .notNull(),
    shareId: varchar('share_id', { length: 32 }).unique(),
    sortOrder: integer('sort_order').default(0).notNull(),
    legacyId: bigint('legacy_id', { mode: 'number' }).unique(),
    ...timestamps,
    migrationId: uuid('migration_id').references(() => dataMigrations.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    index('playlists_owner_sort_idx').on(
      table.ownerUserId,
      table.sortOrder,
      table.id,
    ),
    index('playlists_public_updated_idx')
      .on(table.visibility, table.updatedAt)
      .where(sql`${table.visibility} <> 'private'`),
    check('playlists_kind_check', sql`${table.kind} in ('user', 'editorial')`),
    check(
      'playlists_visibility_check',
      sql`${table.visibility} in ('private', 'unlisted', 'public')`,
    ),
    check('playlists_sort_order_check', sql`${table.sortOrder} >= 0`),
    check(
      'playlists_owner_check',
      sql`(${table.kind} = 'user' and ${table.ownerUserId} is not null) or (${table.kind} = 'editorial' and ${table.ownerUserId} is null)`,
    ),
    check(
      'playlists_editorial_visibility_check',
      sql`${table.kind} <> 'editorial' or ${table.visibility} <> 'private'`,
    ),
  ],
);

export const playlistTracks = pgTable(
  'playlist_tracks',
  {
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'restrict' }),
    position: integer('position').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    addedByUserId: uuid('added_by_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    migrationId: uuid('migration_id').references(() => dataMigrations.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    primaryKey({ columns: [table.playlistId, table.trackId] }),
    unique('playlist_tracks_playlist_position_key').on(
      table.playlistId,
      table.position,
    ),
    index('playlist_tracks_playlist_position_idx').on(
      table.playlistId,
      table.position,
    ),
    index('playlist_tracks_track_idx').on(table.trackId),
    check('playlist_tracks_position_check', sql`${table.position} >= 0`),
  ],
);

export const autoRules = pgTable(
  'auto_rules',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    playlistId: uuid('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    keyword: varchar('keyword', { length: 120 }).notNull(),
    matchMode: varchar('match_mode', { length: 20 }).notNull(),
    ...timestamps,
  },
  (table) => [
    uniqueIndex('auto_rules_playlist_keyword_mode_key').on(
      table.playlistId,
      sql`lower(${table.keyword})`,
      table.matchMode,
    ),
    index('auto_rules_owner_created_idx').on(
      table.ownerUserId,
      table.createdAt,
    ),
    check(
      'auto_rules_match_mode_check',
      sql`${table.matchMode} in ('contains', 'starts_with')`,
    ),
  ],
);

export const listeningEvents = pgTable(
  'listening_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    trackId: uuid('track_id')
      .notNull()
      .references(() => tracks.id, { onDelete: 'restrict' }),
    eventId: uuid('event_id').notNull(),
    playedAt: timestamp('played_at', { withTimezone: true }).notNull(),
    durationListenedSeconds: doublePrecision(
      'duration_listened_seconds',
    ).notNull(),
    completionRatio: doublePrecision('completion_ratio').notNull(),
    classification: varchar('classification', { length: 16 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    unique('listening_events_user_event_key').on(table.userId, table.eventId),
    index('listening_events_user_played_idx').on(table.userId, table.playedAt),
    index('listening_events_user_track_played_idx').on(
      table.userId,
      table.trackId,
      table.playedAt,
    ),
    check(
      'listening_events_duration_check',
      sql`${table.durationListenedSeconds} >= 0`,
    ),
    check(
      'listening_events_ratio_check',
      sql`${table.completionRatio} between 0 and 1`,
    ),
    check(
      'listening_events_classification_check',
      sql`${table.classification} in ('started', 'skipped', 'partial', 'completed')`,
    ),
  ],
);

export const authAuditEvents = pgTable(
  'auth_audit_events',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    sessionId: uuid('session_id').references(() => sessions.id, {
      onDelete: 'set null',
    }),
    eventType: varchar('event_type', { length: 64 }).notNull(),
    outcome: varchar('outcome', { length: 16 }).notNull(),
    reasonCode: varchar('reason_code', { length: 64 }),
    providerId: varchar('provider_id', { length: 64 }),
    targetAccountId: uuid('target_account_id').references(() => accounts.id, {
      onDelete: 'set null',
    }),
    ipHash: char('ip_hash', { length: 64 }),
    userAgentSummary: varchar('user_agent_summary', { length: 255 }),
    metadata: jsonb('metadata').default(sql`'{}'::jsonb`).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index('auth_audit_events_user_created_idx').on(
      table.userId,
      table.createdAt,
    ),
    index('auth_audit_events_type_created_idx').on(
      table.eventType,
      table.createdAt,
    ),
    check(
      'auth_audit_events_outcome_check',
      sql`${table.outcome} in ('success', 'failure', 'denied')`,
    ),
    check(
      'auth_audit_events_ip_hash_check',
      sql`${table.ipHash} is null or ${table.ipHash} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const copyrightReports = pgTable(
  'copyright_reports',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    legacyId: bigint('legacy_id', { mode: 'number' }).unique(),
    sourceUrl: text('source_url').notNull(),
    normalizedUrl: text('normalized_url').notNull(),
    audioKey: char('audio_key', { length: 64 }).notNull(),
    trackId: uuid('track_id').references(() => tracks.id, {
      onDelete: 'set null',
    }),
    trackTitle: varchar('track_title', { length: 200 }),
    trackAuthor: varchar('track_author', { length: 120 }),
    reporterName: varchar('reporter_name', { length: 120 }).notNull(),
    reporterEmail: text('reporter_email').notNull(),
    rightsBasis: varchar('rights_basis', { length: 120 }).notNull(),
    details: text('details').notNull(),
    status: varchar('status', { length: 20 }).default('pending').notNull(),
    moderationNote: text('moderation_note'),
    ...timestamps,
    migrationId: uuid('migration_id').references(() => dataMigrations.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    index('copyright_reports_status_created_idx').on(
      table.status,
      table.createdAt,
    ),
    index('copyright_reports_track_idx').on(table.trackId),
    check(
      'copyright_reports_status_check',
      sql`${table.status} in ('pending', 'actioned', 'rejected')`,
    ),
    check(
      'copyright_reports_audio_key_check',
      sql`${table.audioKey} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);

export const blockedMedia = pgTable(
  'blocked_media',
  {
    audioKey: char('audio_key', { length: 64 }).primaryKey(),
    normalizedUrl: text('normalized_url').notNull().unique(),
    reportId: uuid('report_id')
      .notNull()
      .references(() => copyrightReports.id, { onDelete: 'restrict' }),
    trackId: uuid('track_id').references(() => tracks.id, {
      onDelete: 'set null',
    }),
    reason: text('reason').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    migrationId: uuid('migration_id').references(() => dataMigrations.id, {
      onDelete: 'restrict',
    }),
  },
  (table) => [
    index('blocked_media_report_idx').on(table.reportId),
    check(
      'blocked_media_audio_key_check',
      sql`${table.audioKey} ~ '^[0-9a-f]{64}$'`,
    ),
  ],
);
