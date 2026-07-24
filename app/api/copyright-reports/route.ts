import { type NextRequest, NextResponse } from 'next/server';
import { createCopyrightReport } from '@/lib/db/queries';
import { cacheKey } from '@/lib/media/processor';
import { validateMediaUrl } from '@/lib/media/source';
import { checkRateLimit, requestIp } from '@/lib/rateLimit';

export const dynamic = 'force-dynamic';

interface ReportBody {
  sourceUrl?: unknown;
  reporterName?: unknown;
  reporterEmail?: unknown;
  rightsBasis?: unknown;
  details?: unknown;
  declaration?: unknown;
  website?: unknown;
}

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(`copyright:${requestIp(request)}`, {
    limit: 3,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Bạn đã gửi quá nhiều báo cáo. Vui lòng thử lại sau.',
      },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfter) } },
    );
  }

  let body: ReportBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Body không hợp lệ (phải là JSON)' },
      { status: 400 },
    );
  }

  // Honeypot fields are silently accepted to avoid teaching automated spam how to adapt.
  if (body.website) return NextResponse.json({ ok: true, reportId: null });

  const sourceUrl = text(body.sourceUrl, 2048);
  const reporterName = text(body.reporterName, 120);
  const reporterEmail = text(body.reporterEmail, 254).toLowerCase();
  const rightsBasis = text(body.rightsBasis, 120);
  const details = text(body.details, 4000);
  const validation = validateMediaUrl(sourceUrl);

  if (!validation.valid || !validation.normalized) {
    return NextResponse.json(
      {
        ok: false,
        error: validation.error ?? 'Liên kết nội dung không hợp lệ',
      },
      { status: 400 },
    );
  }
  if (sourceUrl.length > 2048) {
    return NextResponse.json(
      { ok: false, error: 'Liên kết nội dung quá dài' },
      { status: 400 },
    );
  }
  if (reporterName.length < 2) {
    return NextResponse.json(
      { ok: false, error: 'Vui lòng nhập họ tên người báo cáo' },
      { status: 400 },
    );
  }
  if (!emailPattern.test(reporterEmail)) {
    return NextResponse.json(
      { ok: false, error: 'Email liên hệ không hợp lệ' },
      { status: 400 },
    );
  }
  if (!rightsBasis || details.length < 20 || body.declaration !== true) {
    return NextResponse.json(
      {
        ok: false,
        error: 'Vui lòng cung cấp đầy đủ căn cứ, mô tả và xác nhận cam kết.',
      },
      { status: 400 },
    );
  }

  const report = createCopyrightReport({
    sourceUrl,
    normalizedUrl: validation.normalized,
    audioKey: cacheKey(validation.normalized),
    reporterName,
    reporterEmail,
    rightsBasis,
    details,
  });

  return NextResponse.json({ ok: true, reportId: report.id }, { status: 201 });
}

function text(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength + 1) : '';
}
