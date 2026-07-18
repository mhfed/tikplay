import { existsSync } from 'node:fs';
import { basename } from 'node:path';
import { CATEGORIES, detectCategory } from '../categories';
import { MEDIA_SOURCE_LABELS, type MediaSource } from '../media/source';
import type {
  AutoRule,
  DbTrack,
  MusicCategory,
  MusicSource,
  Playlist,
} from '../types';
import { type DbTrackRow, getDb, saveDb } from './index';

function toDbTrack(row: DbTrackRow): DbTrack {
  return row as DbTrack;
}

function trackSource(row: Pick<DbTrackRow, 'source'>): MediaSource {
  return row.source ?? 'tiktok';
}

// ── TRACKS ──────────────────────────────────────────────

export function getAllTracks(): DbTrack[] {
  return getDb()
    .tracks.slice()
    .sort((a, b) => b.added_at - a.added_at)
    .map(toDbTrack);
}

export function getTrack(id: number): DbTrack | undefined {
  return getDb().tracks.find((t) => t.id === id) as DbTrack | undefined;
}

export function getTrackByUrl(url: string): DbTrack | undefined {
  return getDb().tracks.find((t) => t.url === url) as DbTrack | undefined;
}

export function upsertTrack(t: Omit<DbTrack, 'id'>): DbTrack {
  const db = getDb();
  const existing = db.tracks.find(
    (r) => r.url === t.url || r.audio_key === t.audio_key,
  );
  if (existing) {
    existing.title = t.title;
    existing.author = t.author;
    existing.cover = t.cover;
    existing.duration = t.duration;
    existing.source = t.source ?? trackSource(existing);
    saveDb();
    return toDbTrack(existing);
  }
  const id = db.nextTrackId++;
  const category = t.category || detectCategory(t.title, t.author);
  const row: DbTrackRow = { id, ...t, category };
  db.tracks.push(row);
  saveDb();
  return toDbTrack(row);
}

export function deleteTrack(id: number): void {
  const db = getDb();
  db.tracks = db.tracks.filter((t) => t.id !== id);
  db.playlistTracks = db.playlistTracks.filter((pt) => pt.track_id !== id);
  db.favorites = db.favorites.filter((fid) => fid !== id);
  saveDb();
}

export function searchTracks(q: string): DbTrack[] {
  const lower = q.toLowerCase();
  return getDb()
    .tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(lower) ||
        t.author.toLowerCase().includes(lower),
    )
    .sort((a, b) => b.added_at - a.added_at)
    .map(toDbTrack);
}

// ── PLAYLISTS ───────────────────────────────────────────

export function getAllPlaylists(): Playlist[] {
  const db = getDb();
  return db.playlists
    .slice()
    .sort((a, b) => a.sort_order - b.sort_order || a.id - b.id)
    .map((p) => ({
      ...p,
      trackCount: db.playlistTracks.filter((pt) => pt.playlist_id === p.id)
        .length,
    }));
}

export function createPlaylist(name: string): Playlist {
  const db = getDb();
  const maxOrder = db.playlists.reduce((m, p) => Math.max(m, p.sort_order), 0);
  const row = {
    id: db.nextPlaylistId++,
    name,
    sort_order: maxOrder + 1,
    created_at: Date.now(),
  };
  db.playlists.push(row);
  saveDb();
  return { ...row, trackCount: 0 };
}

export function renamePlaylist(id: number, name: string): void {
  const db = getDb();
  const p = db.playlists.find((r) => r.id === id);
  if (p) p.name = name;
  saveDb();
}

export function deletePlaylist(id: number): void {
  if (id === 1) return;
  const db = getDb();
  db.playlists = db.playlists.filter((p) => p.id !== id);
  db.playlistTracks = db.playlistTracks.filter((pt) => pt.playlist_id !== id);
  db.autoRules = db.autoRules.filter((r) => r.playlist_id !== id);
  saveDb();
}

export function reorderPlaylists(ids: number[]): void {
  const db = getDb();
  ids.forEach((id, i) => {
    const p = db.playlists.find((r) => r.id === id);
    if (p) p.sort_order = i;
  });
  saveDb();
}

// ── PLAYLIST TRACKS ─────────────────────────────────────

export function getPlaylistTracks(playlistId: number): DbTrack[] {
  if (playlistId === 1) return getAllTracks();
  const db = getDb();
  const pts = db.playlistTracks
    .filter((pt) => pt.playlist_id === playlistId)
    .sort((a, b) => a.position - b.position);
  return pts
    .map((pt) => db.tracks.find((t) => t.id === pt.track_id))
    .filter(Boolean)
    .map((t) => toDbTrack(t!));
}

export function addTrackToPlaylist(playlistId: number, trackId: number): void {
  if (playlistId === 1) return;
  const db = getDb();
  const exists = db.playlistTracks.find(
    (pt) => pt.playlist_id === playlistId && pt.track_id === trackId,
  );
  if (exists) return;
  const maxPos = db.playlistTracks
    .filter((pt) => pt.playlist_id === playlistId)
    .reduce((m, pt) => Math.max(m, pt.position), -1);
  db.playlistTracks.push({
    playlist_id: playlistId,
    track_id: trackId,
    position: maxPos + 1,
    added_at: Date.now(),
  });
  saveDb();
}

