import type { NextRequest } from 'next/server';
import { toCatalogTrack } from '@/lib/api/catalog';
import {
  isUuid,
  personalErrorResponse,
  validationError,
} from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { favoritesRepository } from '@/lib/db/postgres/repositories';

function hasExactMutationShape(value: unknown): value is {
  trackId: string;
  favorite: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return (
    Object.keys(body).length === 2 &&
    isUuid(body.trackId) &&
    typeof body.favorite === 'boolean'
  );
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const rows = await favoritesRepository.list(user.id);
    return privateJson({
      ok: true,
      tracks: rows.map(({ track, createdAt }) => ({
        ...toCatalogTrack(track),
        isFavorite: true,
        favoritedAt: createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body: unknown = await req.json();
    if (!hasExactMutationShape(body)) {
      return validationError(
        'trackId and explicit favorite state are required.',
      );
    }
    const { trackId, favorite } = body as {
      trackId: string;
      favorite: boolean;
    };
    const result = await favoritesRepository.set(user.id, trackId, favorite);
    return privateJson({ ok: true, trackId, ...result });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
