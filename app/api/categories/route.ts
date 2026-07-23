import {
  getJsonCatalog,
  hasDatabaseUrl,
  publicCatalogError,
  publicCatalogJson,
  toCatalogTrack,
} from '@/lib/api/catalog';
import { categoryName } from '@/lib/categories';
import { catalogRepository } from '@/lib/db/postgres/repositories';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const slug = new URL(req.url).searchParams.get('slug');
    if (slug !== null) {
      if (!slug.trim() || slug.length > 64) {
        return publicCatalogError(
          400,
          'VALIDATION_ERROR',
          'Category is invalid.',
        );
      }

      if (!hasDatabaseUrl()) {
        const tracks = getJsonCatalog();
        const filtered = tracks.filter((t) => t.category === slug);
        return publicCatalogJson({
          ok: true,
          category: { slug, name: categoryName(slug) },
          tracks: filtered,
        });
      }

      const rows = await catalogRepository.listByCategory(slug);
      return publicCatalogJson({
        ok: true,
        category: { slug, name: categoryName(slug) },
        tracks: rows.map(toCatalogTrack),
      });
    }

    if (!hasDatabaseUrl()) {
      const tracks = getJsonCatalog();
      const catMap = new Map<string, number>();
      for (const t of tracks) {
        const cat = t.category ?? '__uncategorized__';
        catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
      }
      const categories = Array.from(catMap.entries())
        .filter(([slug]) => slug !== '__uncategorized__')
        .map(([slug, count]) => ({
          slug,
          name: categoryName(slug),
          count,
        }));
      return publicCatalogJson({ ok: true, categories });
    }

    const rows = await catalogRepository.listCategories();
    return publicCatalogJson({
      ok: true,
      categories: rows.map(({ slug, count }) => ({
        slug,
        name: categoryName(slug),
        count,
      })),
    });
  } catch (error) {
    console.error('Public category request failed.', error);
    return publicCatalogError(
      503,
      'TRANSIENT_ERROR',
      'The catalog is temporarily unavailable.',
    );
  }
}
