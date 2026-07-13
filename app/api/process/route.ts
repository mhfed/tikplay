import { NextRequest, NextResponse } from 'next/server';
import { validateTikTokUrl, cacheKeyFromRaw } from '@/lib/tiktok/validate';
import { FileCacheStore } from '@/lib/cache';
import { MediaProcessor, TrackMeta } from '@/lib/media/processor';
import { upsertTrack, applyAutoRules } from '@/lib/db/queries';

// Long-running yt-dlp jobs must run on the Node.js runtime, never Edge.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Module-level singletons so the in-memory debounce map is shared per process.
const cache = new FileCacheStore();
const processor = new MediaProcessor(cache);

interface ProcessBody {
  url?: unknown;
}

export async function POST(req: NextRequest) {
  let body: ProcessBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Body không hợp lệ (phải là JSON)' },
      { status: 400 },
    );
  }

  const url = typeof body.url === 'string' ? body.url : '';
  const validation = validateTikTokUrl(url);
  if (!validation.valid || !validation.normalized) {
    return NextResponse.json(
      { ok: false, error: validation.error ?? 'URL không hợp lệ' },
      { status: 400 },
    );
  }

  let key: string;
  try {
    key = cacheKeyFromRaw(url);
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message },
      { status: 400 },
    );
  }

  // Serve directly from cache when both audio + metadata are present.
  const cached = cache.get(key);
  const meta = cache.getMeta(key) as TrackMeta | null;
  if (cached && meta) {
    const dbTrack = persistTrack(url, key, meta);
    return NextResponse.json({ ok: true, data: payload(key, meta), trackId: dbTrack.id });
  }

  try {
    const result = await processor.process(url);
    const dbTrack = persistTrack(url, result.audioKey, result.meta);
    return NextResponse.json({ ok: true, data: payload(result.audioKey, result.meta), trackId: dbTrack.id });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'Xử lý thất bại' },
      { status: 400 },
    );
  }
}

function persistTrack(url: string, audioKey: string, meta: TrackMeta) {
  const dbTrack = upsertTrack({
    url,
    audio_key: audioKey,
    title: meta.title,
    author: meta.author,
    cover: meta.cover,
    duration: meta.duration,
    added_at: Date.now(),
  });
  applyAutoRules(dbTrack.id, dbTrack.title, dbTrack.author);
  return dbTrack;
}

function payload(key: string, meta: TrackMeta) {
  return {
    audioUrl: `/api/audio/${key}`,
    title: meta.title,
    author: meta.author,
    cover: meta.cover,
    duration: meta.duration,
  };
}
