# Guest import API (issue #23)

This wave adds authenticated server APIs only. It does not add the Wave 4 import UI.

## Contract

All responses are `Cache-Control: private, no-store`; identity is always the validated session user. Import IDs belonging to another user are returned as not found.

- `POST /api/import/preview` accepts `{ idempotencyKey: UUID, snapshot }`. The snapshot must use `version: 1` and is normalized before its SHA-256 payload hash is persisted. Preview writes only the `guest_imports` control record; it never mutates catalog, library, or playlist records.
- `POST /api/import/commit` accepts `{ id: UUID, payloadHash: 64-lowercase-hex }`. The hash must match the preview and the preview must not have expired.
- `GET /api/import/status/:id` returns the owned control record and result counts.

Snapshot version 1 contains `tracks` and `playlists`. Input is bounded to 1 MB, 2,000 tracks, 200 playlists, and 2,000 references per playlist. Strings and numeric ranges are also bounded. Unsupported versions and malformed values fail before persistence.

## Identity and dedupe

Tracks are canonicalized by normalized source URL and, when supplied, a validated audio key. Duplicate snapshot tracks are collapsed by audio key first and canonical URL otherwise. PostgreSQL's unique catalog constraints remain the final concurrency guard. Existing global catalog tracks are linked to the user's library; new canonical tracks are created once.

Playlist names are resolved against names owned by the importing user inside the commit transaction. Conflicts deterministically become `Name (2)`, `Name (3)`, and so on. Duplicate track references in one playlist create one link.

## Retry, concurrency, and rollback

`(user_id, idempotency_key)` is unique and bound to the normalized payload hash. Repeating the same key and payload returns the same preview/result; using that key with another payload returns `CONFLICT`. A completed commit returns the persisted completed result.

Commit takes a transaction-scoped PostgreSQL advisory lock derived from the import ID. Concurrent commits therefore serialize and create one logical import. All catalog inserts, memberships, playlists, playlist links, result counts, and completion status share one transaction. Any mid-import exception rolls the transaction back; no partial import is committed.

Previews expire after 15 minutes. Commit after expiry returns `STALE_PREVIEW` without importing data. Clients must create a new preview and idempotency key after expiry.

## Verification

`npm run test:guest-import` runs pure canonicalization/planner tests and source-level API/repository contract tests. It does not connect to PostgreSQL. Runtime schema behavior is covered by reviewed constraints and the additive `0002_guest_import_api` migration; apply migrations through the documented Drizzle workflow.
