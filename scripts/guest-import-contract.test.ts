import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(path, 'utf8');

test('all guest import routes authenticate before reading or writing', () => {
  for (const path of [
    'app/api/import/preview/route.ts',
    'app/api/import/commit/route.ts',
    'app/api/import/status/[id]/route.ts',
  ]) {
    const source = read(path);
    assert.match(source, /requireSession\(req\.headers\)/);
    assert.match(source, /privateJson/);
  }
});

test('repository binds ownership, payload hash, freshness, locking, and rollback transaction', () => {
  const source = read('lib/db/postgres/guest-import-repository.ts');
  assert.match(source, /eq\(guestImports\.userId, userId\)/);
  assert.match(source, /row\.payloadHash !== payloadHash/);
  assert.match(source, /row\.previewExpiresAt <= new Date\(\)/);
  assert.match(source, /pg_advisory_xact_lock/);
  assert.match(source, /getPostgresDb\(\)\.transaction/);
  assert.match(source, /onConflictDoNothing/);
  assert.match(source, /status: 'completed'/);
});

test('preview persists no catalog or personal records', () => {
  const source = read('lib/db/postgres/guest-import-repository.ts');
  const preview = source.slice(
    source.indexOf('async preview'),
    source.indexOf('async status'),
  );
  assert.doesNotMatch(
    preview,
    /insert\(tracks\)|insert\(playlists\)|insert\(userLibraryTracks\)/,
  );
});
