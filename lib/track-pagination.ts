import type { MediaSource } from './media/source';
import type { DbTrack, TrackSort } from './types';

export const DEFAULT_TRACK_PAGE_SIZE = 50;
export const MAX_TRACK_PAGE_SIZE = 100;

export type TrackScope =
  | { type: 'library' }
  | { type: 'favorites' }
  | { type: 'playlist'; playlistId: number };

export interface TrackPageQuery {
  scope: TrackScope;
  sort: TrackSort;
  query?: string;
  category?: string;
  source?: MediaSource;
  cursor?: string | null;
  limit?: number;
}

export interface DbTrackPage {
  tracks: DbTrack[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

interface CursorPayload {
  v: 1;
  fingerprint: string;
  anchorId: number;
}

export function normalizePageLimit(value?: number): number {
  if (!Number.isFinite(value)) return DEFAULT_TRACK_PAGE_SIZE;
  return Math.min(MAX_TRACK_PAGE_SIZE, Math.max(1, Math.trunc(value!)));
}

export function trackPageFingerprint(query: TrackPageQuery): string {
  const scope =
    query.scope.type === 'playlist'
      ? `playlist:${query.scope.playlistId}`
      : query.scope.type;
  return [
    scope,
    query.sort,
    query.query?.trim().toLocaleLowerCase('vi') ?? '',
    query.category ?? '',
    query.source ?? '',
  ].join('|');
}

export function encodeTrackCursor(
  fingerprint: string,
  anchorId: number,
): string {
  const payload: CursorPayload = { v: 1, fingerprint, anchorId };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

export function decodeTrackCursor(
  cursor: string | null | undefined,
  fingerprint: string,
): number | null {
  if (!cursor) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(cursor, 'base64url').toString('utf8'),
    ) as Partial<CursorPayload>;
    if (
      payload.v !== 1 ||
      payload.fingerprint !== fingerprint ||
      !Number.isInteger(payload.anchorId) ||
      payload.anchorId! < 1
    ) {
      throw new Error('invalid cursor');
    }
    return payload.anchorId!;
  } catch {
    throw new Error('Cursor trang không hợp lệ hoặc không khớp bộ lọc');
  }
}
