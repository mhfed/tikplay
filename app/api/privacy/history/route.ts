import type { NextRequest } from 'next/server';
import { personalErrorResponse, validationError } from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { listeningRepository } from '@/lib/db/postgres/repositories';

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body: unknown = await req.json().catch(() => ({}));
    if (
      !body ||
      typeof body !== 'object' ||
      (body as Record<string, unknown>).confirm !== true
    )
      return validationError('History clear requires confirm=true.');
    return privateJson({
      ok: true,
      ...(await listeningRepository.clear(user.id)),
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
