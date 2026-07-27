import { type NextRequest, NextResponse } from 'next/server';
import { ProfileScanner } from '@/lib/media/profile';
import { checkRateLimit, requestIp } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const scanner = new ProfileScanner();

export async function POST(req: NextRequest) {
  const rateLimit = checkRateLimit(`scan:${requestIp(req)}`, {
    limit: 10,
    windowMs: 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: 'Bạn thao tác quá nhanh. Vui lòng thử lại sau.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  try {
    const body = await req.json();
    const url = typeof body.url === 'string' ? body.url : '';

    if (!url) {
      return NextResponse.json(
        { ok: false, error: 'URL là bắt buộc' },
        { status: 400 },
      );
    }

    const result = await scanner.scanTikTok(url);

    return NextResponse.json({
      ok: true,
      data: result,
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: (error as Error).message || 'Lỗi quét profile' },
      { status: 400 },
    );
  }
}
