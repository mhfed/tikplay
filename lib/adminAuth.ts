import { timingSafeEqual } from 'node:crypto';
import type { NextRequest } from 'next/server';

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
