import fs from 'node:fs';
import path from 'node:path';
import type { MediaSource } from '@/lib/media/source';

export interface DbData {
  tracks: DbTrackRow[];
  playlists: DbPlaylistRow[];
  playlistTracks: DbPlaylistTrackRow[];
  favorites: number[];
  autoRules: DbAutoRuleRow[];
  copyrightReports: DbCopyrightReportRow[];
  blockedMedia: DbBlockedMediaRow[];
  listeningHistory: DbListeningHistoryRow[];
  settings: DbSettingsRow;
  nextTrackId: number;
  nextPlaylistId: number;
  nextRuleId: number;
  nextCopyrightReportId: number;
  nextListeningHistoryId: number;
}

export interface DbSettingsRow {
  youtubeCookiesB64?: string;
  youtubeCookiesUpdatedAt?: number;
  youtubeCookiesFileName?: string;
}

export interface DbTrackRow {
  id: number;
  url: string;
  audio_key: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  added_at: number;
  source?: MediaSource;
  category?: string;
  start_time?: number;
  end_time?: number;
  play_count?: number;
  last_played_at?: number;
  slug?: string;
}

export interface DbPlaylistRow {
  id: number;
  name: string;
  sort_order: number;
  created_at: number;
}

export interface DbPlaylistTrackRow {
  playlist_id: number;
  track_id: number;
  position: number;
  added_at: number;
}

export interface DbAutoRuleRow {
  id: number;
  playlist_id: number;
  keyword: string;
  match_mode: string;
}

export type CopyrightReportStatus = 'pending' | 'actioned' | 'rejected';

export interface DbCopyrightReportRow {
  id: number;
  source_url: string;
  normalized_url: string;
  audio_key: string;
  track_id?: number;
  track_title?: string;
  track_author?: string;
  reporter_name: string;
  reporter_email: string;
  rights_basis: string;
  details: string;
  status: CopyrightReportStatus;
  moderation_note?: string;
  created_at: number;
  updated_at: number;
}

export interface DbBlockedMediaRow {
  audio_key: string;
  normalized_url: string;
  report_id: number;
  reason: string;
  created_at: number;
}

export interface DbListeningHistoryRow {
  id: number;
  track_id: number;
  played_at: number;
  duration_listened: number;
  percentage: number;
}

const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), 'data', 'tikplay.json');

const DEFAULT_DATA: DbData = {
  tracks: [],
  playlists: [
    { id: 1, name: 'All Tracks', sort_order: 0, created_at: Date.now() },
  ],
  playlistTracks: [],
  favorites: [],
  autoRules: [],
  copyrightReports: [],
  blockedMedia: [],
  listeningHistory: [],
  settings: {},
  nextTrackId: 1,
  nextPlaylistId: 2,
  nextRuleId: 1,
  nextCopyrightReportId: 1,
  nextListeningHistoryId: 1,
};

function normalizeDbData(data: Partial<DbData>): DbData {
  return {
    tracks: data.tracks ?? [],
    playlists: data.playlists ?? structuredClone(DEFAULT_DATA.playlists),
    playlistTracks: data.playlistTracks ?? [],
    favorites: data.favorites ?? [],
    autoRules: data.autoRules ?? [],
    copyrightReports: data.copyrightReports ?? [],
    blockedMedia: data.blockedMedia ?? [],
    listeningHistory: data.listeningHistory ?? [],
    settings: data.settings ?? {},
    nextTrackId: data.nextTrackId ?? 1,
    nextPlaylistId: data.nextPlaylistId ?? 2,
    nextRuleId: data.nextRuleId ?? 1,
    nextCopyrightReportId: data.nextCopyrightReportId ?? 1,
    nextListeningHistoryId: data.nextListeningHistoryId ?? 1,
  };
}

let cached: DbData | null = null;

function logColdDbTiming(timing: {
  readMs: number;
  parseMs: number;
  normalizeMs: number;
  bytes: number;
}): void {
  if (process.env.PERF_LOG_DB !== '1') return;
  console.info('[TikPlay performance] cold DB', {
    ...timing,
    totalMs: timing.readMs + timing.parseMs + timing.normalizeMs,
  });
}

export function getDb(): DbData {
  if (cached) return cached;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(DEFAULT_DATA, null, 2));
    cached = structuredClone(DEFAULT_DATA);
    return cached;
  }
  try {
    const readStart = performance.now();
    const source = fs.readFileSync(DB_PATH, 'utf-8');
    const readEnd = performance.now();
    const parsed = JSON.parse(source) as Partial<DbData>;
    const parseEnd = performance.now();
    cached = normalizeDbData(parsed);
    const normalizeEnd = performance.now();
    logColdDbTiming({
      readMs: readEnd - readStart,
      parseMs: parseEnd - readEnd,
      normalizeMs: normalizeEnd - parseEnd,
      bytes: Buffer.byteLength(source),
    });
    return cached;
  } catch {
    cached = structuredClone(DEFAULT_DATA);
    return cached;
  }
}

export function saveDb(data?: DbData): void {
  const d = data || cached;
  if (!d) return;
  cached = d;
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = `${DB_PATH}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(d, null, 2));
  fs.renameSync(tmp, DB_PATH);
}
