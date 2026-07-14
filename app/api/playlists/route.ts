import { type NextRequest, NextResponse } from 'next/server';
import {
  createPlaylist,
  deletePlaylist,
  getAllPlaylists,
  renamePlaylist,
  reorderPlaylists,
} from '@/lib/db/queries';

export async function GET() {
  return NextResponse.json({ ok: true, playlists: getAllPlaylists() });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  const playlist = createPlaylist(name);
  return NextResponse.json({ ok: true, playlist });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  if (body.ids) {
    reorderPlaylists(body.ids);
  } else if (body.id && body.name) {
    renamePlaylist(body.id, body.name);
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deletePlaylist(id);
  return NextResponse.json({ ok: true });
}
