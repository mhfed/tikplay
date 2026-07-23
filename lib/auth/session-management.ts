import 'server-only';

import { and, desc, eq, isNull, ne } from 'drizzle-orm';
import { getPostgresDb } from '@/lib/db/postgres/client';
import { sessions } from '@/lib/db/postgres/schema';
import { getAuth } from './server';
import { AuthError, requireSession } from './session';

export type SessionSummary = {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  lastSeenAt: Date;
  deviceLabel: string | null;
  browserFamily: string | null;
  current: boolean;
};

function browserFamily(userAgent: string | null): string | null {
  if (!userAgent) return null;
  if (/Edg\//.test(userAgent)) return 'Edge';
  if (/Firefox\//.test(userAgent)) return 'Firefox';
  if (/Chrome\//.test(userAgent)) return 'Chrome';
  if (/Safari\//.test(userAgent)) return 'Safari';
  return 'Other';
}

export async function listOwnedSessions(
  headers: Headers,
): Promise<SessionSummary[]> {
  const current = await requireSession(headers);
  const rows = await getPostgresDb()
    .select({
      id: sessions.id,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
      expiresAt: sessions.expiresAt,
      lastSeenAt: sessions.lastSeenAt,
      deviceLabel: sessions.deviceLabel,
      userAgent: sessions.userAgent,
    })
    .from(sessions)
    .where(
      and(eq(sessions.userId, current.user.id), isNull(sessions.revokedAt)),
    )
    .orderBy(desc(sessions.lastSeenAt));

  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    expiresAt: row.expiresAt,
    lastSeenAt: row.lastSeenAt,
    deviceLabel: row.deviceLabel,
    browserFamily: browserFamily(row.userAgent),
    current: row.id === current.session.id,
  }));
}

export async function revokeOwnedSession(
  headers: Headers,
  sessionId: string,
): Promise<void> {
  const current = await requireSession(headers);
  if (sessionId === current.session.id) {
    throw new AuthError(
      403,
      'SESSION_INVALID',
      'Use logout to revoke the current session.',
    );
  }

  const revoked = await getPostgresDb()
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokedReason: 'user-revoked',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessions.id, sessionId),
        eq(sessions.userId, current.user.id),
        isNull(sessions.revokedAt),
      ),
    )
    .returning({ id: sessions.id });

  if (revoked.length === 0) {
    throw new AuthError(403, 'SESSION_INVALID', 'Session is not revocable.');
  }
}

export async function revokeOtherOwnedSessions(
  headers: Headers,
): Promise<number> {
  const current = await requireSession(headers);
  const revoked = await getPostgresDb()
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokedReason: 'other-sessions-revoked',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessions.userId, current.user.id),
        ne(sessions.id, current.session.id),
        isNull(sessions.revokedAt),
      ),
    )
    .returning({ id: sessions.id });
  return revoked.length;
}

export async function logoutCurrentSession(headers: Headers): Promise<Headers> {
  const current = await requireSession(headers);
  const responseHeaders = new Headers();
  await getAuth()
    .api.signOut({ headers, asResponse: true })
    .then((response) => {
      for (const cookie of response.headers.getSetCookie()) {
        responseHeaders.append('set-cookie', cookie);
      }
    });
  await getPostgresDb()
    .update(sessions)
    .set({
      revokedAt: new Date(),
      revokedReason: 'logout',
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(sessions.id, current.session.id),
        eq(sessions.userId, current.user.id),
      ),
    );
  return responseHeaders;
}
