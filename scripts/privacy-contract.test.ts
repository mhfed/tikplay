import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

async function source(path: string) {
  return readFile(path, 'utf8');
}

test('privacy repository scopes every export collection to the requested user', async () => {
  const text = await source('lib/db/postgres/privacy-repository.ts');
  for (const predicate of [
    'userPreferences.userId, userId',
    'userLibraryTracks.userId, userId',
    'favorites.userId, userId',
    'playlists.ownerUserId, userId',
    'autoRules.ownerUserId, userId',
    'listeningEvents.userId, userId',
    'guestImports.userId, userId',
  ]) {
    assert.ok(
      text.includes(predicate),
      `missing ownership predicate: ${predicate}`,
    );
  }
});

test('deletion revokes sessions in the same transaction and purge does not delete tracks', async () => {
  const text = await source('lib/db/postgres/privacy-repository.ts');
  assert.match(text, /transaction\(async \(tx\)/);
  assert.match(text, /revokedReason: 'account-deletion'/);
  assert.match(text, /await tx\.delete\(sessions\)/);
  assert.doesNotMatch(text, /tx\.delete\(tracks\)/);
});

test('routes do not accept caller-supplied user ids', async () => {
  const text = await source('app/api/privacy/export/route.ts');
  assert.doesNotMatch(text, /searchParams|get\(['"]userId|body.*userId/);
});
