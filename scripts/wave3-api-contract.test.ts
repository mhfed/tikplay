import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = (path: string) => readFile(path, 'utf8');

test('public catalog routes read PostgreSQL without requiring a session', async () => {
  for (const path of [
    'app/api/tracks/route.ts',
    'app/api/categories/route.ts',
    'app/api/sources/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /catalogRepository/);
    const getHandler = source.slice(
      source.indexOf('export async function GET'),
    );
    assert.doesNotMatch(getHandler, /requireSession/);
    assert.doesNotMatch(
      getHandler,
      /getAllTracks|getTracksBy|getAllCategories|getAllSources/,
    );
  }
});

test('library and favorites derive ownership only from the authenticated session', async () => {
  for (const path of [
    'app/api/library/tracks/route.ts',
    'app/api/favorites/route.ts',
  ]) {
    const source = await read(path);
    assert.match(source, /requireSession\(req\.headers\)/);
    assert.match(source, /user\.id/);
    assert.doesNotMatch(source, /body\.(?:userId|ownerUserId|ownerId)/);
    assert.match(source, /Object\.keys\(body\)\.length === 2/);
  }
});

test('repository predicates structurally isolate two users', async () => {
  const source = await read('lib/db/postgres/repositories.ts');
  assert.match(
    source,
    /where\(eq\(userLibraryTracks\.userId, userId\)\)/,
    'user A library reads must be constrained by user A session id',
  );
  assert.match(
    source,
    /eq\(userLibraryTracks\.userId, userId\)[\s\S]*eq\(userLibraryTracks\.trackId, trackId\)/,
    'a user cannot remove another user library membership',
  );
  assert.match(
    source,
    /where\(eq\(favorites\.userId, userId\)\)/,
    'user B favorites reads must be constrained by user B session id',
  );
  assert.match(
    source,
    /eq\(favorites\.userId, userId\)[\s\S]*eq\(favorites\.trackId, trackId\)/,
    'a user cannot remove another user favorite',
  );
});

test('favorite creation is atomic with library membership and missing tracks are stable', async () => {
  const source = await read('lib/db/postgres/repositories.ts');
  const favoriteSection = source.slice(
    source.indexOf('export const favoritesRepository'),
    source.indexOf('export const playlistsRepository'),
  );
  assert.match(favoriteSection, /transaction\(async \(tx\)/);
  assert.match(favoriteSection, /catalogRepository\.findById\(trackId, tx\)/);
  assert.match(
    favoriteSection,
    /RepositoryError\('NOT_FOUND', 'Track not found\.'/,
  );
  assert.match(favoriteSection, /insert\(userLibraryTracks\)/);
  assert.match(favoriteSection, /insert\(favorites\)/);
});

test('protected handlers authenticate before parsing or writing', async () => {
  for (const path of [
    'app/api/library/tracks/route.ts',
    'app/api/favorites/route.ts',
  ]) {
    const source = await read(path);
    const post = source.slice(source.indexOf('export async function POST'));
    assert.ok(
      post.indexOf('requireSession(req.headers)') < post.indexOf('req.json()'),
      `${path} must return stable 401 before reading or writing mutation input`,
    );
  }
});
