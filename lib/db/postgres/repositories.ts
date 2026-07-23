import 'server-only';

import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import {
  dedupeLatestSignals,
  type RankingSignal,
  rankEditorial,
  rankRecommendations,
} from '@/lib/personalization/ranking';
import { getPostgresDb } from './client';
import {
  autoRules,
  favorites,
  listeningEvents,
  playlists,
  playlistTracks,
  tracks,
  userLibraryTracks,
  userPreferences,
} from './schema';

type Database = ReturnType<typeof getPostgresDb>;
type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
type Executor = Database | Transaction;

export class RepositoryError extends Error {
  constructor(
    readonly code: 'NOT_FOUND' | 'CONFLICT' | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export type PlaylistVisibility = 'private' | 'unlisted' | 'public';
export type MatchMode = 'contains' | 'starts_with';

export const catalogRepository = {
  async list(executor: Executor = getPostgresDb()) {
    return executor
      .select()
      .from(tracks)
      .orderBy(desc(tracks.createdAt), tracks.id);
  },

  async search(query: string, executor: Executor = getPostgresDb()) {
    const pattern = `%${query.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
    return executor
      .select()
      .from(tracks)
      .where(
        sql`(${tracks.title} ilike ${pattern} escape '\\' or ${tracks.author} ilike ${pattern} escape '\\')`,
      )
      .orderBy(desc(tracks.createdAt), tracks.id);
  },

  async listByIds(trackIds: string[], executor: Executor = getPostgresDb()) {
    if (trackIds.length === 0) return [];
    return executor
      .select()
      .from(tracks)
      .where(inArray(tracks.id, trackIds))
      .orderBy(desc(tracks.createdAt), tracks.id);
  },

  async listCategories(executor: Executor = getPostgresDb()) {
    return executor
      .select({ slug: tracks.category, count: sql<number>`count(*)::int` })
      .from(tracks)
      .groupBy(tracks.category)
      .orderBy(tracks.category);
  },

  async listByCategory(category: string, executor: Executor = getPostgresDb()) {
    return executor
      .select()
      .from(tracks)
      .where(eq(tracks.category, category))
      .orderBy(desc(tracks.createdAt), tracks.id);
  },

  async listSources(executor: Executor = getPostgresDb()) {
    return executor
      .select({ slug: tracks.source, count: sql<number>`count(*)::int` })
      .from(tracks)
      .groupBy(tracks.source)
      .orderBy(tracks.source);
  },

  async listBySource(source: string, executor: Executor = getPostgresDb()) {
    return executor
      .select()
      .from(tracks)
      .where(eq(tracks.source, source))
      .orderBy(desc(tracks.createdAt), tracks.id);
  },

  async findById(trackId: string, executor: Executor = getPostgresDb()) {
    const [track] = await executor
      .select()
      .from(tracks)
      .where(eq(tracks.id, trackId))
      .limit(1);
    return track ?? null;
  },
};

export const libraryRepository = {
  async list(userId: string, executor: Executor = getPostgresDb()) {
    return executor
      .select({ track: tracks, membership: userLibraryTracks })
      .from(userLibraryTracks)
      .innerJoin(tracks, eq(tracks.id, userLibraryTracks.trackId))
      .where(eq(userLibraryTracks.userId, userId))
      .orderBy(desc(userLibraryTracks.addedAt), tracks.id);
  },

  async setSaved(
    userId: string,
    trackId: string,
    saved: boolean,
    executor: Executor = getPostgresDb(),
  ) {
    if (saved) {
      if (!(await catalogRepository.findById(trackId, executor))) {
        throw new RepositoryError('NOT_FOUND', 'Track not found.');
      }
      await executor
        .insert(userLibraryTracks)
        .values({ userId, trackId, sourceKind: 'direct' })
        .onConflictDoNothing();
    } else {
      await executor
        .delete(userLibraryTracks)
        .where(
          and(
            eq(userLibraryTracks.userId, userId),
            eq(userLibraryTracks.trackId, trackId),
          ),
        );
    }
    return { saved };
  },
};

export const favoritesRepository = {
  async list(userId: string, executor: Executor = getPostgresDb()) {
    return executor
      .select({ track: tracks, createdAt: favorites.createdAt })
      .from(favorites)
      .innerJoin(tracks, eq(tracks.id, favorites.trackId))
      .where(eq(favorites.userId, userId))
      .orderBy(desc(favorites.createdAt), tracks.id);
  },

  async set(userId: string, trackId: string, favorite: boolean) {
    return getPostgresDb().transaction(async (tx) => {
      if (!favorite) {
        await tx
          .delete(favorites)
          .where(
            and(eq(favorites.userId, userId), eq(favorites.trackId, trackId)),
          );
        return { isFavorite: false };
      }

      if (!(await catalogRepository.findById(trackId, tx))) {
        throw new RepositoryError('NOT_FOUND', 'Track not found.');
      }
      await tx
        .insert(userLibraryTracks)
        .values({ userId, trackId, sourceKind: 'direct' })
        .onConflictDoNothing();
      await tx
        .insert(favorites)
        .values({ userId, trackId })
        .onConflictDoNothing();
      return { isFavorite: true };
    });
  },
};

export const playlistsRepository = {
  async listOwned(userId: string, executor: Executor = getPostgresDb()) {
    return executor
      .select()
      .from(playlists)
      .where(and(eq(playlists.ownerUserId, userId), eq(playlists.kind, 'user')))
      .orderBy(asc(playlists.sortOrder), playlists.id);
  },

  async create(
    userId: string,
    name: string,
    visibility: PlaylistVisibility = 'private',
    executor: Executor = getPostgresDb(),
  ) {
    const [{ nextOrder }] = await executor
      .select({
        nextOrder: sql<number>`coalesce(max(${playlists.sortOrder}), -1) + 1`,
      })
      .from(playlists)
      .where(eq(playlists.ownerUserId, userId));
    const [playlist] = await executor
      .insert(playlists)
      .values({
        ownerUserId: userId,
        kind: 'user',
        name,
        visibility,
        sortOrder: nextOrder,
      })
      .returning();
    return playlist;
  },

  async rename(userId: string, playlistId: string, name: string) {
    const [playlist] = await getPostgresDb()
      .update(playlists)
      .set({ name, updatedAt: new Date() })
      .where(
        and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)),
      )
      .returning();
    if (!playlist)
      throw new RepositoryError('NOT_FOUND', 'Playlist not found.');
    return playlist;
  },

  async remove(userId: string, playlistId: string) {
    const [playlist] = await getPostgresDb()
      .delete(playlists)
      .where(
        and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)),
      )
      .returning({ id: playlists.id });
    if (!playlist)
      throw new RepositoryError('NOT_FOUND', 'Playlist not found.');
  },

  async reorder(userId: string, playlistIds: string[]) {
    return getPostgresDb().transaction(async (tx) => {
      const owned = await tx
        .select({ id: playlists.id })
        .from(playlists)
        .where(eq(playlists.ownerUserId, userId));
      const ownedIds = new Set(owned.map(({ id }) => id));
      if (
        ownedIds.size !== playlistIds.length ||
        new Set(playlistIds).size !== playlistIds.length ||
        playlistIds.some((id) => !ownedIds.has(id))
      ) {
        throw new RepositoryError(
          'VALIDATION_ERROR',
          'Playlist order must contain every owned playlist exactly once.',
        );
      }
      for (const [sortOrder, id] of playlistIds.entries()) {
        await tx
          .update(playlists)
          .set({ sortOrder, updatedAt: new Date() })
          .where(and(eq(playlists.id, id), eq(playlists.ownerUserId, userId)));
      }
    });
  },

  async listTracks(userId: string, playlistId: string) {
    return getPostgresDb()
      .select({ track: tracks, position: playlistTracks.position })
      .from(playlists)
      .innerJoin(playlistTracks, eq(playlistTracks.playlistId, playlists.id))
      .innerJoin(tracks, eq(tracks.id, playlistTracks.trackId))
      .where(
        and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)),
      )
      .orderBy(playlistTracks.position);
  },

  async addTrack(userId: string, playlistId: string, trackId: string) {
    return getPostgresDb().transaction(async (tx) => {
      const [owned] = await tx
        .select({ id: playlists.id })
        .from(playlists)
        .where(
          and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)),
        )
        .limit(1);
      if (!owned) throw new RepositoryError('NOT_FOUND', 'Playlist not found.');
      const [{ position }] = await tx
        .select({
          position: sql<number>`coalesce(max(${playlistTracks.position}), -1) + 1`,
        })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistId));
      await tx
        .insert(playlistTracks)
        .values({ playlistId, trackId, position, addedByUserId: userId })
        .onConflictDoNothing();
    });
  },

  async removeTrack(userId: string, playlistId: string, trackId: string) {
    return getPostgresDb().transaction(async (tx) => {
      const removed = await tx
        .delete(playlistTracks)
        .where(
          and(
            eq(playlistTracks.playlistId, playlistId),
            eq(playlistTracks.trackId, trackId),
            sql`exists (select 1 from ${playlists} p where p.id = ${playlistId} and p.owner_user_id = ${userId})`,
          ),
        )
        .returning();
      if (removed.length === 0)
        throw new RepositoryError('NOT_FOUND', 'Playlist or track not found.');
      const remaining = await tx
        .select({ trackId: playlistTracks.trackId })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistId))
        .orderBy(playlistTracks.position);
      for (const [position, row] of remaining.entries()) {
        await tx
          .update(playlistTracks)
          .set({ position })
          .where(
            and(
              eq(playlistTracks.playlistId, playlistId),
              eq(playlistTracks.trackId, row.trackId),
            ),
          );
      }
    });
  },

  async reorderTracks(userId: string, playlistId: string, trackIds: string[]) {
    return getPostgresDb().transaction(async (tx) => {
      const current = await tx
        .select({ trackId: playlistTracks.trackId })
        .from(playlistTracks)
        .innerJoin(playlists, eq(playlists.id, playlistTracks.playlistId))
        .where(
          and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)),
        );
      const currentIds = new Set(current.map(({ trackId }) => trackId));
      if (
        currentIds.size !== trackIds.length ||
        new Set(trackIds).size !== trackIds.length ||
        trackIds.some((id) => !currentIds.has(id))
      )
        throw new RepositoryError(
          'VALIDATION_ERROR',
          'Track order must contain every playlist track exactly once.',
        );

      await tx
        .update(playlistTracks)
        .set({ position: sql`${playlistTracks.position} + 1000000` })
        .where(eq(playlistTracks.playlistId, playlistId));
      for (const [position, trackId] of trackIds.entries()) {
        await tx
          .update(playlistTracks)
          .set({ position })
          .where(
            and(
              eq(playlistTracks.playlistId, playlistId),
              eq(playlistTracks.trackId, trackId),
            ),
          );
      }
    });
  },
};

export const autoRulesRepository = {
  async list(userId: string) {
    return getPostgresDb()
      .select()
      .from(autoRules)
      .where(eq(autoRules.ownerUserId, userId))
      .orderBy(autoRules.createdAt);
  },

  async create(
    userId: string,
    playlistId: string,
    keyword: string,
    matchMode: MatchMode,
  ) {
    return getPostgresDb().transaction(async (tx) => {
      const [playlist] = await tx
        .select({ id: playlists.id })
        .from(playlists)
        .where(
          and(eq(playlists.id, playlistId), eq(playlists.ownerUserId, userId)),
        )
        .limit(1);
      if (!playlist) {
        throw new RepositoryError('NOT_FOUND', 'Playlist not found.');
      }
      const [rule] = await tx
        .insert(autoRules)
        .values({ playlistId, ownerUserId: userId, keyword, matchMode })
        .returning();
      return rule;
    });
  },

  async remove(userId: string, ruleId: string) {
    const [rule] = await getPostgresDb()
      .delete(autoRules)
      .where(and(eq(autoRules.id, ruleId), eq(autoRules.ownerUserId, userId)))
      .returning();
    if (!rule) throw new RepositoryError('NOT_FOUND', 'Rule not found.');
  },
};

export const preferencesRepository = {
  async get(userId: string) {
    const [preferences] = await getPostgresDb()
      .insert(userPreferences)
      .values({ userId })
      .onConflictDoNothing()
      .returning();
    if (preferences) return preferences;
    const [existing] = await getPostgresDb()
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    return existing;
  },

  async update(
    userId: string,
    values: Partial<typeof userPreferences.$inferInsert>,
  ) {
    const [preferences] = await getPostgresDb()
      .insert(userPreferences)
      .values({ ...values, userId, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return preferences;
  },
};

export const listeningRepository = {
  async record(
    userId: string,
    input: Omit<typeof listeningEvents.$inferInsert, 'userId'>,
  ) {
    const [preferences] = await getPostgresDb()
      .select({ enabled: userPreferences.personalizationEnabled })
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    if (preferences?.enabled === false) return { recorded: false };
    await getPostgresDb()
      .insert(listeningEvents)
      .values({ ...input, userId })
      .onConflictDoNothing();
    return { recorded: true };
  },

  async clear(userId: string) {
    const deleted = await getPostgresDb()
      .delete(listeningEvents)
      .where(eq(listeningEvents.userId, userId))
      .returning({ id: listeningEvents.id });
    return { deletedCount: deleted.length };
  },

  async purgeExpired(retentionDays = 180) {
    const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
    return getPostgresDb()
      .delete(listeningEvents)
      .where(sql`${listeningEvents.playedAt} < ${cutoff}`)
      .returning({ id: listeningEvents.id });
  },

  async recent(userId: string, limit = 20) {
    const boundedLimit = Math.max(1, Math.min(100, limit));
    return getPostgresDb()
      .select({ event: listeningEvents, track: tracks })
      .from(listeningEvents)
      .innerJoin(tracks, eq(tracks.id, listeningEvents.trackId))
      .where(eq(listeningEvents.userId, userId))
      .orderBy(desc(listeningEvents.playedAt), listeningEvents.id)
      .limit(boundedLimit);
  },

  async stats(userId: string, limit = 20) {
    const rows = await this.recent(userId, 500);
    const signals: RankingSignal[] = rows.map(({ event, track }) => ({
      trackId: event.trackId,
      category: track.category,
      playedAt: event.playedAt,
      completionRatio: event.completionRatio,
      durationListenedSeconds: event.durationListenedSeconds,
      classification: event.classification as RankingSignal['classification'],
    }));
    const latest = dedupeLatestSignals(signals);
    const preferences = await preferencesRepository.get(userId);
    const catalog = await catalogRepository.list();
    const ranked =
      preferences?.personalizationEnabled === false
        ? rankEditorial(catalog, 'EDITORIAL_PERSONALIZATION_OFF', limit)
        : latest.length < 2
          ? rankEditorial(catalog, 'EDITORIAL_INSUFFICIENT_SIGNALS', limit)
          : rankRecommendations(catalog, signals, new Date(), limit);
    return {
      personalizationEnabled: preferences?.personalizationEnabled !== false,
      signalLevel: latest.length < 2 ? 'insufficient' : 'sufficient',
      recent: rows.slice(0, limit),
      recommendations: ranked,
    };
  },
};

export async function favoriteTrackIds(userId: string, trackIds: string[]) {
  if (trackIds.length === 0) return new Set<string>();
  const rows = await getPostgresDb()
    .select({ trackId: favorites.trackId })
    .from(favorites)
    .where(
      and(eq(favorites.userId, userId), inArray(favorites.trackId, trackIds)),
    );
  return new Set(rows.map(({ trackId }) => trackId));
}
