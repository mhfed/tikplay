import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { tracks } from '@/lib/db/postgres/schema';

export type CatalogTrack = typeof tracks.$inferSelect;

export type JsonBackedTrack = {
  id: string;
  legacyId: number | null;
  source: string;
  sourceUrl: string;
  audioKey: string;
  title: string;
  author: string;
  coverUrl: string;
  durationSeconds: number;
  category: string | null;
  defaultStartSeconds: number | null;
  defaultEndSeconds: number | null;
  createdAt: string;
  updatedAt: string;
};

export function toCatalogTrack(track: CatalogTrack): JsonBackedTrack {
  return {
    id: track.id,
    legacyId: track.legacyId,
    source: track.source,
    sourceUrl: track.sourceUrl,
    audioKey: track.audioKey,
    title: track.title,
    author: track.author,
    coverUrl: track.coverUrl,
    durationSeconds: track.durationSeconds,
    category: track.category,
    defaultStartSeconds: track.defaultStartSeconds,
    defaultEndSeconds: track.defaultEndSeconds,
    createdAt: track.createdAt.toISOString(),
    updatedAt: track.updatedAt.toISOString(),
  };
}

/**
 * Convert a JSON-backend DbTrackRow to the public catalog shape.
 */
export function toCatalogTrackFromDbRow(row: {
  id: number;
  url: string;
  audio_key: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  source?: string;
  category?: string;
  start_time?: number;
  end_time?: number;
}): JsonBackedTrack {
  return {
    id: String(row.id),
    legacyId: row.id,
    source: row.source ?? 'tiktok',
    sourceUrl: row.url,
    audioKey: row.audio_key,
    title: row.title,
    author: row.author,
    coverUrl: row.cover,
    durationSeconds: row.duration,
    category: row.category ?? null,
    defaultStartSeconds: row.start_time ?? null,
    defaultEndSeconds: row.end_time ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function publicCatalogJson<T>(body: T, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set(
    'Cache-Control',
    'public, max-age=30, stale-while-revalidate=300',
  );
  return NextResponse.json(body, { ...init, headers });
}

export function publicCatalogError(
  status: 400 | 404 | 503,
  code: 'VALIDATION_ERROR' | 'NOT_FOUND' | 'TRANSIENT_ERROR',
  message: string,
) {
  return publicCatalogJson(
    { ok: false, code, error: message },
    { status, headers: { 'Cache-Control': 'no-store' } },
  );
}

/**
 * Check whether a DATABASE_URL is configured so callers can decide
 * whether Postgres is expected to be reachable.
 */
export function hasDatabaseUrl(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}

/**
 * Fallback read of the JSON-file catalog when Postgres is unavailable.
 */
export function getJsonCatalog() {
  const db = getDb();
  return db.tracks.map(toCatalogTrackFromDbRow);
}
