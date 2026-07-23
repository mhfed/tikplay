# PostgreSQL foundation

This directory contains TikPlay's PostgreSQL foundation. Issue #20 cuts the public track/category/source catalog reads and authenticated library/favorite records to PostgreSQL after the issue #19 catalog import. Legacy JSON remains in use only by routes not yet cut over; do not fall back to JSON for these cut-over domains because that could expose shared legacy favorites or split personal writes.

## Wave 3 API contract

- `GET /api/tracks`, `GET /api/categories`, and `GET /api/sources` are public and return UUID catalog records. They never include personal favorite/library state.
- `GET|POST /api/library/tracks` and `GET|POST /api/favorites` require a validated database session and return `Cache-Control: private, no-store`.
- Membership/favorite mutations accept exactly `{ trackId: UUID, saved: boolean }` or `{ trackId: UUID, favorite: boolean }`. Identity is always `session.user.id`; owner fields are rejected as `VALIDATION_ERROR`.
- Missing referenced tracks return stable `404 NOT_FOUND`. Missing/invalid sessions return stable `401 AUTH_REQUIRED` before body parsing or writes. Unexpected database failures return stable `503 TRANSIENT_ERROR`.
- Favoriting atomically ensures library membership. Unfavoriting does not remove library membership.
- Existing Wave 2 UI still consumes legacy numeric records and is intentionally not wired to these UUID personal endpoints in this issue; that integration belongs to Wave 4.

## Environment

Runtime access uses `DATABASE_URL`. Prefer the provider's pooled runtime URL when available. Migration tooling uses `DATABASE_MIGRATION_URL` first and falls back to `DATABASE_URL`; use a direct/non-pooled migration URL when the provider's pooler does not safely support DDL or migration locks.

Optional runtime pool settings are validated when PostgreSQL is first accessed:

| Variable                              | Default |  Accepted range |
| ------------------------------------- | ------: | --------------: |
| `DATABASE_POOL_MAX`                   |     `5` |        `1`–`20` |
| `DATABASE_POOL_IDLE_TIMEOUT_MS`       | `30000` | `1000`–`300000` |
| `DATABASE_POOL_CONNECTION_TIMEOUT_MS` |  `5000` |  `1000`–`60000` |

The client is lazy: importing the schema/client, typechecking, and building do not require `DATABASE_URL`. Calling `getPostgresDb()` or `getPostgresPool()` without it produces a focused runtime error. `closePostgres()` closes the singleton pool for tests and controlled shutdown. TLS behavior comes from the connection URL/provider configuration; this code never disables certificate verification globally.

Keep all URLs and credentials in the deployment secret manager. Runtime and migration roles should be separate: the runtime role needs application DML, while the migration role owns reviewed DDL.

## Migration workflow

Generate and review migrations with the pinned Drizzle Kit version:

```sh
DATABASE_MIGRATION_URL='postgresql://…' npx drizzle-kit generate --config drizzle.config.ts
DATABASE_MIGRATION_URL='postgresql://…' npx drizzle-kit migrate --config drizzle.config.ts
```

Use `generate`, not `push`. Never run migrations automatically during application startup. Apply reviewed SQL first to an isolated ephemeral database, inspect constraints/indexes, then follow the staged rollout gates. Drizzle owns SQL generation and its `public.__drizzle_migrations` journal; Better Auth's `migrate` command is not used.

The initial migration includes a reviewed SQL-only `DEFERRABLE INITIALLY IMMEDIATE` modifier on `playlist_tracks_playlist_position_key`. Drizzle tracks the unique constraint in its schema snapshot, but its PostgreSQL schema DSL does not emit the deferrability modifier. Preserve and re-review this modifier when regenerating the initial migration.

## Better Auth schema evidence

The pinned CLI was run with a temporary minimal configuration using UUID generation, the Drizzle/PostgreSQL adapter target, and the magic-link plugin:

```sh
npx auth@1.6.24 generate --adapter drizzle --dialect postgresql
```

The generated evidence requires four auth models: user, account, session, and verification. Magic link reuses verification storage and adds no separate table. The committed schema preserves the generated property contract required by Better Auth (`accountId`, `providerId`, `userId`, session `token`, verification `identifier`/`value`, and generated timestamp fields) while using the plan's plural SQL table names.

Reviewed differences from raw CLI output:

- UUID primary keys are retained, but timestamps use timezone-aware PostgreSQL columns.
- Auth tables are pluralized to match the accepted data model; a future Better Auth adapter configuration must map these model names explicitly.
- User profile, role, verification timestamp, and soft-delete fields are additive.
- Session revocation/device fields and verification cleanup/consumption fields are additive.
- Case-insensitive email uniqueness uses `lower(email)` instead of the `citext` extension, avoiding an extension dependency.
- Required security and lookup constraints/indexes are stronger than the minimal generated output.
- Better Auth generates non-null `user.name`; this schema keeps it non-null for adapter compatibility. Magic-link account creation must supply the product-approved fallback display name in the later auth issue.
- Better Auth update hooks are application-side behavior and do not become database triggers; later repositories must explicitly maintain `updated_at`.

No provider, email transport, auth route, production secret, or session behavior is configured in this foundation.

## Ownership

Auth-owned tables are `users`, `accounts`, `sessions`, and `verifications`.

Global catalog/compliance/operations tables are `tracks`, `copyright_reports`, `blocked_media`, and `data_migrations`. These records are not owned by ordinary users. Drizzle manages its separate migration journal.

User-owned application tables are `user_preferences`, `user_library_tracks`, `favorites`, user-kind `playlists`, `playlist_tracks`, `auto_rules`, `listening_events`, and `guest_imports`. `auth_audit_events` is security-owned operational data with nullable user references. Editorial playlists have no user owner and must be non-private.

Foreign-key deletion actions intentionally preserve global catalog/legal records while cascading purged user-owned records. Track references generally restrict catalog deletion; legal/audit references use reviewed set-null or restrict behavior.

## Deletion and retention

Account deletion is soft deletion first. A later transactional service must set `deletion_requested_at`, `deleted_at`, and `purge_after` to at least the request time (policy: request time plus 30 days), revoke active sessions, and block ordinary login. The schema indexes purge candidates and enforces coherent timestamps. After the recovery window, deleting the user cascades personal records while shared tracks remain.

Listening events have a 180-day retention policy. Auth audit events have a planned 365-day baseline pending privacy approval. Expired/consumed verification records also require scheduled cleanup. This issue provides storage and indexes only; purge workers belong to later operational work and must be idempotent and observable.

## Rollout, rollback, and restore

This is a schema-only additive rollout. Do not convert existing routes, dual-write, or import legacy JSON in this phase. Later issues must perform dry-run inventory, idempotent import, row/count/hash reconciliation, shadow validation, and an explicit cutover before PostgreSQL becomes authoritative.

Before applying in any shared environment, take and verify a restorable backup and record migration identity. Additive schema deployment can be rolled back operationally by leaving application reads on JSON; avoid destructive down migrations after data is written. If restoration is required, restore into an isolated database first, validate migration journal and reconciliation evidence, then follow the incident runbook rather than editing migration history in place.
