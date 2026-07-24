import { type NextRequest, NextResponse } from 'next/server';
import { getFavoriteIds, getTrackPage, toggleFavorite } from '@/lib/db/queries';
import { toTrack } from '@/lib/types';
import { parseTrackPageQuery } from '../tracks/pagination';

export async function GET(req: NextRequest) {
  try {
    const page = getTrackPage(
      parseTrackPageQuery(req, { type: 'favorites' }, 'added_desc'),
    );
    const favIds = getFavoriteIds();
    return NextResponse.json({
      ok: true,
      ...page,
      tracks: page.tracks.map((r) => toTrack(r, favIds)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Trang không hợp lệ',
      },
      { status: 400 },
    );
  }
}

export async function POST(req: NextRequest) {
  const { trackId } = await req.json();
  const isFav = toggleFavorite(trackId);
  return NextResponse.json({ ok: true, isFavorite: isFav });
}
