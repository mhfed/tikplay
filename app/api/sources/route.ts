import { NextResponse } from 'next/server';
import { getAllSources, getTracksBySource } from '@/lib/db/queries';
import { MEDIA_SOURCE_LABELS, type MediaSource } from '@/lib/media/source';
import { getFavoriteIds, toTrack } from '../tracks/helpers';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get('source') as MediaSource | null;

  if (source) {
    if (!(source in MEDIA_SOURCE_LABELS)) {
      return NextResponse.json(
        { ok: false, error: 'Nguồn không hợp lệ' },
        { status: 400 },
      );
    }

    const rows = getTracksBySource(source);
    const favIds = getFavoriteIds();
    return NextResponse.json({
      ok: true,
      source: { slug: source, name: MEDIA_SOURCE_LABELS[source] },
      tracks: rows.map((r) => toTrack(r, favIds)),
    });
  }

  return NextResponse.json({ ok: true, sources: getAllSources() });
}
