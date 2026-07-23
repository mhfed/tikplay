import {
  getJsonCatalog,
  hasDatabaseUrl,
  publicCatalogError,
  publicCatalogJson,
  toCatalogTrack,
} from '@/lib/api/catalog';
import { catalogRepository } from '@/lib/db/postgres/repositories';
import { MEDIA_SOURCE_LABELS, type MediaSource } from '@/lib/media/source';

export const dynamic = 'force-dynamic';

function isMediaSource(value: string): value is MediaSource {
  return value in MEDIA_SOURCE_LABELS;
}

export async function GET(req: Request) {
  try {
    const source = new URL(req.url).searchParams.get('source');
    if (source !== null) {
      if (!isMediaSource(source)) {
        return publicCatalogError(
          400,
          'VALIDATION_ERROR',
          'Source is invalid.',
        );
      }

      if (!hasDatabaseUrl()) {
        const tracks = getJsonCatalog();
        const filtered = tracks.filter((t) => t.source === source);
        return publicCatalogJson({
          ok: true,
          source: { slug: source, name: MEDIA_SOURCE_LABELS[source] },
          tracks: filtered,
        });
      }

      const rows = await catalogRepository.listBySource(source);
      return publicCatalogJson({
        ok: true,
        source: { slug: source, name: MEDIA_SOURCE_LABELS[source] },
        tracks: rows.map(toCatalogTrack),
      });
    }

    if (!hasDatabaseUrl()) {
      const tracks = getJsonCatalog();
      const srcMap = new Map<string, number>();
      for (const t of tracks) {
        srcMap.set(t.source, (srcMap.get(t.source) ?? 0) + 1);
      }
      const sources = Array.from(srcMap.entries()).map(([slug, count]) => ({
        slug,
        name: isMediaSource(slug) ? MEDIA_SOURCE_LABELS[slug] : slug,
        count,
      }));
      return publicCatalogJson({ ok: true, sources });
    }

    const rows = await catalogRepository.listSources();
    return publicCatalogJson({
      ok: true,
      sources: rows.map(({ slug, count }) => ({
        slug,
        name: isMediaSource(slug) ? MEDIA_SOURCE_LABELS[slug] : slug,
        count,
      })),
    });
  } catch (error) {
    console.error('Public source request failed.', error);
    return publicCatalogError(
      503,
      'TRANSIENT_ERROR',
      'The catalog is temporarily unavailable.',
    );
  }
}
