import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth/session';

export function isAdminRequest(request: NextRequest): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const authorization = request.headers.get('authorization');
  const received = authorization?.startsWith('Bearer ')
    ? authorization.slice(7)
    : request.headers.get('x-admin-token');

  if (!expected || !received) return false;
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  return (
    expectedBuffer.length === receivedBuffer.length &&
    timingSafeEqual(expectedBuffer, receivedBuffer)
  );
}

/**
 * Transitional admin boundary. New authenticated routes should use this helper;
 * ADMIN_TOKEN remains only for Wave 0 operational callers until those callers
 * can require a Better Auth admin session without breaking automation.
 */
export async function isAdminSessionRequest(
  request: NextRequest,
): Promise<boolean> {
  try {
    await requireRole(request.headers, 'admin');
    return true;
  } catch {
    return false;
  }
}
