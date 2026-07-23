import 'server-only';

import { and, eq, isNull, lt } from 'drizzle-orm';
import { getPostgresDb } from './client';
import {
  accounts,
  autoRules,
  favorites,
  guestImports,
  listeningEvents,
  playlists,
  sessions,
  userLibraryTracks,
  userPreferences,
  users,
} from './schema';

export const DELETION_GRACE_DAYS = 30;

export class PrivacyRepositoryError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'PrivacyRepositoryError';
  }
}

export async function getUserProfile(userId: string) {
  const [user] = await getPostgresDb()
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      locale: users.locale,
      role: users.role,
      emailVerified: users.emailVerified,
      onboardingCompletedAt: users.onboardingCompletedAt,
      deletionRequestedAt: users.deletionRequestedAt,
      purgeAfter: users.purgeAfter,
      deletedAt: users.deletedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user)
    throw new PrivacyRepositoryError('NOT_FOUND', 'Profile not found.');
  return user;
}

export async function updateUserProfile(
  userId: string,
  values: { name?: string; locale?: string; image?: string | null },
) {
  const [user] = await getPostgresDb()
    .update(users)
    .set({ ...values, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      locale: users.locale,
    });
  if (!user)
    throw new PrivacyRepositoryError('NOT_FOUND', 'Profile not found.');
  return user;
}

export async function exportUserData(userId: string) {
  const db = getPostgresDb();
  const [
    user,
    preferences,
    library,
    favoriteRows,
    ownedPlaylists,
    rules,
    events,
    imports,
  ] = await Promise.all([
    getUserProfile(userId),
    db.select().from(userPreferences).where(eq(userPreferences.userId, userId)),
    db
      .select()
      .from(userLibraryTracks)
      .where(eq(userLibraryTracks.userId, userId)),
    db.select().from(favorites).where(eq(favorites.userId, userId)),
    db.select().from(playlists).where(eq(playlists.ownerUserId, userId)),
    db.select().from(autoRules).where(eq(autoRules.ownerUserId, userId)),
    db.select().from(listeningEvents).where(eq(listeningEvents.userId, userId)),
    db.select().from(guestImports).where(eq(guestImports.userId, userId)),
  ]);
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    user,
    preferences,
    library,
    favorites: favoriteRows,
    playlists: ownedPlaylists,
    autoRules: rules,
    listeningEvents: events,
    guestImports: imports,
  };
}

export async function requestDeletion(userId: string) {
  const now = new Date();
  const purgeAfter = new Date(now.getTime() + DELETION_GRACE_DAYS * 86_400_000);
  return getPostgresDb().transaction(async (tx) => {
    const [user] = await tx
      .update(users)
      .set({ deletionRequestedAt: now, purgeAfter, updatedAt: now })
      .where(and(eq(users.id, userId), isNull(users.deletedAt)))
      .returning({
        id: users.id,
        deletionRequestedAt: users.deletionRequestedAt,
        purgeAfter: users.purgeAfter,
      });
    if (!user)
      throw new PrivacyRepositoryError(
        'CONFLICT',
        'Account deletion is already completed.',
      );
    await tx
      .update(sessions)
      .set({
        revokedAt: now,
        revokedReason: 'account-deletion',
        updatedAt: now,
      })
      .where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
    return user;
  });
}

export async function cancelDeletion(userId: string) {
  const [user] = await getPostgresDb()
    .update(users)
    .set({ deletionRequestedAt: null, purgeAfter: null, updatedAt: new Date() })
    .where(and(eq(users.id, userId), isNull(users.deletedAt)))
    .returning({
      id: users.id,
      deletionRequestedAt: users.deletionRequestedAt,
      purgeAfter: users.purgeAfter,
    });
  if (!user)
    throw new PrivacyRepositoryError('CONFLICT', 'Account cannot be restored.');
  return user;
}

export async function purgeUser(userId: string, now = new Date()) {
  return getPostgresDb().transaction(async (tx) => {
    const [user] = await tx
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), lt(users.purgeAfter, now)))
      .limit(1);
    if (!user) return false;
    await tx.delete(accounts).where(eq(accounts.userId, userId));
    await tx.delete(userPreferences).where(eq(userPreferences.userId, userId));
    await tx
      .delete(userLibraryTracks)
      .where(eq(userLibraryTracks.userId, userId));
    await tx.delete(favorites).where(eq(favorites.userId, userId));
    await tx.delete(autoRules).where(eq(autoRules.ownerUserId, userId));
    await tx.delete(listeningEvents).where(eq(listeningEvents.userId, userId));
    await tx.delete(guestImports).where(eq(guestImports.userId, userId));
    await tx.delete(playlists).where(eq(playlists.ownerUserId, userId));
    await tx.delete(sessions).where(eq(sessions.userId, userId));
    await tx.delete(users).where(eq(users.id, userId));
    return true;
  });
}
