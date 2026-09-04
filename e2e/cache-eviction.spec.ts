import { access, mkdtemp, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { FileCacheStore } from '../lib/cache';

const temporaryDirectories: string[] = [];

test.afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((dir) => rm(dir, { recursive: true, force: true })),
  );
});

test('keeps protected cache entries when evicting over the cache limit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const protectedKey = 'protected-track';
  const evictableKey = 'evictable-track';
  await writeFile(join(dir, `${protectedKey}.m4a`), Buffer.alloc(80));
  await writeFile(join(dir, `${evictableKey}.m4a`), Buffer.alloc(80));

  const old = new Date(Date.now() - 60_000);
  const recent = new Date();
  await utimes(join(dir, `${protectedKey}.m4a`), old, old);
  await utimes(join(dir, `${evictableKey}.m4a`), recent, recent);

  const cache = new FileCacheStore({ dir, maxGb: 0.0000001 });
  await cache.evictOld({ protectedKeys: new Set([protectedKey]) });

  expect(cache.get(protectedKey)).toBe(join(dir, `${protectedKey}.m4a`));
  expect(cache.get(evictableKey)).toBeNull();
});

test('removes stale download fragments during cache maintenance', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const fragment = join(dir, 'failed-download.part');
  await writeFile(fragment, Buffer.alloc(80));
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(fragment, old, old);

  const cache = new FileCacheStore({ dir, maxGb: 1 });
  await cache.evictOld();

  await expect(access(fragment)).rejects.toThrow();
});

test('keeps library tracks past the TTL while cache capacity is available', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const libraryKey = 'saved-library-track';
  await writeFile(join(dir, `${libraryKey}.m4a`), Buffer.alloc(80));
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await utimes(join(dir, `${libraryKey}.m4a`), old, old);

  const cache = new FileCacheStore({
    dir,
    ttlDays: 0.00001,
    maxGb: 1,
  });
  await cache.evictOld({
    protectedKeys: new Set(),
    referencedKeys: new Set([libraryKey]),
  });

  expect(cache.get(libraryKey)).toBe(join(dir, `${libraryKey}.m4a`));
});

test('evicts an unprotected library track when cache capacity is exceeded', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const libraryKey = 'evictable-library-track';
  await writeFile(join(dir, `${libraryKey}.m4a`), Buffer.alloc(160));

  const cache = new FileCacheStore({ dir, maxGb: 0.0000001 });
  await cache.evictOld({ referencedKeys: new Set([libraryKey]) });

  expect(cache.get(libraryKey)).toBeNull();
});
