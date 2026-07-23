import { NextResponse } from 'next/server';
import { AuthError, authErrorResponse } from '@/lib/auth/session';
import { GuestImportError } from '@/lib/db/postgres/guest-import-repository';
import { RepositoryError } from '@/lib/db/postgres/repositories';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export function personalErrorResponse(error: unknown): NextResponse {
  if (error instanceof AuthError) return authErrorResponse(error);
  if (error instanceof GuestImportError) {
    const status =
      error.code === 'NOT_FOUND'
        ? 404
        : error.code === 'CONFLICT' || error.code === 'STALE_PREVIEW'
          ? 409
          : 422;
    return NextResponse.json(
      { ok: false, code: error.code, error: error.message },
      { status, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  if (error instanceof RepositoryError) {
    const status =
      error.code === 'NOT_FOUND' ? 404 : error.code === 'CONFLICT' ? 409 : 422;
    return NextResponse.json(
      { ok: false, code: error.code, error: error.message },
      { status, headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
  console.error('Personal API request failed.', error);
  return NextResponse.json(
    {
      ok: false,
      code: 'TRANSIENT_ERROR',
      error: 'The request could not be completed.',
    },
    { status: 503, headers: { 'Cache-Control': 'private, no-store' } },
  );
}

export function validationError(message: string): NextResponse {
  return NextResponse.json(
    { ok: false, code: 'VALIDATION_ERROR', error: message },
    { status: 422, headers: { 'Cache-Control': 'private, no-store' } },
  );
}
