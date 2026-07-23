import 'server-only';

import { createHash } from 'node:crypto';
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { getPostgresDb } from './client';
import {
  GUEST_IMPORT_VERSION,
  type GuestImportPlan,
  planGuestImport,
} from './guest-import';
import {
  guestImports,
  playlists,
  playlistTracks,
  tracks,
  userLibraryTracks,
} from './schema';

const PREVIEW_TTL_MS = 15 * 60 * 1000;
type ImportCounts = Record<string, number>;

export class GuestImportError extends Error {
  constructor(
    readonly code:
      | 'NOT_FOUND'
      | 'CONFLICT'
      | 'STALE_PREVIEW'
      | 'VALIDATION_ERROR',
    message: string,
  ) {
    super(message);
    this.name = 'GuestImportError';
  }
}

function counts(plan: GuestImportPlan): ImportCounts {
  return { ...plan.counts };
}

function audioKey(url: string, supplied?: string): string {
  return supplied && /^[0-9a-f]{64}$/.test(supplied)
    ? supplied
    : createHash('sha256').update(url).digest('hex');
}

export const guestImportRepository = {
  async preview(userId: string, idempotencyKey: string, input: unknown) {
    const plan = planGuestImport(input);
    const db = getPostgresDb();
    const [inserted] = await db
      .insert(guestImports)
      .values({
        userId,
        idempotencyKey,
        payloadHash: plan.payloadHash,
        snapshotVersion: GUEST_IMPORT_VERSION,
        snapshot: plan.snapshot,
        previewExpiresAt: new Date(Date.now() + PREVIEW_TTL_MS),
        status: 'pending',
        requestedCounts: counts(plan),
      })
      .onConflictDoNothing({
        target: [guestImports.userId, guestImports.idempotencyKey],
      })
      .returning();
    const row =
      inserted ??
      (
        await db
          .select()
          .from(guestImports)
          .where(
            and(
              eq(guestImports.userId, userId),
              eq(guestImports.idempotencyKey, idempotencyKey),
            ),
          )
          .limit(1)
      )[0];
    if (!row) throw new Error('Guest import preview could not be persisted.');
    if (row.payloadHash !== plan.payloadHash)
      throw new GuestImportError(
        'CONFLICT',
        'Idempotency key is bound to another payload.',
      );
    return row;
  },

  async status(userId: string, id: string) {
    const [row] = await getPostgresDb()
      .select()
      .from(guestImports)
      .where(and(eq(guestImports.id, id), eq(guestImports.userId, userId)))
      .limit(1);
    if (!row) throw new GuestImportError('NOT_FOUND', 'Import not found.');
    return row;
  },

  async commit(userId: string, id: string, payloadHash: string) {
    return getPostgresDb().transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtextextended(${id}, 0))`,
      );
      const [row] = await tx
        .select()
        .from(guestImports)
        .where(and(eq(guestImports.id, id), eq(guestImports.userId, userId)))
        .limit(1);
      if (!row) throw new GuestImportError('NOT_FOUND', 'Import not found.');
      if (row.payloadHash !== payloadHash)
        throw new GuestImportError(
          'CONFLICT',
          'Preview payload hash does not match.',
        );
      if (row.status === 'completed') return row;
      if (row.previewExpiresAt <= new Date())
        throw new GuestImportError('STALE_PREVIEW', 'Preview has expired.');

      await tx
        .update(guestImports)
        .set({
          status: 'processing',
          startedAt: new Date(),
          updatedAt: new Date(),
          errorCode: null,
        })
        .where(eq(guestImports.id, id));
      const owned = await tx
        .select({ name: playlists.name })
        .from(playlists)
        .where(
          and(eq(playlists.ownerUserId, userId), eq(playlists.kind, 'user')),
        )
        .orderBy(asc(playlists.sortOrder));
      const plan = planGuestImport(
        row.snapshot,
        owned.map(({ name }) => name),
      );
      const urls = plan.canonicalTracks.map(
        (track) => track.canonicalSourceUrl ?? track.sourceUrl,
      );
      const existing = urls.length
        ? await tx
            .select()
            .from(tracks)
            .where(inArray(tracks.canonicalSourceUrl, urls))
        : [];
      const byUrl = new Map(
        existing.map((track) => [track.canonicalSourceUrl, track]),
      );
      let createdTracks = 0;
      let linkedTracks = 0;

      for (const track of plan.canonicalTracks) {
        const url = track.canonicalSourceUrl ?? track.sourceUrl;
        let catalogTrack = byUrl.get(url);
        if (!catalogTrack) {
          const [created] = await tx
            .insert(tracks)
            .values({
              source: track.source ?? 'tiktok',
              sourceUrl: track.sourceUrl,
              canonicalSourceUrl: url,
              audioKey: audioKey(url, track.audioKey),
              title: track.title,
              author: track.author,
              coverUrl: track.coverUrl ?? '',
              durationSeconds: track.durationSeconds ?? 0,
              category: track.category ?? 'others',
              defaultStartSeconds: track.defaultStartSeconds,
              defaultEndSeconds: track.defaultEndSeconds,
            })
            .onConflictDoNothing({ target: tracks.canonicalSourceUrl })
            .returning();
          catalogTrack =
            created ??
            (
              await tx
                .select()
                .from(tracks)
                .where(eq(tracks.canonicalSourceUrl, url))
                .limit(1)
            )[0];
          if (created) createdTracks++;
          if (catalogTrack) byUrl.set(url, catalogTrack);
        }
        if (!catalogTrack) throw new Error('Canonical track upsert failed.');
        const membership = await tx
          .insert(userLibraryTracks)
          .values({
            userId,
            trackId: catalogTrack.id,
            sourceKind: 'guest_import',
            guestImportId: id,
          })
          .onConflictDoNothing()
          .returning();
        linkedTracks += membership.length;
      }

      const [{ nextOrder }] = await tx
        .select({
          nextOrder: sql<number>`coalesce(max(${playlists.sortOrder}), -1) + 1`,
        })
        .from(playlists)
        .where(eq(playlists.ownerUserId, userId));
      let playlistTrackLinks = 0;
      for (const [offset, playlist] of plan.playlists.entries()) {
        const [created] = await tx
          .insert(playlists)
          .values({
            ownerUserId: userId,
            kind: 'user',
            name: playlist.plannedName,
            visibility: playlist.visibility,
            sortOrder: nextOrder + offset,
          })
          .returning();
        const uniqueIds: string[] = [];
        for (const ref of playlist.trackRefs) {
          const normalizedRef = (() => {
            try {
              return new URL(ref).toString().replace(/\/$/, '');
            } catch {
              return ref;
            }
          })();
          const match =
            byUrl.get(normalizedRef) ??
            [...byUrl.values()].find((track) => track.audioKey === ref);
          if (match && !uniqueIds.includes(match.id)) uniqueIds.push(match.id);
        }
        if (uniqueIds.length) {
          await tx.insert(playlistTracks).values(
            uniqueIds.map((trackId, position) => ({
              playlistId: created.id,
              trackId,
              position,
              addedByUserId: userId,
            })),
          );
          playlistTrackLinks += uniqueIds.length;
        }
      }

      const resultCounts = {
        ...counts(plan),
        existingTracks: existing.length,
        createdTracks,
        linkedTracks,
        playlistTrackLinks,
      };
      const [completed] = await tx
        .update(guestImports)
        .set({
          status: 'completed',
          resultCounts,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(guestImports.id, id))
        .returning();
      return completed;
    });
  },
};
