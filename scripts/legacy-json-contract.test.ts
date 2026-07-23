import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

test('migration SQL provides provenance for every imported table', () => {
  const sql = fs.readFileSync('drizzle/0001_legacy_json_migration.sql', 'utf8');
  for (const table of [
    'tracks',
    'playlists',
    'playlist_tracks',
    'copyright_reports',
    'blocked_media',
  ]) {
    assert.match(
      sql,
      new RegExp(`ALTER TABLE "${table}" ADD COLUMN "migration_id" uuid`),
    );
  }
  assert.match(sql, /data_migrations_source_hash_unique/);
});

test('CLI keeps dry-run before database and filesystem mutation', () => {
  const source = fs.readFileSync('scripts/migrate-legacy-json.ts', 'utf8');
  const dryRun = source.indexOf("config.mode === 'dry-run'");
  assert.ok(dryRun > 0);
  assert.ok(dryRun < source.indexOf('ensureBackup(config.source'));
  assert.ok(dryRun < source.indexOf('new Client'));
  assert.match(source, /await client\.query\('begin'\)/);
  assert.match(source, /await client\.query\('rollback'\)/);
});
