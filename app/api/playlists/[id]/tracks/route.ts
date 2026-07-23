import type { NextRequest } from 'next/server';
import {
  isUuid,
  personalErrorResponse,
  validationError,
} from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { playlistsRepository } from '@/lib/db/postgres/repositories';

type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, { params }: Context) {
  try {
    const { user } = await requireSession(req.headers);
    const { id } = await params;
    if (!isUuid(id)) return validationError('Playlist id is invalid.');
    const rows = await playlistsRepository.listTracks(user.id, id);
    return privateJson({ ok: true, tracks: rows.map(({ track }) => track) });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: Context) {
  try {
    const { user } = await requireSession(req.headers);
    const { id } = await params;
    const body = await req.json();
    if (!isUuid(id) || !isUuid(body.trackId))
      return validationError('Playlist or track id is invalid.');
    await playlistsRepository.addTrack(user.id, id, body.trackId);
    return privateJson({ ok: true });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest, { params }: Context) {
  try {
    const { user } = await requireSession(req.headers);
    const { id } = await params;
    const body = await req.json();
    if (!isUuid(id) || !isUuid(body.trackId))
      return validationError('Playlist or track id is invalid.');
    await playlistsRepository.removeTrack(user.id, id, body.trackId);
    return privateJson({ ok: true });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function PUT(req: NextRequest, { params }: Context) {
  try {
    const { user } = await requireSession(req.headers);
    const { id } = await params;
    const body = await req.json();
    if (
      !isUuid(id) ||
      !Array.isArray(body.trackIds) ||
      !body.trackIds.every(isUuid)
    ) {
      return validationError('Playlist track order is invalid.');
    }
    await playlistsRepository.reorderTracks(user.id, id, body.trackIds);
    return privateJson({ ok: true });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
