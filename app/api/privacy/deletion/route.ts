import type { NextRequest } from 'next/server';
import { personalErrorResponse, validationError } from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import {
  cancelDeletion,
  requestDeletion,
} from '@/lib/db/postgres/privacy-repository';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body: unknown = await req.json().catch(() => ({}));
    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body) ||
      (body as Record<string, unknown>).confirm !== true
    ) {
      return validationError('Deletion requires confirm=true.');
    }
    return privateJson({ ok: true, deletion: await requestDeletion(user.id) });
  } catch (error) {
    return personalErrorResponse(error);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    return privateJson({ ok: true, deletion: await cancelDeletion(user.id) });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
