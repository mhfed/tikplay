import type { NextRequest } from 'next/server';
import { isUuid, personalErrorResponse } from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { guestImportRepository } from '@/lib/db/postgres/guest-import-repository';

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { user } = await requireSession(req.headers);
    const { id } = await context.params;
    if (!isUuid(id))
      return privateJson(
        { ok: false, code: 'VALIDATION_ERROR', error: 'Import id is invalid.' },
        { status: 422 },
      );
    const importRow = await guestImportRepository.status(user.id, id);
    return privateJson({ ok: true, import: importRow });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
