import { type NextRequest, NextResponse } from 'next/server';
import { FileCacheStore } from '@/lib/cache';
import { isValidCacheMaxGb } from '@/lib/cache/config';
import { getDb } from '@/lib/db';
import { getCacheSettings, setCacheMaxGb } from '@/lib/db/queries';

const INVALID_LIMIT_MESSAGE = 'Giới hạn cache phải lớn hơn 0 GB';

function parseProtectedTrackIds(req: NextRequest): Set<number> {
  const ids = req.nextUrl.searchParams.get('protectedTrackIds');
  if (!ids) return new Set<number>();
  return new Set(
    ids
      .split(',')
      .map((value) => Number(value.trim()))
      .filter((value) => Number.isInteger(value) && value > 0),
  );
}

function getCacheStatus(protectedTrackIds: ReadonlySet<number> = new Set()) {
  const db = getDb();
  const settings = getCacheSettings();
  const referencedKeys = new Set(db.tracks.map((track) => track.audio_key));
  const protectedKeys = new Set(
    db.tracks
      .filter((track) => protectedTrackIds.has(track.id))
      .map((track) => track.audio_key),
  );
  const cache = new FileCacheStore();
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

export async function GET(req: NextRequest) {
  return NextResponse.json(getCacheStatus(parseProtectedTrackIds(req)));
}

export async function PUT(req: NextRequest) {
  let body: { cacheMaxGb?: unknown } | null;
  try {
    body = (await req.json()) as { cacheMaxGb?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: INVALID_LIMIT_MESSAGE },
      { status: 400 },
    );
  }

  if (!body || !isValidCacheMaxGb(body.cacheMaxGb)) {
    return NextResponse.json(
      { ok: false, error: INVALID_LIMIT_MESSAGE },
      { status: 400 },
    );
  }

  try {
    const settings = setCacheMaxGb(body.cacheMaxGb);
    return NextResponse.json({
      ...getCacheStatus(),
      settings,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: INVALID_LIMIT_MESSAGE },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  const protectedTrackIds = parseProtectedTrackIds(req);
  const db = getDb();
  const referencedKeys = new Set(db.tracks.map((track) => track.audio_key));
  const protectedKeys = new Set(
    db.tracks
      .filter((track) => protectedTrackIds.has(track.id))
      .map((track) => track.audio_key),
  );
  const cache = new FileCacheStore();
  const cleanup = await cache.cleanupSafe({ referencedKeys, protectedKeys });

  return NextResponse.json({
    ...getCacheStatus(protectedTrackIds),
    removedFiles: cleanup.removedFiles,
    freedBytes: cleanup.freedBytes,
  });
}
