import { type NextRequest, NextResponse } from 'next/server';
import { recordPlay } from '@/lib/db/queries';

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { trackId, durationListened, percentage } = body;
  if (
    !Number.isInteger(trackId) ||
    trackId < 1 ||
    typeof durationListened !== 'number' ||
    typeof percentage !== 'number'
  ) {
    return NextResponse.json(
      { ok: false, error: 'Dữ liệu không hợp lệ' },
      { status: 400 },
    );
  }
  recordPlay(
    trackId,
    Math.max(0, durationListened),
    Math.min(1, Math.max(0, percentage)),
  );
  return NextResponse.json({ ok: true });
}
