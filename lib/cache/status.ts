import { getDb } from '../db';
import { getCacheSettings } from '../db/queries';
import { FileCacheStore } from './index';

export function parseProtectedTrackIds(value: string | null): Set<number> {
  if (!value) return new Set<number>();
  return new Set(
    value
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((id) => Number.isInteger(id) && id > 0),
  );
}

export function getCacheContext(
  protectedTrackIds: ReadonlySet<number> = new Set(),
) {
  const db = getDb();
  const settings = getCacheSettings();
  const referencedKeys = new Set(db.tracks.map((track) => track.audio_key));
  const protectedKeys = new Set(
    db.tracks
      .filter((track) => protectedTrackIds.has(track.id))
      .map((track) => track.audio_key),
  );

  return {
    cache: new FileCacheStore(),
    db,
    settings,
    referencedKeys,
    protectedKeys,
  };
}

export function getCacheStatus(
  protectedTrackIds: ReadonlySet<number> = new Set(),
) {
  const { cache, db, settings, referencedKeys, protectedKeys } =
    getCacheContext(protectedTrackIds);
  const status = cache.getStorageStatus({
    maxGb: settings.cacheMaxGb,
    protectedKeys,
    referencedKeys,
  });
  const tracksByAudioKey = new Map(
    db.tracks.map((track) => [track.audio_key, track]),
  );

  return {
    ok: true,
    cacheMaxGb: settings.cacheMaxGb,
    savedCacheMaxGb: settings.savedCacheMaxGb,
    status: {
      cacheBytes: status.cacheBytes,
      limitBytes: status.limitBytes,
      remainingBytes: Math.max(0, status.limitBytes - status.cacheBytes),
      freeBytes: status.freeBytes,
      minFreeBytes: status.minFreeBytes,
      isOverLimit: status.isOverLimit,
      isLowDisk: status.isLowDisk,
      safeCleanupBytes: status.safeCleanupBytes,
      safeCleanupFiles: status.safeCleanupFiles,
      orphanedEntries: status.evictionPlan.filter((entry) => !entry.referenced)
        .length,
      evictionCandidates: status.evictionPlan
        .filter((entry) => entry.referenced)
        .map((entry) => {
          const track = tracksByAudioKey.get(entry.key);
          if (!track) return null;
          return {
            trackId: track.id,
            audioKey: track.audio_key,
            title: track.title,
            author: track.author,
            cover: track.cover,
            size: entry.size,
            mtimeMs: entry.mtimeMs,
          };
        })
        .filter((entry) => entry !== null),
    },
  };
}
