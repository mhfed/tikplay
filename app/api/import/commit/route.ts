import type { NextRequest } from 'next/server';
import {
  isUuid,
  personalErrorResponse,
  validationError,
} from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { guestImportRepository } from '@/lib/db/postgres/guest-import-repository';

export async function POST(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const body = await req.json();
    if (
      !isUuid(body.id) ||
      typeof body.payloadHash !== 'string' ||
      !/^[0-9a-f]{64}$/.test(body.payloadHash)
    )
      return validationError('id and payloadHash are required.');
    const importRow = await guestImportRepository.commit(
      user.id,
      body.id,
      body.payloadHash,
    );
    return privateJson({ ok: true, import: importRow });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
