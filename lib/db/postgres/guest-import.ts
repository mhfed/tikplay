import { createHash } from 'node:crypto';

export const GUEST_IMPORT_VERSION = 1;
export const GUEST_IMPORT_MAX_BYTES = 1_000_000;
export const GUEST_IMPORT_MAX_TRACKS = 2_000;
export const GUEST_IMPORT_MAX_PLAYLISTS = 200;
export const GUEST_IMPORT_MAX_PLAYLIST_TRACKS = 2_000;

export type GuestSnapshotTrack = {
  source?: string;
  sourceUrl: string;
  canonicalSourceUrl?: string;
  audioKey?: string;
  title: string;
  author: string;
  coverUrl?: string;
  durationSeconds?: number;
  category?: string;
  defaultStartSeconds?: number | null;
  defaultEndSeconds?: number | null;
};

export type GuestSnapshotPlaylist = {
  name: string;
  visibility?: 'private' | 'unlisted' | 'public';
  trackRefs: string[];
};

export type GuestSnapshot = {
  version: 1;
  tracks: GuestSnapshotTrack[];
  playlists: GuestSnapshotPlaylist[];
};

export type GuestImportCounts = {
  requestedTracks: number;
  requestedPlaylists: number;
  duplicateTracks: number;
  existingTracks: number;
  createdTracks: number;
  linkedTracks: number;
  createdPlaylists: number;
  renamedPlaylists: number;
  playlistTrackLinks: number;
};

export type GuestImportPlan = {
  snapshot: GuestSnapshot;
  payloadHash: string;
  canonicalTracks: GuestSnapshotTrack[];
  playlists: Array<GuestSnapshotPlaylist & { plannedName: string }>;
  counts: GuestImportCounts;
};

function fail(message: string): never {
  throw new Error(`GUEST_IMPORT_INVALID: ${message}`);
}

function text(
  value: unknown,
  field: string,
  max: number,
  required = true,
): string {
  if (typeof value !== 'string') {
    if (!required && value === undefined) return '';
    fail(`${field} must be a string`);
  }
  const result = value.trim();
  if (required && !result) fail(`${field} is required`);
  if (result.length > max) fail(`${field} exceeds ${max} characters`);
  return result;
}

function finite(value: unknown, field: string, fallback: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    fail(`${field} is invalid`);
  return value;
}

function canonicalUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if (
      (url.protocol === 'https:' && url.port === '443') ||
      (url.protocol === 'http:' && url.port === '80')
    )
      url.port = '';
    return url.toString().replace(/\/$/, '');
  } catch {
    fail('sourceUrl is invalid');
  }
}

export function normalizeGuestSnapshot(input: unknown): GuestSnapshot {
  const encoded = JSON.stringify(input);
  if (!encoded || Buffer.byteLength(encoded, 'utf8') > GUEST_IMPORT_MAX_BYTES)
    fail('snapshot exceeds size limit');
  if (!input || typeof input !== 'object') fail('snapshot must be an object');
  const value = input as Record<string, unknown>;
  if (value.version !== GUEST_IMPORT_VERSION)
    fail('unsupported snapshot version');
  if (
    !Array.isArray(value.tracks) ||
    value.tracks.length > GUEST_IMPORT_MAX_TRACKS
  )
    fail('tracks exceed limit');
  if (
    !Array.isArray(value.playlists) ||
    value.playlists.length > GUEST_IMPORT_MAX_PLAYLISTS
  )
    fail('playlists exceed limit');
  const tracks = value.tracks.map((raw, index) => {
    if (!raw || typeof raw !== 'object') fail(`track ${index} is invalid`);
    const item = raw as Record<string, unknown>;
    const sourceUrl = canonicalUrl(
      text(item.sourceUrl, `tracks[${index}].sourceUrl`, 2_000),
    );
    return {
      source:
        text(item.source, `tracks[${index}].source`, 20, false) || 'tiktok',
      sourceUrl,
      canonicalSourceUrl: canonicalUrl(
        text(
          item.canonicalSourceUrl ?? sourceUrl,
          `tracks[${index}].canonicalSourceUrl`,
          2_000,
        ),
      ),
      audioKey:
        text(
          item.audioKey,
          `tracks[${index}].audioKey`,
          64,
          false,
        ).toLowerCase() || undefined,
      title: text(item.title, `tracks[${index}].title`, 200),
      author: text(item.author, `tracks[${index}].author`, 120),
      coverUrl: text(item.coverUrl, `tracks[${index}].coverUrl`, 2_000, false),
      durationSeconds: finite(
        item.durationSeconds,
        `tracks[${index}].durationSeconds`,
        0,
      ),
      category:
        text(item.category, `tracks[${index}].category`, 64, false) || 'others',
      defaultStartSeconds:
        item.defaultStartSeconds == null
          ? null
          : finite(item.defaultStartSeconds, 'defaultStartSeconds', 0),
      defaultEndSeconds:
        item.defaultEndSeconds == null
          ? null
          : finite(item.defaultEndSeconds, 'defaultEndSeconds', 0),
    };
  });
  const playlists: GuestSnapshotPlaylist[] = value.playlists.map(
    (raw, index) => {
      if (!raw || typeof raw !== 'object') fail(`playlist ${index} is invalid`);
      const item = raw as Record<string, unknown>;
      if (
        !Array.isArray(item.trackRefs) ||
        item.trackRefs.length > GUEST_IMPORT_MAX_PLAYLIST_TRACKS
      )
        fail(`playlist ${index} tracks exceed limit`);
      const visibility: GuestSnapshotPlaylist['visibility'] =
        item.visibility === 'public' || item.visibility === 'unlisted'
          ? item.visibility
          : 'private';
      return {
        name: text(item.name, `playlists[${index}].name`, 80),
        visibility,
        trackRefs: item.trackRefs.map((ref) => text(ref, 'trackRefs', 2_000)),
      };
    },
  );
  return { version: 1, tracks, playlists };
}

export function guestSnapshotHash(snapshot: GuestSnapshot): string {
  return createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
}

export function planGuestImport(
  input: unknown,
  occupiedPlaylistNames: Iterable<string> = [],
): GuestImportPlan {
  const snapshot = normalizeGuestSnapshot(input);
  const seen = new Set<string>();
  const canonicalTracks = snapshot.tracks.filter((track) => {
    const key = track.audioKey
      ? `audio:${track.audioKey}`
      : `url:${track.canonicalSourceUrl}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const occupied = new Set(
    [...occupiedPlaylistNames].map((name) => name.toLocaleLowerCase()),
  );
  const playlists = snapshot.playlists.map((playlist) => {
    const base = playlist.name;
    let plannedName = base;
    let suffix = 2;
    while (occupied.has(plannedName.toLocaleLowerCase()))
      plannedName = `${base} (${suffix++})`;
    occupied.add(plannedName.toLocaleLowerCase());
    return { ...playlist, plannedName };
  });
  return {
    snapshot,
    payloadHash: guestSnapshotHash(snapshot),
    canonicalTracks,
    playlists,
    counts: {
      requestedTracks: snapshot.tracks.length,
      requestedPlaylists: snapshot.playlists.length,
      duplicateTracks: snapshot.tracks.length - canonicalTracks.length,
      existingTracks: 0,
      createdTracks: 0,
      linkedTracks: 0,
      createdPlaylists: playlists.length,
      renamedPlaylists: playlists.filter(
        (item) => item.plannedName !== item.name,
      ).length,
      playlistTrackLinks: 0,
    },
  };
}
