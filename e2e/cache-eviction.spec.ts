import {
  access,
  mkdir,
  mkdtemp,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
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

test('reports cache bytes and plans orphaned files before oldest saved tracks', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const orphanKey = 'a'.repeat(64);
  const olderTrackKey = 'b'.repeat(64);
  const newerTrackKey = 'c'.repeat(64);
  const orphanPath = join(dir, `${orphanKey}.m4a`);
  const olderTrackPath = join(dir, `${olderTrackKey}.m4a`);
  const newerTrackPath = join(dir, `${newerTrackKey}.m4a`);
  await writeFile(orphanPath, Buffer.alloc(10));
  await writeFile(olderTrackPath, Buffer.alloc(20));
  await writeFile(newerTrackPath, Buffer.alloc(30));

  const old = new Date(Date.now() - 60_000);
  await utimes(orphanPath, old, old);
  await utimes(olderTrackPath, old, old);

  const cache = new FileCacheStore({ dir });
  const status = cache.getStorageStatus({
    referencedKeys: new Set([olderTrackKey, newerTrackKey]),
  });

  expect(status.cacheBytes).toBe(60);
  expect(status.evictionPlan.map((entry) => entry.key)).toEqual([
    orphanKey,
    olderTrackKey,
    newerTrackKey,
  ]);
});

test('safely cleans orphaned and stale cache files without touching library data', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const referencedKey = 'd'.repeat(64);
  const orphanKey = 'e'.repeat(64);
  const referencedAudio = join(dir, `${referencedKey}.m4a`);
  const referencedMeta = join(dir, `${referencedKey}.json`);
  const orphanAudio = join(dir, `${orphanKey}.m4a`);
  const orphanMeta = join(dir, `${orphanKey}.json`);
  const partial = join(dir, 'failed-download.part');
  const previewDir = join(dir, 'preview');
  const preview = join(previewDir, 'sample.m4a');
  const database = join(dir, 'tikplay.json');
  await mkdir(previewDir);
  await Promise.all([
    writeFile(referencedAudio, Buffer.alloc(40)),
    writeFile(referencedMeta, '{}'),
    writeFile(orphanAudio, Buffer.alloc(30)),
    writeFile(orphanMeta, '{}'),
    writeFile(partial, Buffer.alloc(20)),
    writeFile(preview, Buffer.alloc(10)),
    writeFile(database, '{"tracks":[]}'),
  ]);

  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await Promise.all([utimes(partial, old, old), utimes(preview, old, old)]);

  const cache = new FileCacheStore({ dir });
  const result = await cache.cleanupSafe({
    referencedKeys: new Set([referencedKey]),
  });

  expect(result.freedBytes).toBeGreaterThan(0);
  expect(result.removedFiles).toBe(4);
  await expect(access(referencedAudio)).resolves.toBeUndefined();
  await expect(access(referencedMeta)).resolves.toBeUndefined();
  await expect(access(database)).resolves.toBeUndefined();
  await expect(access(orphanAudio)).rejects.toThrow();
  await expect(access(orphanMeta)).rejects.toThrow();
  await expect(access(partial)).rejects.toThrow();
  await expect(access(preview)).rejects.toThrow();
});

test('uses a per-maintenance cache limit instead of only the startup limit', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const olderKey = 'f'.repeat(64);
  const newerKey = '1'.repeat(64);
  const olderPath = join(dir, `${olderKey}.m4a`);
  const newerPath = join(dir, `${newerKey}.m4a`);
  await writeFile(olderPath, Buffer.alloc(80));
  await writeFile(newerPath, Buffer.alloc(80));
  const old = new Date(Date.now() - 60_000);
  await utimes(olderPath, old, old);

  const cache = new FileCacheStore({ dir, maxGb: 1 });
  await cache.evictOld({
    maxGb: 0.0000001,
    referencedKeys: new Set([olderKey, newerKey]),
  });

  await expect(access(olderPath)).rejects.toThrow();
  await expect(access(newerPath)).resolves.toBeUndefined();
});

test('counts cache media, sidecars, previews, and partial downloads but not the database', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const key = '2'.repeat(64);
  const previewDir = join(dir, 'preview');
  await mkdir(previewDir);
  await Promise.all([
    writeFile(join(dir, `${key}.m4a`), Buffer.alloc(10)),
    writeFile(join(dir, `${key}.jpg`), Buffer.alloc(2)),
    writeFile(join(dir, `${key}.json`), Buffer.alloc(2)),
    writeFile(join(dir, 'in-progress.part'), Buffer.alloc(4)),
    writeFile(join(previewDir, `${key}.m4a`), Buffer.alloc(3)),
    writeFile(join(dir, 'tikplay.json'), Buffer.alloc(50)),
  ]);

  const cache = new FileCacheStore({ dir });

  expect(cache.getStorageStatus().cacheBytes).toBe(21);
});

test('reports cache-limit pressure and a safe-cleanup estimate without deleting files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const referencedKey = '3'.repeat(64);
  const orphanKey = '4'.repeat(64);
  const partial = join(dir, 'stalled-download.part');
  const previewDir = join(dir, 'preview');
  const preview = join(previewDir, `${orphanKey}.m4a`);
  await mkdir(previewDir);
  await Promise.all([
    writeFile(join(dir, `${referencedKey}.m4a`), Buffer.alloc(20)),
    writeFile(join(dir, `${orphanKey}.m4a`), Buffer.alloc(8)),
    writeFile(partial, Buffer.alloc(4)),
    writeFile(preview, Buffer.alloc(3)),
  ]);
  const old = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await Promise.all([utimes(partial, old, old), utimes(preview, old, old)]);

  const cache = new FileCacheStore({ dir, maxGb: 0.00000001 });
  const status = cache.getStorageStatus({
    referencedKeys: new Set([referencedKey]),
  });

  expect(status.isOverLimit).toBe(true);
  expect(status.safeCleanupFiles).toBe(3);
  expect(status.safeCleanupBytes).toBe(15);
  await expect(access(join(dir, `${orphanKey}.m4a`))).resolves.toBeUndefined();
  await expect(access(partial)).resolves.toBeUndefined();
  await expect(access(preview)).resolves.toBeUndefined();
});

test('enforces the cache limit against audio and its sidecars together', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const key = '5'.repeat(64);
  const audio = join(dir, `${key}.m4a`);
  const cover = join(dir, `${key}.jpg`);
  await Promise.all([
    writeFile(audio, Buffer.alloc(10)),
    writeFile(cover, Buffer.alloc(10)),
  ]);

  const cache = new FileCacheStore({ dir, maxGb: 0.00000001 });
  await cache.evictOld({ referencedKeys: new Set([key]) });

  await expect(access(audio)).rejects.toThrow();
  await expect(access(cover)).rejects.toThrow();
});

test('does not delete a hash-named JSON file when no cache audio proves it is a sidecar', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'tikplay-cache-'));
  temporaryDirectories.push(dir);

  const possibleDatabase = join(dir, `${'6'.repeat(64)}.json`);
  await writeFile(possibleDatabase, '{"settings":{}}');

  const cache = new FileCacheStore({ dir });
  const result = await cache.cleanupSafe();

  expect(result.removedFiles).toBe(0);
  expect(cache.getStorageStatus().cacheBytes).toBe(0);
  await expect(access(possibleDatabase)).resolves.toBeUndefined();
});
