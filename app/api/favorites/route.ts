import { NextRequest, NextResponse } from 'next/server';
import { toggleFavorite, getFavoriteTracks, getFavoriteIds } from '@/lib/db/queries';
import { toTrack } from '@/lib/types';

export async function GET() {
  const rows = getFavoriteTracks();
  const favIds = getFavoriteIds();
  return NextResponse.json({ ok: true, tracks: rows.map((r) => toTrack(r, favIds)) });
}

export async function POST(req: NextRequest) {
  const { trackId } = await req.json();
  const isFav = toggleFavorite(trackId);
  return NextResponse.json({ ok: true, isFavorite: isFav });
}
