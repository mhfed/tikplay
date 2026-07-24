import { type NextRequest, NextResponse } from 'next/server';
import {
  addTrackToPlaylist,
  getFavoriteIds,
  getTrackPage,
  removeTrackFromPlaylist,
  reorderPlaylistTracks,
} from '@/lib/db/queries';
import { toTrack } from '@/lib/types';
import { parseTrackPageQuery } from '../../../tracks/pagination';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const playlistId = Number(id);
  if (!Number.isInteger(playlistId) || playlistId <= 1) {
    return NextResponse.json(
      { ok: false, error: 'Danh sách phát không hợp lệ' },
      { status: 400 },
    );
  }
  try {
    const page = getTrackPage(
      parseTrackPageQuery(req, { type: 'playlist', playlistId }, 'playlist'),
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

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { trackId } = await req.json();
  const playlistId = Number(id);
  if (
    !Number.isInteger(playlistId) ||
    playlistId <= 1 ||
    !Number.isInteger(trackId) ||
    trackId < 1
  ) {
    return NextResponse.json(
      { ok: false, error: 'Bài hát hoặc danh sách không hợp lệ' },
      { status: 400 },
    );
  }
  addTrackToPlaylist(playlistId, trackId);
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
