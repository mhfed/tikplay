import { type NextRequest, NextResponse } from 'next/server';
import { FileCacheStore } from '@/lib/cache';
import { applyAutoRules, isMediaBlocked, upsertTrack } from '@/lib/db/queries';
import {
  cacheKeyFromRaw,
  MediaProcessor,
  type TrackMeta,
} from '@/lib/media/processor';
import { type MediaSource, validateMediaUrl } from '@/lib/media/source';
import { checkRateLimit, requestIp } from '@/lib/rateLimit';

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
  const rateLimit = checkRateLimit(`process:${requestIp(req)}`, {
    limit: 10,
    windowMs: 10 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

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
  if (url.length > 2048) {
    return NextResponse.json(
      { ok: false, error: 'URL vượt quá độ dài cho phép' },
      { status: 400 },
    );
  }
  const validation = validateMediaUrl(url);
  if (!validation.valid || !validation.normalized || !validation.source) {
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

  if (isMediaBlocked(key)) {
    return NextResponse.json(
      { ok: false, error: 'Nội dung này không khả dụng do yêu cầu bản quyền.' },
      { status: 451 },
    );
  }

  // Serve directly from cache when both audio + metadata are present.
  const cached = cache.get(key);
  const meta = cache.getMeta(key) as TrackMeta | null;
  if (cached && meta) {
    const dbTrack = persistTrack(url, key, meta, validation.source);
    return NextResponse.json({
      ok: true,
      existed: true,
      data: payload(key, meta, validation.source),
      trackId: dbTrack.id,
    });
  }

  try {
    const result = await processor.process(url);
    const dbTrack = persistTrack(
      url,
      result.audioKey,
      result.meta,
      result.source,
    );
    return NextResponse.json({
      ok: true,
      data: payload(result.audioKey, result.meta, result.source),
      trackId: dbTrack.id,
    });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'Xử lý thất bại' },
      { status: 400 },
    );
  }
}

function persistTrack(
  url: string,
  audioKey: string,
  meta: TrackMeta,
  source: MediaSource,
) {
  const dbTrack = upsertTrack({
    url,
    audio_key: audioKey,
    title: meta.title,
    author: meta.author,
    cover: meta.cover,
    duration: meta.duration,
    added_at: Date.now(),
    source,
  });
  applyAutoRules(dbTrack.id, dbTrack.title, dbTrack.author);
  return dbTrack;
}

function payload(key: string, meta: TrackMeta, source: MediaSource) {
  return {
    audioUrl: `/api/audio/${key}`,
    title: meta.title,
    author: meta.author,
    cover: meta.cover,
    duration: meta.duration,
    source,
  };
}
