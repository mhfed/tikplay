import { type NextRequest, NextResponse } from 'next/server';
import {
  getCacheContext,
  getCacheStatus,
  parseProtectedTrackIds,
} from '@/lib/cache/status';

export async function POST(req: NextRequest) {
  const protectedTrackIds = parseProtectedTrackIds(
    req.nextUrl.searchParams.get('protectedTrackIds'),
  );
  try {
    const { cache, referencedKeys, protectedKeys } =
      getCacheContext(protectedTrackIds);
    const cleanup = await cache.cleanupSafe({ referencedKeys, protectedKeys });

    return NextResponse.json({
      ...getCacheStatus(protectedTrackIds),
      removedFiles: cleanup.removedFiles,
      freedBytes: cleanup.freedBytes,
    });
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Không thể dọn cache lúc này.' },
      { status: 500 },
    );
  }
}
