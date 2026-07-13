import { NextRequest, NextResponse } from 'next/server';
import { validateTikTokUrl, cacheKeyFromRaw } from '@/lib/tiktok/validate';
import { FileCacheStore } from '@/lib/cache';
import { MediaProcessor, TrackMeta } from '@/lib/media/processor';

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
    return NextResponse.json({ ok: true, data: payload(key, meta) });
  }

  try {
    const result = await processor.process(url);
    return NextResponse.json({ ok: true, data: payload(result.audioKey, result.meta) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: (e as Error).message || 'Xử lý thất bại' },
      { status: 400 },
    );
  }
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
