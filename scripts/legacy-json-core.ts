import { createHash } from 'node:crypto';
import type {
  DbBlockedMediaRow,
  DbCopyrightReportRow,
  DbData,
  DbPlaylistRow,
  DbPlaylistTrackRow,
  DbTrackRow,
} from '../lib/db/index';
import { validateMediaUrl } from '../lib/media/source';

export interface LegacyMigrationConfig {
  editorialPlaylistIds: number[];
}

export interface PlannedTrack extends DbTrackRow {
  canonicalUrl: string;
  source: 'tiktok' | 'youtube';
}

export interface PlannedPlaylist extends DbPlaylistRow {
  tracks: DbPlaylistTrackRow[];
}

export interface MigrationReport {
  sourceSha256: string;
  sourceCounts: Record<string, number>;
  importCounts: Record<string, number>;
  skippedCounts: Record<string, number>;
  collisions: Array<{ kind: string; key: string; legacyIds: number[] }>;
  orphans: Array<{ kind: string; id: string; reason: string }>;
  orderIssues: Array<{ playlistId: number; positions: number[] }>;
  blockedKeys: string[];
}

export interface MigrationPlan {
  tracks: PlannedTrack[];
  playlists: PlannedPlaylist[];
  copyrightReports: DbCopyrightReportRow[];
  blockedMedia: DbBlockedMediaRow[];
  report: MigrationReport;
}

const AUDIO_KEY_PATTERN = /^[0-9a-f]{64}$/;

function rows(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Legacy JSON root must be an object.');
  }
  return value as Record<string, unknown>;
}

export function sourceSha256(source: Buffer | string): string {
  return createHash('sha256').update(source).digest('hex');
}

export function parseLegacyJson(source: Buffer | string): DbData {
  const parsed = asRecord(JSON.parse(source.toString()));
  return {
    tracks: rows(parsed.tracks) as DbTrackRow[],
    playlists: rows(parsed.playlists) as DbPlaylistRow[],
    playlistTracks: rows(parsed.playlistTracks) as DbPlaylistTrackRow[],
    favorites: rows(parsed.favorites) as number[],
    autoRules: rows(parsed.autoRules) as DbData['autoRules'],
    copyrightReports: rows(parsed.copyrightReports) as DbCopyrightReportRow[],
    blockedMedia: rows(parsed.blockedMedia) as DbBlockedMediaRow[],
    listeningHistory: rows(
      parsed.listeningHistory,
    ) as DbData['listeningHistory'],
    settings: (parsed.settings ?? {}) as DbData['settings'],
    nextTrackId: Number(parsed.nextTrackId ?? 1),
    nextPlaylistId: Number(parsed.nextPlaylistId ?? 1),
    nextRuleId: Number(parsed.nextRuleId ?? 1),
    nextCopyrightReportId: Number(parsed.nextCopyrightReportId ?? 1),
    nextListeningHistoryId: Number(parsed.nextListeningHistoryId ?? 1),
  };
}

