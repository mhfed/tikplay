import { type NextRequest, NextResponse } from 'next/server';
import {
  addTrackToPlaylist,
  getFavoriteIds,
  getPlaylistTracks,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
} from '@/lib/db/queries';
import { toTrack } from '@/lib/types';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const rows = getPlaylistTracks(Number(id));
  const favIds = getFavoriteIds();
  return NextResponse.json({
    ok: true,
    tracks: rows.map((r) => toTrack(r, favIds)),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { trackId } = await req.json();
  addTrackToPlaylist(Number(id), trackId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { trackId } = await req.json();
  removeTrackFromPlaylist(Number(id), trackId);
  return NextResponse.json({ ok: true });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { trackIds } = await req.json();
  reorderPlaylistTracks(Number(id), trackIds);
  return NextResponse.json({ ok: true });
}
