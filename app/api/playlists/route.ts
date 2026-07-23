import type { NextRequest } from 'next/server';
import {
  isUuid,
  personalErrorResponse,
  validationError,
} from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import {
  type PlaylistVisibility,
  playlistsRepository,
} from '@/lib/db/postgres/repositories';

const VISIBILITIES = new Set<PlaylistVisibility>([
  'private',
  'unlisted',
  'public',
]);

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    return privateJson({
      ok: true,
      playlists: await playlistsRepository.listOwned(user.id),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body = await req.json();
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const visibility = body.visibility ?? 'private';
    if (!name || name.length > 80 || !VISIBILITIES.has(visibility)) {
      return validationError('Playlist name or visibility is invalid.');
    }
    const playlist = await playlistsRepository.create(
      user.id,
      name,
      visibility,
    );
    return privateJson({ ok: true, playlist }, { status: 201 });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body = await req.json();
    if (Array.isArray(body.ids)) {
      if (!body.ids.every(isUuid))
        return validationError('Playlist order is invalid.');
      await playlistsRepository.reorder(user.id, body.ids);
      return privateJson({ ok: true });
    }
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!isUuid(body.id) || !name || name.length > 80) {
      return validationError('Playlist update is invalid.');
    }
    const playlist = await playlistsRepository.rename(user.id, body.id, name);
    return privateJson({ ok: true, playlist });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body = await req.json();
    if (!isUuid(body.id)) return validationError('Playlist id is invalid.');
    await playlistsRepository.remove(user.id, body.id);
    return privateJson({ ok: true });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
