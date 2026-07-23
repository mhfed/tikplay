import type { NextRequest } from 'next/server';
import { personalErrorResponse } from '@/lib/api/personal';
import { privateJson, requireSession } from '@/lib/auth/session';
import { exportUserData } from '@/lib/db/postgres/privacy-repository';

export async function GET(req: NextRequest) {
  try {
    const { user } = await requireSession(req.headers);
    const payload = await exportUserData(user.id);
    return privateJson(payload, {
      headers: {
        'Content-Disposition': `attachment; filename="tikplay-export-${user.id}.json"`,
        'Content-Type': 'application/json; charset=utf-8',
      },
    });
  } catch (error) {
    return personalErrorResponse(error);
  }
}
