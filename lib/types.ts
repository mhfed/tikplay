// Frontend-only types shared across the music player UI.

/** A single playable track. `url` is the original TikTok URL and doubles as a stable unique id. */
export interface Track {
  url: string;
  audioUrl: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  addedAt: number;
}

/** Shape returned by the backend `POST /api/process` endpoint. */
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

/** Repeat behaviour for the player. */
export type RepeatMode = 'off' | 'all' | 'one';