export function planLegacyMigration(
  data: DbData,
  config: LegacyMigrationConfig,
  hash: string,
): MigrationPlan {
  const collisions: MigrationReport['collisions'] = [];
  const orphans: MigrationReport['orphans'] = [];
  const orderIssues: MigrationReport['orderIssues'] = [];
  const trackIds = new Set<number>();
  const canonicalOwners = new Map<string, number[]>();
  const audioOwners = new Map<string, number[]>();
  const tracks: PlannedTrack[] = [];

  for (const track of data.tracks) {
    if (!Number.isSafeInteger(track.id) || trackIds.has(track.id)) {
      collisions.push({
        kind: 'track-legacy-id',
        key: String(track.id),
        legacyIds: [track.id],
      });
      continue;
    }
    trackIds.add(track.id);
    const validation = validateMediaUrl(track.url);
    if (!validation.valid || !validation.normalized || !validation.source) {
      orphans.push({
        kind: 'track',
        id: String(track.id),
        reason: validation.error ?? 'invalid URL',
      });
      continue;
    }
    if (!AUDIO_KEY_PATTERN.test(track.audio_key)) {
      orphans.push({
        kind: 'track',
        id: String(track.id),
        reason: 'invalid audio key',
      });
      continue;
    }
    const canonicalIds = canonicalOwners.get(validation.normalized) ?? [];
    canonicalIds.push(track.id);
    canonicalOwners.set(validation.normalized, canonicalIds);
    const audioIds = audioOwners.get(track.audio_key) ?? [];
    audioIds.push(track.id);
    audioOwners.set(track.audio_key, audioIds);
    tracks.push({
      ...track,
      canonicalUrl: validation.normalized,
      source: validation.source,
    });
  }

  for (const [key, legacyIds] of [...canonicalOwners, ...audioOwners]) {
    if (legacyIds.length > 1)
      collisions.push({ kind: 'track-unique-key', key, legacyIds });
  }
  const collidedTrackIds = new Set(
    collisions.flatMap((item) => item.legacyIds),
  );
  const importTracks = tracks.filter(
    (track) => !collidedTrackIds.has(track.id),
  );
  const importedTrackIds = new Set(importTracks.map((track) => track.id));

  const allowlist = new Set(config.editorialPlaylistIds);
  const playlistById = new Map(
    data.playlists.map((playlist) => [playlist.id, playlist]),
  );
  const playlists: PlannedPlaylist[] = [];
  for (const playlistId of allowlist) {
    const playlist = playlistById.get(playlistId);
    if (!playlist) {
      orphans.push({
        kind: 'editorial-playlist',
        id: String(playlistId),
        reason: 'allowlisted playlist missing',
      });
      continue;
    }
    const links = data.playlistTracks
      .filter((link) => link.playlist_id === playlistId)
      .sort((a, b) => a.position - b.position);
    const positions = links.map((link) => link.position);
    if (
      new Set(positions).size !== positions.length ||
      positions.some((position, index) => position !== index)
    ) {
      orderIssues.push({ playlistId, positions });
    }
    const validLinks = links.filter((link) => {
      if (importedTrackIds.has(link.track_id)) return true;
      orphans.push({
        kind: 'playlist-track',
        id: `${playlistId}:${link.track_id}`,
        reason: 'track not importable',
      });
      return false;
    });
    playlists.push({ ...playlist, tracks: validLinks });
  }

  const reportIds = new Set(data.copyrightReports.map((report) => report.id));
  const copyrightReports = data.copyrightReports.filter((report) => {
    if (AUDIO_KEY_PATTERN.test(report.audio_key)) return true;
    orphans.push({
      kind: 'copyright-report',
      id: String(report.id),
      reason: 'invalid audio key',
    });
    return false;
  });
  const blockedMedia = data.blockedMedia.filter((blocked) => {
    if (
      !AUDIO_KEY_PATTERN.test(blocked.audio_key) ||
      !reportIds.has(blocked.report_id)
    ) {
      orphans.push({
        kind: 'blocked-media',
        id: blocked.audio_key,
        reason: 'invalid key or missing report',
      });
      return false;
    }
    return true;
  });

  return {
    tracks: importTracks,
    playlists,
    copyrightReports,
    blockedMedia,
    report: {
      sourceSha256: hash,
      sourceCounts: {
        tracks: data.tracks.length,
        playlists: data.playlists.length,
        playlistTracks: data.playlistTracks.length,
        copyrightReports: data.copyrightReports.length,
        blockedMedia: data.blockedMedia.length,
        favorites: data.favorites.length,
        listeningHistory: data.listeningHistory.length,
      },
      importCounts: {
        tracks: importTracks.length,
        editorialPlaylists: playlists.length,
        playlistTracks: playlists.reduce(
          (sum, playlist) => sum + playlist.tracks.length,
          0,
        ),
        copyrightReports: copyrightReports.length,
        blockedMedia: blockedMedia.length,
      },
      skippedCounts: {
        favorites: data.favorites.length,
        listeningHistory: data.listeningHistory.length,
        nonAllowlistedPlaylists: data.playlists.filter(
          (playlist) => !allowlist.has(playlist.id),
        ).length,
      },
      collisions,
      orphans,
      orderIssues,
      blockedKeys: [
        ...new Set(data.blockedMedia.map((blocked) => blocked.audio_key)),
      ].sort(),
    },
  };
}
