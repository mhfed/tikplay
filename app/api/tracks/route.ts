import { NextRequest, NextResponse } from 'next/server';
import { getAllTracks, upsertTrack, deleteTrack, searchTracks, applyAutoRules } from '@/lib/db/queries';
import { getFavoriteIds, toTrack } from './helpers';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const rows = q ? searchTracks(q) : getAllTracks();
  const favIds = getFavoriteIds();
  return NextResponse.json({ ok: true, tracks: rows.map((r) => toTrack(r, favIds)) });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const row = upsertTrack({
    url: body.url,
    audio_key: body.audioKey,
    title: body.title,
    author: body.author,
    cover: body.cover || '',
    duration: body.duration,
    added_at: Date.now(),
  });
  applyAutoRules(row.id, row.title, row.author);
  const favIds = getFavoriteIds();
  return NextResponse.json({ ok: true, track: toTrack(row, favIds) });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deleteTrack(id);
  return NextResponse.json({ ok: true });
}
