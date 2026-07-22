import { type NextRequest, NextResponse } from 'next/server';
import {
  getFavoriteIds as dbGetFavIds,
  getFavoriteTracks,
  getLongUnplayed,
  getMostPlayed,
  getUnfinishedTracks,
} from '@/lib/db/queries';
import type { Track } from '@/lib/types';
import { toTrack } from '@/lib/types';

function getFavoriteIds(): Set<number> {
  return dbGetFavIds();
}

export async function GET(req: NextRequest) {
  const kind = req.nextUrl.searchParams.get('kind') || 'most-played';
  const favIds = getFavoriteIds();
  let tracks: Track[] = [];

  switch (kind) {
    case 'most-played':
      tracks = getMostPlayed().map((r) => toTrack(r, favIds));
      break;
    case 'unfinished':
      tracks = getUnfinishedTracks().map((r) => toTrack(r, favIds));
      break;
    case 'long-unplayed':
      tracks = getLongUnplayed().map((r) => toTrack(r, favIds));
      break;
    case 'favorites':
      tracks = getFavoriteTracks().map((r) => toTrack(r, favIds));
      break;
  }

  return NextResponse.json({ ok: true, tracks, kind });
}
