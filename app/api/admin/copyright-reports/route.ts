import { type NextRequest, NextResponse } from 'next/server';
import { isAdminRequest } from '@/lib/adminAuth';
import { FileCacheStore } from '@/lib/cache';
import { getCopyrightReports, moderateCopyrightReport } from '@/lib/db/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const cache = new FileCacheStore();

export async function GET(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();
  return NextResponse.json({ ok: true, reports: getCopyrightReports() });
}

export async function PATCH(request: NextRequest) {
  if (!isAdminRequest(request)) return unauthorized();

  let body: { id?: unknown; action?: unknown; note?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Body không hợp lệ (phải là JSON)' },
      { status: 400 },
    );
  }

  const id = typeof body.id === 'number' ? body.id : Number(body.id);
  const action = body.action === 'takedown' ? 'actioned' : body.action;
  const note =
    typeof body.note === 'string' ? body.note.trim().slice(0, 1000) : '';

  if (
    !Number.isInteger(id) ||
    (action !== 'actioned' && action !== 'rejected')
  ) {
    return NextResponse.json(
      { ok: false, error: 'Yêu cầu xử lý không hợp lệ' },
      { status: 400 },
    );
  }

  const report = moderateCopyrightReport(id, action, note);
  if (!report) {
    return NextResponse.json(
      { ok: false, error: 'Không tìm thấy báo cáo' },
      { status: 404 },
    );
  }

  if (action === 'actioned') await cache.remove(report.audio_key);
  return NextResponse.json({ ok: true, report });
}

function unauthorized() {
  return NextResponse.json(
    { ok: false, error: 'Không có quyền quản trị' },
    { status: 401 },
  );
}
