import type { NextRequest } from 'next/server';
import { personalErrorResponse, validationError } from '@/lib/api/personal';
import { privateJson } from '@/lib/auth/session';
import {
  listOwnedSessions,
  revokeOtherOwnedSessions,
  revokeOwnedSession,
} from '@/lib/auth/session-management';

export async function GET(req: NextRequest) {
  try {
    return privateJson({
      ok: true,
      sessions: await listOwnedSessions(req.headers),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body: unknown = await req.json().catch(() => ({}));
    if (
      !body ||
      typeof body !== 'object' ||
      typeof (body as Record<string, unknown>).sessionId !== 'string'
    )
      return validationError('sessionId is required.');
    await revokeOwnedSession(
      req.headers,
      (body as { sessionId: string }).sessionId,
    );
    return privateJson({ ok: true });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const revokedCount = await revokeOtherOwnedSessions(req.headers);
    return privateJson({ ok: true, revokedCount });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
