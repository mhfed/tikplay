import 'server-only';

import { and, eq, gt, isNull } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { getPostgresDb } from '@/lib/db/postgres/client';
import { sessions, users } from '@/lib/db/postgres/schema';
import { getAuth } from './server';

export type AuthRole = 'user' | 'admin';

export type ValidatedSession = {
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string;
    image: string | null;
    role: AuthRole;
  };
};

export type AuthErrorCode =
  | 'AUTH_REQUIRED'
  | 'SESSION_INVALID'
  | 'ACCOUNT_UNAVAILABLE'
  | 'ROLE_REQUIRED';

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    readonly code: AuthErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

function privateHeaders(): HeadersInit {
  return { 'Cache-Control': 'private, no-store' };
}

export function authErrorResponse(error: AuthError): NextResponse {
  return NextResponse.json(
    { ok: false, code: error.code, error: error.message },
    { status: error.status, headers: privateHeaders() },
  );
}

export async function getOptionalSession(
  headers: Headers,
): Promise<ValidatedSession | null> {
  const candidate = await getAuth().api.getSession({ headers });
  if (!candidate) return null;

  const now = new Date();
  const [row] = await getPostgresDb()
    .select({
      sessionId: sessions.id,
      userId: users.id,
      expiresAt: sessions.expiresAt,
      email: users.email,
      name: users.name,
      image: users.image,
      role: users.role,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(
        eq(sessions.id, candidate.session.id),
        eq(sessions.userId, candidate.user.id),
        gt(sessions.expiresAt, now),
        isNull(sessions.revokedAt),
        isNull(users.deletedAt),
        isNull(users.deletionRequestedAt),
        isNull(users.purgeAfter),
      ),
    )
    .limit(1);

  if (!row) return null;
  if (row.role !== 'user' && row.role !== 'admin') {
    throw new AuthError(403, 'ACCOUNT_UNAVAILABLE', 'Account is unavailable.');
  }

  return {
    session: {
      id: row.sessionId,
      userId: row.userId,
      expiresAt: row.expiresAt,
    },
    user: {
      id: row.userId,
      email: row.email,
      name: row.name,
      image: row.image,
      role: row.role,
    },
  };
}

export async function requireSession(
  headers: Headers,
): Promise<ValidatedSession> {
  const session = await getOptionalSession(headers);
  if (!session) {
    throw new AuthError(401, 'AUTH_REQUIRED', 'Authentication is required.');
  }
  return session;
}

export async function requireRole(
  headers: Headers,
  role: AuthRole,
): Promise<ValidatedSession> {
  const session = await requireSession(headers);
  if (session.user.role !== role) {
    throw new AuthError(403, 'ROLE_REQUIRED', `${role} role is required.`);
  }
  return session;
}

export function privateJson<T>(body: T, init: ResponseInit = {}): NextResponse {
  const headers = new Headers(init.headers);
  headers.set('Cache-Control', 'private, no-store');
  return NextResponse.json(body, { ...init, headers });
}
