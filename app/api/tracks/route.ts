import { type NextRequest, NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
import {
  applyAutoRules,
  deleteTrack,
  getAllTracks,
  searchTracks,
  upsertTrack,
} from '@/lib/db/queries';
import { getFavoriteIds, toTrack } from './helpers';

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q');
  const rows = q ? searchTracks(q) : getAllTracks();
  const favIds = getFavoriteIds();
  return NextResponse.json({
    ok: true,
    tracks: rows.map((r) => toTrack(r, favIds)),
  });
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

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { id, startTime, endTime } = body;
  const db = getDb();
  const track = db.tracks.find((t) => t.id === id);
  if (!track) return NextResponse.json({ ok: false }, { status: 404 });

  if (startTime !== undefined) track.start_time = startTime;
  if (endTime !== undefined) track.end_time = endTime;

  saveDb();
  return NextResponse.json({
    ok: true,
    track: toTrack(track, getFavoriteIds()),
  });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deleteTrack(id);
  return NextResponse.json({ ok: true });
}
