# Legacy JSON to PostgreSQL migration

This runbook covers issue #19's one-time catalog migration. It imports the global track catalog, selected editorial playlists, copyright reports, and blocked-media rows. It intentionally does **not** import favorites, listening history, user playlists, auto-rules, settings, or any user identity data.

## Safety model

- Dry-run is the default and performs no writes: no backup, report file, or database connection.
- Import and rollback require `DATABASE_MIGRATION_URL` (preferred) or `DATABASE_URL`.
- Import copies the exact source JSON to a new, exclusive backup file before opening a transaction.
- PostgreSQL writes run in one transaction. Any validation, constraint, or connection error rolls the transaction back.
- The SHA-256 is computed from exact source bytes. `data_migrations.source_hash` is unique; a completed hash is a no-op, while any other existing status fails safely for operator review.
- Every inserted row carries `migration_id`, enabling scoped rollback without touching unrelated data.
- Audio keys and cover/cache references are copied verbatim. Invalid audio keys are reported and not guessed or regenerated.
- Compliance rows are preserved. Blocked rows whose report is missing are reported as orphans and rejected.
- Colliding catalog keys are reported and all involved tracks are withheld rather than selecting an arbitrary winner.

Apply the Drizzle migrations before importing:

```sh
npx drizzle-kit migrate
```

## Dry-run and reconciliation

Editorial playlists are deny-by-default. Repeat `--editorial-playlist` for each explicitly approved legacy numeric ID:

```sh
npm run migrate:legacy:dry-run -- --source data/tikplay.json --editorial-playlist 2 --editorial-playlist 7
```

The JSON printed to stdout includes exact source SHA-256; source/import/skipped counts; canonical URL, audio-key, and ID collisions; orphan links/rows; non-contiguous or duplicate order findings; and all blocked keys. Resolve collisions and compliance orphans before import. Order findings are informational: imported editorial positions are reconciled to contiguous zero-based order while preserving legacy relative order.

## Import

```sh
DATABASE_MIGRATION_URL='postgresql://...' npm run migrate:legacy:import -- \
  --source data/tikplay.json \
  --editorial-playlist 2 \
  --backup-dir migration-backups \
  --report migration-reports/legacy-json-production.json
```

The backup and report use exclusive creation and fail rather than overwrite evidence. Store both outside ephemeral storage after the run. A retry of the same source hash returns `alreadyImported` and creates no catalog rows.

## Rollback

Use the exact hash from the report:

```sh
DATABASE_MIGRATION_URL='postgresql://...' npm run migrate:legacy:rollback -- \
  --source data/tikplay.json \
  --source-hash <64-character-source-sha256> \
  --report migration-reports/legacy-json-rollback.json
```

Rollback deletes only rows carrying that migration ID, in dependency order, and marks the migration `rolled_back` in the same transaction. It does not restore the application to JSON mode.

### Restore and degraded rollback

1. Stop application writers before import or rollback.
2. For a normal rollback, run the command above and verify returned deletion counts against the import report.
3. Restore the backed-up JSON to the configured `DB_PATH` only if deploying the pre-PostgreSQL application version. Verify its SHA-256 matches the report before replacement, and replace atomically.
4. If PostgreSQL is unavailable, keep the backup immutable, redeploy the known-good JSON-backed release, point `DB_PATH` at a copy of the backup, and run in degraded/read-only mode until PostgreSQL can be reconciled.
5. If rollback fails, its transaction leaves imported rows intact. Do not manually delete partial sets. Repair connectivity/schema constraints and rerun the source-hash rollback.
6. Rows created after migration that reference imported tracks can make rollback fail through restrictive foreign keys. Treat this as a safe stop: quiesce writes, archive/reconcile those rows explicitly, then rerun rollback.

Never restore the JSON over the evidence backup, never use a different source file merely to satisfy rollback arguments, and never import favorites or history as a substitute for account migration.
