import type { NextRequest } from 'next/server';
import { MEDIA_SOURCE_LABELS, type MediaSource } from '@/lib/media/source';
import type { TrackPageQuery, TrackScope } from '@/lib/track-pagination';
import type { TrackSort } from '@/lib/types';

const TRACK_SORTS = new Set<TrackSort>([
  'playlist',
  'added_desc',
  'added_asc',
  'title',
  'author',
  'duration',
  'source',
  'category',
]);

export function parseTrackPageQuery(
  req: NextRequest,
  scope: TrackScope,
  defaultSort: TrackSort = 'added_desc',
): TrackPageQuery {
  const params = req.nextUrl.searchParams;
  const requestedSort = params.get('sort') as TrackSort | null;
  if (requestedSort && !TRACK_SORTS.has(requestedSort)) {
    throw new Error('Kiểu sắp xếp không hợp lệ');
  }
  const requestedSource = params.get('source');
  if (requestedSource && !(requestedSource in MEDIA_SOURCE_LABELS)) {
    throw new Error('Nguồn nhạc không hợp lệ');
  }
  const limitParam = params.get('limit');
  const limit = limitParam == null ? undefined : Number(limitParam);
  if (limitParam != null && (!Number.isInteger(limit) || limit! < 1)) {
    throw new Error('Kích thước trang không hợp lệ');
  }
  return {
    scope,
    sort: requestedSort ?? defaultSort,
    query: params.get('q') || undefined,
    category: params.get('category') || undefined,
    source: (requestedSource as MediaSource | null) || undefined,
    cursor: params.get('cursor'),
    limit,
  };
}
