import { type NextRequest, NextResponse } from 'next/server';
import { isValidCacheMaxGb } from '@/lib/cache/config';
import { getCacheStatus, parseProtectedTrackIds } from '@/lib/cache/status';
import { setCacheMaxGb } from '@/lib/db/queries';

const INVALID_LIMIT_MESSAGE = 'Giới hạn cache phải lớn hơn 0 GB';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(
      getCacheStatus(
        parseProtectedTrackIds(
          req.nextUrl.searchParams.get('protectedTrackIds'),
        ),
      ),
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Không thể đọc thông tin cache lúc này.' },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  let body: { cacheMaxGb?: unknown } | null;
  try {
    body = (await req.json()) as { cacheMaxGb?: unknown };
  } catch {
    return NextResponse.json(
      { ok: false, error: INVALID_LIMIT_MESSAGE },
      { status: 400 },
    );
  }

  if (!body || !isValidCacheMaxGb(body.cacheMaxGb)) {
    return NextResponse.json(
      { ok: false, error: INVALID_LIMIT_MESSAGE },
      { status: 400 },
    );
  }

  try {
    const settings = setCacheMaxGb(body.cacheMaxGb);
    return NextResponse.json({
      ...getCacheStatus(),
      settings,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Không thể lưu giới hạn cache lúc này.' },
      { status: 500 },
    );
  }
}
