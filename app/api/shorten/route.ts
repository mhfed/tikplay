import { NextResponse } from 'next/server';
import { getOrCreateShortLink, shortUrl } from '@/lib/shortlink';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      target_type: 'track' | 'playlist';
      target_id: number;
    };
    const { target_type, target_id } = body;

    if (!target_type || !['track', 'playlist'].includes(target_type)) {
      return NextResponse.json(
        { error: 'target_type must be "track" or "playlist"' },
        { status: 400 },
      );
    }
    if (typeof target_id !== 'number' || !Number.isFinite(target_id)) {
      return NextResponse.json(
        { error: 'target_id must be a number' },
        { status: 400 },
      );
    }

    const code = getOrCreateShortLink(target_type, target_id);
    return NextResponse.json({ ok: true, code, url: shortUrl(code) });
  } catch {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }
}
