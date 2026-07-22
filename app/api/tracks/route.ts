import { type NextRequest, NextResponse } from 'next/server';
import { CATEGORIES, DEFAULT_CATEGORY } from '@/lib/categories';
import { getDb, saveDb } from '@/lib/db';
import {
  applyAutoRules,
  deleteTrack,
  getAllTracks,
  getTrack,
  searchTracks,
  upsertTrack,
} from '@/lib/db/queries';
import { getFavoriteIds, toTrack } from './helpers';

const MAX_BATCH_TRACK_IDS = 100;

export async function GET(req: NextRequest) {
  const idsParam = req.nextUrl.searchParams.get('ids');
  const favIds = getFavoriteIds();
  if (idsParam != null) {
    const parts = idsParam.split(',').filter(Boolean);
    if (parts.length > MAX_BATCH_TRACK_IDS) {
      return NextResponse.json(
        { ok: false, error: `Tối đa ${MAX_BATCH_TRACK_IDS} bài hát` },
        { status: 400 },
      );
    }
    const ids = parts.map(Number);
    if (ids.some((id) => !Number.isInteger(id) || id < 1)) {
      return NextResponse.json(
        { ok: false, error: 'Danh sách ID bài hát không hợp lệ' },
        { status: 400 },
      );
    }
    const tracks = ids
      .map((id) => getTrack(id))
      .filter((track) => track != null)
      .map((track) => toTrack(track, favIds));
    return NextResponse.json({ ok: true, tracks });
  }

  const q = req.nextUrl.searchParams.get('q');
  const rows = q ? searchTracks(q) : getAllTracks();
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
  const { id, startTime, endTime, title, author, cover, category } = body;
  if (!Number.isInteger(id) || id < 1) {
    return NextResponse.json(
      { ok: false, error: 'ID bài hát không hợp lệ' },
      { status: 400 },
    );
  }
  const db = getDb();
  const track = db.tracks.find((t) => t.id === id);
  if (!track) {
    return NextResponse.json(
      { ok: false, error: 'Không tìm thấy bài hát' },
      { status: 404 },
    );
  }

  if (title !== undefined) {
    if (
      typeof title !== 'string' ||
      !title.trim() ||
      title.trim().length > 200
    ) {
      return NextResponse.json(
        { ok: false, error: 'Tên bài hát phải có từ 1 đến 200 ký tự' },
        { status: 400 },
      );
    }
    track.title = title.trim();
  }
  if (author !== undefined) {
    if (
      typeof author !== 'string' ||
      !author.trim() ||
      author.trim().length > 120
    ) {
      return NextResponse.json(
        { ok: false, error: 'Tên nghệ sĩ phải có từ 1 đến 120 ký tự' },
        { status: 400 },
      );
    }
    track.author = author.trim();
  }
  if (cover !== undefined) {
    if (typeof cover !== 'string' || cover.length > 2000) {
      return NextResponse.json(
        { ok: false, error: 'Đường dẫn ảnh bìa không hợp lệ' },
        { status: 400 },
      );
    }
    track.cover = cover.trim();
  }
  if (category !== undefined) {
    const validCategories = new Set([
      DEFAULT_CATEGORY,
      ...CATEGORIES.map((item) => item.slug),
    ]);
    if (typeof category !== 'string' || !validCategories.has(category)) {
      return NextResponse.json(
        { ok: false, error: 'Thể loại không hợp lệ' },
        { status: 400 },
      );
    }
    track.category = category;
  }

  if (startTime !== undefined) {
    if (typeof startTime !== 'number' || startTime < 0) {
      return NextResponse.json(
        { ok: false, error: 'Thời điểm bắt đầu không hợp lệ' },
        { status: 400 },
      );
    }
    track.start_time = startTime;
  }
  if (endTime !== undefined) {
    if (typeof endTime !== 'number' || endTime <= 0) {
      return NextResponse.json(
        { ok: false, error: 'Thời điểm kết thúc không hợp lệ' },
        { status: 400 },
      );
    }
    track.end_time = endTime;
  }

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
