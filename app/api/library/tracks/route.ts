import type { NextRequest } from 'next/server';
import { toCatalogTrack } from '@/lib/api/catalog';
import {
  isUuid,
  personalErrorResponse,
  validationError,
} from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { libraryRepository } from '@/lib/db/postgres/repositories';

function hasExactMutationShape(value: unknown): value is {
  trackId: string;
  saved: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const body = value as Record<string, unknown>;
  return (
    Object.keys(body).length === 2 &&
    isUuid(body.trackId) &&
    typeof body.saved === 'boolean'
  );
}

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const rows = await libraryRepository.list(user.id);
    return privateJson({
      ok: true,
      tracks: rows.map(({ track, membership }) => ({
        ...toCatalogTrack(track),
        saved: true,
        addedAt: membership.addedAt.toISOString(),
        customTitle: membership.customTitle,
        customAuthor: membership.customAuthor,
        startSeconds: membership.startSeconds,
        endSeconds: membership.endSeconds,
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
      return validationError('trackId and explicit saved state are required.');
    }
    const result = await libraryRepository.setSaved(
      user.id,
      body.trackId,
      body.saved,
    );
    return privateJson({ ok: true, trackId: body.trackId, ...result });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
