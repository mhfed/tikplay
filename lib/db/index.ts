import fs from 'node:fs';
import path from 'node:path';

export interface DbData {
  tracks: DbTrackRow[];
  playlists: DbPlaylistRow[];
  playlistTracks: DbPlaylistTrackRow[];
  favorites: number[];
  autoRules: DbAutoRuleRow[];
  nextTrackId: number;
  nextPlaylistId: number;
  nextRuleId: number;
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
  category?: string;
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
  nextTrackId: 1,
  nextPlaylistId: 2,
  nextRuleId: 1,
};

let cached: DbData | null = null;

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
    cached = JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
    return cached!;
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