export function removeTrackFromPlaylist(
  playlistId: number,
  trackId: number,
): void {
  const db = getDb();
  db.playlistTracks = db.playlistTracks.filter(
    (pt) => !(pt.playlist_id === playlistId && pt.track_id === trackId),
  );
  saveDb();
}

export function reorderPlaylistTracks(
  playlistId: number,
  trackIds: number[],
): void {
  const db = getDb();
  trackIds.forEach((tid, i) => {
    const pt = db.playlistTracks.find(
      (r) => r.playlist_id === playlistId && r.track_id === tid,
    );
    if (pt) pt.position = i;
  });
  saveDb();
}

// ── FAVORITES ───────────────────────────────────────────

export function getFavoriteIds(): Set<number> {
  return new Set(getDb().favorites);
}

export function toggleFavorite(trackId: number): boolean {
  const db = getDb();
  const idx = db.favorites.indexOf(trackId);
  if (idx >= 0) {
    db.favorites.splice(idx, 1);
    saveDb();
    return false;
  }
  db.favorites.push(trackId);
  saveDb();
  return true;
}

export function getFavoriteTracks(): DbTrack[] {
  const db = getDb();
  const favSet = new Set(db.favorites);
  return db.tracks.filter((t) => favSet.has(t.id)).map(toDbTrack);
}

// ── AUTO RULES ──────────────────────────────────────────

export function getAutoRules(): AutoRule[] {
  return getDb().autoRules as AutoRule[];
}

export function createAutoRule(
  playlistId: number,
  keyword: string,
  matchMode: string = 'contains',
): AutoRule {
  const db = getDb();
  const rule = {
    id: db.nextRuleId++,
    playlist_id: playlistId,
    keyword,
    match_mode: matchMode,
  };
  db.autoRules.push(rule);
  saveDb();
  return rule as AutoRule;
}

export function deleteAutoRule(id: number): void {
  const db = getDb();
  db.autoRules = db.autoRules.filter((r) => r.id !== id);
  saveDb();
}

export function applyAutoRules(
  trackId: number,
  title: string,
  author: string,
): void {
  const rules = getAutoRules();
  const text = `${title} ${author}`.toLowerCase();
  for (const rule of rules) {
    let matched = false;
    const kw = rule.keyword.toLowerCase();
    if (rule.match_mode === 'contains') matched = text.includes(kw);
    else if (rule.match_mode === 'starts_with') matched = text.startsWith(kw);
    if (matched) addTrackToPlaylist(rule.playlist_id, trackId);
  }
}

// ── CATEGORIES ───────────────────────────────────────────

/** Get all categories that have at least one track, with counts. */
export function getAllCategories(): MusicCategory[] {
  const db = getDb();
  const countMap = new Map<string, number>();
  for (const t of db.tracks) {
    const cat = (t as DbTrackRow).category || 'others';
    countMap.set(cat, (countMap.get(cat) || 0) + 1);
  }
  return CATEGORIES.map((c) => ({
    slug: c.slug,
    name: c.name,
    count: countMap.get(c.slug) || 0,
  })).concat(
    countMap.has('others')
      ? [{ slug: 'others', name: 'Khác', count: countMap.get('others')! }]
      : [],
  );
}

/** Get tracks filtered by category slug. */
export function getTracksByCategory(category: string): DbTrack[] {
  return getDb()
    .tracks.filter((t) => (t.category || 'others') === category)
    .sort((a, b) => b.added_at - a.added_at)
    .map(toDbTrack);
}

// ── SOURCES ──────────────────────────────────────────────

export function getAllSources(): MusicSource[] {
  const db = getDb();
  const countMap = new Map<MediaSource, number>();
  for (const t of db.tracks) {
    const source = trackSource(t);
    countMap.set(source, (countMap.get(source) || 0) + 1);
  }

  return (Object.keys(MEDIA_SOURCE_LABELS) as MediaSource[]).map((slug) => ({
    slug,
    name: MEDIA_SOURCE_LABELS[slug],
    count: countMap.get(slug) || 0,
  }));
}

export function getTracksBySource(source: MediaSource): DbTrack[] {
  return getDb()
    .tracks.filter((t) => trackSource(t) === source)
    .sort((a, b) => b.added_at - a.added_at)
    .map(toDbTrack);
}

// ── SETTINGS ─────────────────────────────────────────────

export function getYoutubeCookiesInfo() {
  const settings = getDb().settings || {};
  if (settings.youtubeCookiesB64) {
    return {
      configured: true,
      source: 'db' as const,
      updatedAt: settings.youtubeCookiesUpdatedAt || null,
      fileName: settings.youtubeCookiesFileName || null,
    };
  }

  const envCookiesPath = process.env.YOUTUBE_COOKIES_PATH;
  if (
    process.env.YOUTUBE_COOKIES_B64 ||
    (envCookiesPath && existsSync(envCookiesPath))
  ) {
    return {
      configured: true,
      source: 'env' as const,
      updatedAt: null,
      fileName: envCookiesPath ? basename(envCookiesPath) : null,
    };
  }

  return {
    configured: false,
    source: null,
    updatedAt: null,
    fileName: null,
  };
}

export function setYoutubeCookies(fileName: string | null, cookiesB64: string) {
  const db = getDb();
  db.settings = {
    ...(db.settings || {}),
    youtubeCookiesB64: cookiesB64,
    youtubeCookiesUpdatedAt: Date.now(),
    youtubeCookiesFileName: fileName || undefined,
  };
  saveDb();
  return getYoutubeCookiesInfo();
}
