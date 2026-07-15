'use client';

import {
  createContext,
  type ReactNode,
  startTransition,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useOptimistic,
  useState,
} from 'react';
import type { AutoRule, Playlist, RepeatMode, Track } from '../lib/types';

export type AppView = 'home' | 'library';

/** Seeded server-side (app/page.tsx) from the on-disk DB + `?pl=&track=&t=` — replaces the old mount-time client fetch. */
export interface InitialAppData {
  tracks: Track[];
  playlists: Playlist[];
  favoriteIds: number[];
  autoRules: AutoRule[];
  currentPlaylistId: number;
  currentTrack: Track | null;
  pendingSeek: number | null;
  view: AppView;
}

interface AppState {
  tracks: Track[];
  playlists: Playlist[];
  favorites: Set<number>;
  autoRules: AutoRule[];
  currentPlaylistId: number;
  currentTrack: Track | null;
  currentIndex: number;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  speed: number;
  eqGains: number[];
  query: string;
  loading: boolean;
  error: string | null;
  /** Seek position (seconds) restored from a shared URL, consumed once by the player. */
  pendingSeek: number | null;
  /** Desktop content area / mobile default tab: the Discover dashboard vs. a playlist's track list. */
  view: AppView;
  /** Most recently played tracks (newest first), persisted to localStorage — powers the Home "Continue" row. */
  recentlyPlayed: Track[];
}

interface AppActions {
  loadAll: () => Promise<void>;
  selectPlaylist: (id: number) => void;
  addTrackFromUrl: (url: string) => Promise<void>;
  playTrack: (track: Track) => void;
  playAll: () => void;
  togglePlay: () => void;
  /** Explicit play/pause — used by Media Session (lock screen) handlers where a toggle could desync. */
  setPlaying: (playing: boolean) => void;
  next: () => void;
  prev: () => void;
  toggleFavorite: (trackId: number) => void;
  removeTrack: (trackId: number, playlistId?: number) => Promise<void>;
  reorderTracks: (trackIds: number[]) => Promise<void>;
  createPlaylist: (name: string) => Promise<void>;
  deletePlaylist: (id: number) => Promise<void>;
  renamePlaylist: (id: number, name: string) => Promise<void>;
  createAutoRule: (
    playlistId: number,
    keyword: string,
    matchMode: string,
  ) => Promise<void>;
  deleteAutoRule: (id: number) => Promise<void>;
  setVolume: (v: number) => void;
  setSpeed: (s: number) => void;
  setEqGains: (g: number[]) => void;
  setShuffle: (s: boolean) => void;
  cycleRepeat: () => void;
  setQuery: (q: string) => void;
  onEnded: () => void;
  clearPendingSeek: () => void;
  setView: (v: AppView) => void;
  goHome: () => void;
}

type AppStore = AppState & AppActions;

const StoreContext = createContext<AppStore | null>(null);

export function useAppStore(): AppStore {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useAppStore must be used inside AppStoreProvider');
  return ctx;
}

async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  return res.json();
}

