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
    if (!isUuid(body.idempotencyKey) || !body.snapshot)
      return validationError('idempotencyKey and snapshot are required.');
    const importRow = await guestImportRepository.preview(
      user.id,
      body.idempotencyKey,
      body.snapshot,
    );
    return privateJson({ ok: true, import: importRow }, { status: 201 });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
