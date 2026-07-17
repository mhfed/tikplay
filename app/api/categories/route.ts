import { NextResponse } from 'next/server';
import {
  getAllCategories,
  getTracksByCategory,
} from '@/lib/db/queries';
import { getFavoriteIds, toTrack } from '../tracks/helpers';
import { categoryName } from '@/lib/categories';

export const dynamic = 'force-dynamic';

/**
 * GET /api/categories
 *   → { ok: true, categories: [{ slug, name, count }] }
 *
 * GET /api/categories?slug=pop
 *   → { ok: true, category: { slug, name }, tracks: [...] }
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get('slug');

  if (slug) {
    const rows = getTracksByCategory(slug);
    const favIds = getFavoriteIds();
    return NextResponse.json({
      ok: true,
      category: { slug, name: categoryName(slug) },
      tracks: rows.map((r) => toTrack(r, favIds)),
    });
  }

  const categories = getAllCategories();
  return NextResponse.json({ ok: true, categories });
}
