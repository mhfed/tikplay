/** A track row as stored in SQLite. */
export interface DbTrack {
  id: number;
  url: string;
  audio_key: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  added_at: number;
}

/** Frontend-facing track (camelCase, includes computed fields). */
export interface Track {
  id: number;
  url: string;
  audioUrl: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  addedAt: number;
  isFavorite?: boolean;
}

/** Convert a DB row to the frontend shape. */
export function toTrack(row: DbTrack, favIds?: Set<number>): Track {
  return {
    id: row.id,
    url: row.url,
    audioUrl: `/api/audio/${row.audio_key}`,
    title: row.title,
    author: row.author,
    cover: row.cover,
    duration: row.duration,
    addedAt: row.added_at,
    isFavorite: favIds ? favIds.has(row.id) : undefined,
  };
}

export interface Playlist {
  id: number;
  name: string;
  sort_order: number;
  created_at: number;
  trackCount?: number;
}

export interface AutoRule {
  id: number;
  playlist_id: number;
  keyword: string;
  match_mode: 'contains' | 'starts_with';
}

/** Shape returned by the backend POST /api/process endpoint. */
export interface ProcessResponse {
  ok: true;
  data: {
    audioUrl: string;
    title: string;
    author: string;
    cover: string;
    duration: number;
  };
}

export type RepeatMode = 'off' | 'all' | 'one';

/** EQ preset definition. */
export interface EqPreset {
  name: string;
  gains: number[];
}

export const EQ_BANDS = [
  32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000,
] as const;

export const EQ_PRESETS: EqPreset[] = [
  { name: 'Flat', gains: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
  { name: 'Bass Boost', gains: [6, 5, 4, 2, 0, 0, 0, 0, 0, 0] },
  { name: 'Treble Boost', gains: [0, 0, 0, 0, 0, 0, 2, 4, 5, 6] },
  { name: 'Vocal', gains: [-2, -1, 0, 2, 4, 4, 3, 1, 0, -1] },
  { name: 'Rock', gains: [4, 3, 1, 0, -1, 0, 2, 3, 4, 4] },
  { name: 'Electronic', gains: [5, 4, 2, 0, -2, 0, 1, 3, 4, 5] },
];
