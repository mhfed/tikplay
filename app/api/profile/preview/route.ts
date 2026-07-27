import { type NextRequest, NextResponse } from 'next/server';
import { FileCacheStore } from '@/lib/cache';
import { MediaProcessor } from '@/lib/media/processor';
import { checkRateLimit, requestIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cache = new FileCacheStore();
const processor = new MediaProcessor(cache);

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`preview:${requestIp(req)}`, {
    limit: 20,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Quá nhiều yêu cầu nghe thử. Vui lòng chậm lại.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const url = typeof body.url === 'string' ? body.url : '';

    if (!url) {
      return NextResponse.json(
        { ok: false, error: 'URL không hợp lệ' },
        { status: 400 },
      );
    }

    const result = await processor.preview(url);

    // Preview URL point to normal audio API, but preview generates a distinct key with 'preview:' prefix
    // So the frontend will fetch from /api/audio/preview:baseKey which we need to support in audio route
    // Wait, the preview cache is stored under 'preview:baseKey' inside previewDir.
    // The default audio path looks in `cacheDir`. We should update GET audio/[key] to read preview audio.
    // For now, let's return the preview key. We'll modify the audio route later.

    return NextResponse.json({
      ok: true,
      data: {
        audioUrl: `/api/audio/${result.audioKey}`,
        title: result.meta.title,
        author: result.meta.author,
        cover: result.meta.cover,
        duration: result.meta.duration,
        source: result.source,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message || 'Lỗi nghe thử' },
      { status: 400 },
    );
  }
}