export function AppStoreProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: InitialAppData;
}) {
  const [tracks, setTracks] = useState<Track[]>(initialData.tracks);
  const [playlists, setPlaylists] = useState<Playlist[]>(initialData.playlists);
  const [favorites, setFavorites] = useState<Set<number>>(
    () => new Set(initialData.favoriteIds),
  );
  const [optimisticFavorites, setOptimisticFavorite] = useOptimistic(
    favorites,
    (state, trackId: number) => {
      const next = new Set(state);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    },
  );
  const [autoRules, setAutoRules] = useState<AutoRule[]>(initialData.autoRules);
  const [currentPlaylistId, setCurrentPlaylistId] = useState(
    initialData.currentPlaylistId,
  );
  const [currentTrack, setCurrentTrack] = useState<Track | null>(
    initialData.currentTrack,
  );
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1);
  const [eqGains, setEqGains] = useState<number[]>([
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
  ]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingSeek, setPendingSeek] = useState<number | null>(
    initialData.pendingSeek,
  );
  const [view, setView] = useState<AppView>(initialData.view);
  const [recentIds, setRecentIds] = useState<number[]>([]);

  const loadPlaylists = useCallback(async () => {
    const data = await api<{ playlists: Playlist[] }>('/api/playlists');
    setPlaylists(data.playlists || []);
  }, []);

  const loadTracks = useCallback(async (playlistId: number, q?: string) => {
    const searchParam = q ? `?q=${encodeURIComponent(q)}` : '';
    let data: { tracks: Track[] };
    if (playlistId === 1) {
      data = await api<{ tracks: Track[] }>(`/api/tracks${searchParam}`);
    } else if (playlistId === -1) {
      data = await api<{ tracks: Track[] }>('/api/favorites');
    } else {
      data = await api<{ tracks: Track[] }>(
        `/api/playlists/${playlistId}/tracks`,
      );
    }
    setTracks(data.tracks || []);
    const favSet = new Set(
      (data.tracks || []).filter((t) => t.isFavorite).map((t) => t.id),
    );
    setFavorites(favSet);
    return data.tracks || [];
  }, []);

  const loadAutoRules = useCallback(async () => {
    const data = await api<{ rules: AutoRule[] }>('/api/auto-rules');
    setAutoRules(data.rules || []);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadPlaylists(),
      loadTracks(currentPlaylistId),
      loadAutoRules(),
    ]);
  }, [loadPlaylists, loadTracks, loadAutoRules, currentPlaylistId]);

  // Hydrate "recently played" from localStorage once, on mount (client-only —
  // reading it in a useState initializer would desync client/server render).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('tikplay:recent');
      if (raw) setRecentIds(JSON.parse(raw));
    } catch {
      // Corrupt/blocked storage — just start empty.
    }
  }, []);

  // Track playback for the Home "Continue listening" row. Keyed off the track
  // actually starting to play, not the playAll/next click, so scrubbing
  // through the queue only records what was really heard.
  useEffect(() => {
    if (!currentTrack) return;
    setRecentIds((prev) => {
      const next = [
        currentTrack.id,
        ...prev.filter((id) => id !== currentTrack.id),
      ].slice(0, 12);
      try {
        window.localStorage.setItem('tikplay:recent', JSON.stringify(next));
      } catch {
        // Ignore storage errors (private mode, quota, ...).
      }
      return next;
    });
  }, [currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the URL in sync with what's selected/playing so the address bar is
  // always shareable. `t` only appears in links built by the Share button.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (currentPlaylistId !== 1) params.set('pl', String(currentPlaylistId));
    else params.delete('pl');
    if (currentTrack) params.set('track', String(currentTrack.id));
    else params.delete('track');
    params.delete('t');
    const qs = params.toString();
    window.history.replaceState(
      null,
      '',
      qs ? `?${qs}` : window.location.pathname,
    );
  }, [currentPlaylistId, currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectPlaylist = useCallback(
    (id: number) => {
      setCurrentPlaylistId(id);
      setView('library');
      loadTracks(id, query);
    },
    [loadTracks, query],
  );

  // Home always reflects the full library, regardless of whatever playlist
  // was last browsed — so switching to it re-scopes `tracks`/`favorites` to
  // "All Tracks" rather than leaving them narrowed to the last playlist.
  const goHome = useCallback(() => {
    setCurrentPlaylistId(1);
    setView('home');
    loadTracks(1, query);
  }, [loadTracks, query]);

  const addTrackFromUrl = useCallback(
    async (url: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await api<{
          ok: boolean;
          error?: string;
          data?: Track;
          trackId?: number;
        }>('/api/process', {
          method: 'POST',
          body: JSON.stringify({ url }),
        });
        if (!res.ok) {
          setError(res.error || 'Failed');
          return;
        }
        await loadTracks(currentPlaylistId, query);
        await loadPlaylists();
        // Auto-play the new track
        if (res.data) {
          const newTrack: Track = {
            id: res.trackId || 0,
            url,
            audioUrl: res.data.audioUrl,
            title: res.data.title,
            author: res.data.author,
            cover: res.data.cover,
            duration: res.data.duration,
            addedAt: Date.now(),
          };
          setCurrentTrack(newTrack);
          setIsPlaying(true);
        }
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    },
    [currentPlaylistId, query, loadTracks, loadPlaylists],
  );

  const playTrack = useCallback(
    (track: Track) => {
      setCurrentTrack(track);
      // Set the real position immediately so the queue ("up next") and
      // next/prev are correct on the first render — not a frame later once the
      // sync effect catches up. Falls back to -1 (→ full list) if not found.
      setCurrentIndex(tracks.findIndex((t) => t.id === track.id));
      setIsPlaying(true);
      const el = document.getElementById('global-audio') as HTMLAudioElement;
      if (el) el.play().catch(() => {});
    },
    [tracks],
  );

  const playAll = useCallback(() => {
    if (tracks.length > 0) {
      setCurrentTrack(tracks[0]);
      setCurrentIndex(0);
      setIsPlaying(true);
      const el = document.getElementById('global-audio') as HTMLAudioElement;
      if (el) el.play().catch(() => {});
    }
  }, [tracks]);

  const togglePlay = useCallback(() => {
    if (!currentTrack && tracks.length > 0) {
      setCurrentTrack(tracks[0]);
      setCurrentIndex(0);
      setIsPlaying(true);
      const el = document.getElementById('global-audio') as HTMLAudioElement;
      if (el) el.play().catch(() => {});
      return;
    }
    setIsPlaying((p) => {
      const nextPlay = !p;
      const el = document.getElementById('global-audio') as HTMLAudioElement;
      if (el) {
        if (nextPlay) el.play().catch(() => {});
        else el.pause();
      }
      return nextPlay;
    });
  }, [currentTrack, tracks]);

  const setPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
    const el = document.getElementById('global-audio') as HTMLAudioElement;
    if (el) {
      if (playing) el.play().catch(() => {});
      else el.pause();
    }
  }, []);

  const pickRandom = useCallback((): number => {
    if (tracks.length <= 1) return 0;
    let r = currentIndex;
    while (r === currentIndex) r = Math.floor(Math.random() * tracks.length);
    return r;
  }, [tracks.length, currentIndex]);

  const next = useCallback(() => {
    if (tracks.length === 0) return;

    // Re-bless the audio element immediately
    const el = document.getElementById('global-audio') as HTMLAudioElement;
    if (el) el.play().catch(() => {});

    if (shuffle) {
      const idx = pickRandom();
      setCurrentTrack(tracks[idx]);
      setCurrentIndex(idx);
      setIsPlaying(true);
      return;
    }
    const nextIdx = currentIndex + 1;
    if (nextIdx >= tracks.length) {
      if (repeat === 'all') {
        setCurrentTrack(tracks[0]);
        setCurrentIndex(0);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } else {
      setCurrentTrack(tracks[nextIdx]);
      setCurrentIndex(nextIdx);
      setIsPlaying(true);
    }
  }, [tracks, currentIndex, shuffle, repeat, pickRandom]);

  const prev = useCallback(() => {
    if (tracks.length === 0) return;

    const el = document.getElementById('global-audio') as HTMLAudioElement;
    if (el) el.play().catch(() => {});

    if (shuffle) {
      const idx = pickRandom();
      setCurrentTrack(tracks[idx]);
      setCurrentIndex(idx);
      setIsPlaying(true);
      return;
    }
    const prevIdx = currentIndex - 1;
    if (prevIdx < 0) {
      const idx = repeat === 'all' ? tracks.length - 1 : 0;
      setCurrentTrack(tracks[idx]);
      setCurrentIndex(idx);
    } else {
      setCurrentTrack(tracks[prevIdx]);
      setCurrentIndex(prevIdx);
    }
    setIsPlaying(true);
  }, [tracks, currentIndex, shuffle, repeat, pickRandom]);

  const onEnded = useCallback(() => {
    if (repeat === 'one') return; // handled in audio engine
    next();
  }, [repeat, next]);

  const toggleFavoriteAction = useCallback((trackId: number) => {
    startTransition(async () => {
      setOptimisticFavorite(trackId);
      await api('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ trackId }),
      });
      setFavorites((prev) => {
        const next = new Set(prev);
        if (next.has(trackId)) next.delete(trackId);
        else next.add(trackId);
        return next;
      });
      setTracks((prev) =>
        prev.map((t) =>
          t.id === trackId ? { ...t, isFavorite: !t.isFavorite } : t,
        ),
      );
    });
  }, []);

  const removeTrack = useCallback(
    async (trackId: number, playlistId?: number) => {
      const pid = playlistId ?? currentPlaylistId;
      if (pid === 1) {
        await api('/api/tracks', {
          method: 'DELETE',
          body: JSON.stringify({ id: trackId }),
        });
      } else {
        await api(`/api/playlists/${pid}/tracks`, {
          method: 'DELETE',
          body: JSON.stringify({ trackId }),
        });
      }
      await loadTracks(currentPlaylistId, query);
      await loadPlaylists();
    },
    [currentPlaylistId, query, loadTracks, loadPlaylists],
  );

  const reorderTracks = useCallback(
    async (trackIds: number[]) => {
      if (currentPlaylistId === 1 || currentPlaylistId === -1) return;
      await api(`/api/playlists/${currentPlaylistId}/tracks`, {
        method: 'PUT',
        body: JSON.stringify({ trackIds }),
      });
      await loadTracks(currentPlaylistId, query);
    },
    [currentPlaylistId, query, loadTracks],
  );

  const createPlaylistAction = useCallback(
    async (name: string) => {
      await api('/api/playlists', {
        method: 'POST',
        body: JSON.stringify({ name }),
      });
      await loadPlaylists();
    },
    [loadPlaylists],
  );

  const deletePlaylistAction = useCallback(
    async (id: number) => {
      await api('/api/playlists', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await loadPlaylists();
      if (currentPlaylistId === id) {
        setCurrentPlaylistId(1);
        await loadTracks(1, query);
      }
    },
    [currentPlaylistId, query, loadPlaylists, loadTracks],
  );

  const renamePlaylistAction = useCallback(
    async (id: number, name: string) => {
      await api('/api/playlists', {
        method: 'PUT',
        body: JSON.stringify({ id, name }),
      });
      await loadPlaylists();
    },
    [loadPlaylists],
  );

  const createAutoRuleAction = useCallback(
    async (playlistId: number, keyword: string, matchMode: string) => {
      await api('/api/auto-rules', {
        method: 'POST',
        body: JSON.stringify({ playlistId, keyword, matchMode }),
      });
      await loadAutoRules();
    },
    [loadAutoRules],
  );

  const deleteAutoRuleAction = useCallback(
    async (id: number) => {
      await api('/api/auto-rules', {
        method: 'DELETE',
        body: JSON.stringify({ id }),
      });
      await loadAutoRules();
    },
    [loadAutoRules],
  );

  const clearPendingSeek = useCallback(() => setPendingSeek(null), []);

  const cycleRepeat = useCallback(() => {
    setRepeat((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  // Keep currentIndex in sync with currentTrack
  useEffect(() => {
    if (!currentTrack) return;
    const idx = tracks.findIndex((t) => t.id === currentTrack.id);
    if (idx !== -1) setCurrentIndex(idx);
  }, [tracks, currentTrack]);

  const filteredTracks = useMemo(() => {
    if (!query.trim()) return tracks;
    const q = query.trim().toLowerCase();
    return tracks.filter(
      (t) =>
        t.title.toLowerCase().includes(q) || t.author.toLowerCase().includes(q),
    );
  }, [tracks, query]);

  // Only resolves ids against tracks already loaded into memory (typically the
  // full library, since that's what loads by default) — good enough for a
  // "continue listening" hint without a dedicated history endpoint.
  const recentlyPlayed = useMemo(() => {
    const byId = new Map(tracks.map((t) => [t.id, t]));
    return recentIds.map((id) => byId.get(id)).filter((t): t is Track => !!t);
  }, [recentIds, tracks]);

  const store: AppStore = {
    tracks: filteredTracks,
    playlists,
    favorites: optimisticFavorites,
    autoRules,
    currentPlaylistId,
    currentTrack,
    currentIndex,
    isPlaying,
    shuffle,
    repeat,
    volume,
    speed,
    eqGains,
    query,
    loading,
    error,
    pendingSeek,
    view,
    recentlyPlayed,
    loadAll,
    selectPlaylist,
    addTrackFromUrl,
    playTrack,
    playAll,
    togglePlay,
    setPlaying,
    next,
    prev,
    toggleFavorite: toggleFavoriteAction,
    removeTrack,
    reorderTracks,
    createPlaylist: createPlaylistAction,
    deletePlaylist: deletePlaylistAction,
    renamePlaylist: renamePlaylistAction,
    createAutoRule: createAutoRuleAction,
    deleteAutoRule: deleteAutoRuleAction,
    setVolume,
    setSpeed,
    setEqGains,
    setShuffle,
    cycleRepeat,
    setQuery,
    onEnded,
    clearPendingSeek,
    setView,
    goHome,
  };

  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}
