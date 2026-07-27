import { type NextRequest, NextResponse } from 'next/server';
import { FileCacheStore } from '@/lib/cache';
import { applyAutoRules, upsertTrack } from '@/lib/db/queries';
import { MediaProcessor } from '@/lib/media/processor';
import { checkRateLimit, requestIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cache = new FileCacheStore();
const processor = new MediaProcessor(cache);

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`download-batch:${requestIp(req)}`, {
    limit: 5,
    windowMs: 60 * 1000,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Quá nhiều yêu cầu tải về. Vui lòng chậm lại.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    let downloadItems: { url: string; startTime?: number; endTime?: number }[] =
      [];

    if (Array.isArray(body.items)) {
      downloadItems = body.items;
    } else if (Array.isArray(body.urls)) {
      downloadItems = body.urls.map((u: string) => ({ url: u }));
    }

    if (downloadItems.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Danh sách URL không hợp lệ' },
        { status: 400 },
      );
    }

    if (downloadItems.length > 20) {
      return NextResponse.json(
        { ok: false, error: 'Chỉ hỗ trợ tải tối đa 20 bài mỗi lần' },
        { status: 400 },
      );
    }

    const urls = downloadItems.map((i) => i.url);
    const results = await processor.downloadBatch(urls);

    // Save successful downloads to DB
    for (let idx = 0; idx < results.length; idx++) {
      const item = results[idx];
      const requestItem = downloadItems[idx];
      if (item.ok && item._internalRaw) {
        try {
          const raw = item._internalRaw;
          const dbTrack = upsertTrack({
            url: raw.url,
            audio_key: raw.audioKey,
            title: raw.meta.title,
            author: raw.meta.author,
            cover: raw.meta.cover,
            duration: raw.meta.duration,
            start_time: requestItem?.startTime,
            end_time: requestItem?.endTime,
            added_at: Date.now(),
            source: raw.source,
          });
          applyAutoRules(dbTrack.id, dbTrack.title, dbTrack.author);
          item.trackId = dbTrack.id;
        } catch (_dbErr) {
          item.ok = false;
          item.error = 'Lỗi lưu vào CSDL';
        }
      }
    }

    return NextResponse.json({
      ok: true,
      data: results.map((r) => ({
        url: r.url,
        ok: r.ok,
        error: r.error,
        trackId: r.trackId,
        title: r.title,
      })),
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message || 'Lỗi xử lý yêu cầu' },
      { status: 400 },
    );
  }
}
