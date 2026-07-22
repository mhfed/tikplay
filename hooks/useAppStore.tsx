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
  useRef,
  useState,
} from 'react';
import type { MediaSource } from '../lib/media/source';
import type {
  AutoRule,
  MusicCategory,
  MusicSource,
  Playlist,
  RepeatMode,
  Track,
} from '../lib/types';
import { usePlayback } from './usePlayback';

export type AppView = 'home' | 'library';
export type TrackSort =
  | 'playlist'
  | 'added_desc'
  | 'added_asc'
  | 'title'
  | 'author'
  | 'duration'
  | 'source'
  | 'category';

export interface ImportJob {
  id: string;
  url: string;
  status: 'processing' | 'failed' | 'cancelled';
  error?: string;
}

/** Seeded server-side (app/page.tsx) from the on-disk DB + `?pl=&track=&t=` — replaces the old mount-time client fetch. */
export interface InitialAppData {
  tracks: Track[];
  playlists: Playlist[];
  categories: MusicCategory[];
  sources: MusicSource[];
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
  categories: MusicCategory[];
  sources: MusicSource[];
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
  /** Currently selected category slug (null = all). */
  selectedCategory: string | null;
  /** Currently selected media source (null = all). */
  selectedSource: MediaSource | null;
  trackSort: TrackSort;
  importJobs: ImportJob[];
}

interface AppActions {
  loadAll: () => Promise<void>;
  selectPlaylist: (id: number) => void;
  addTrackFromUrl: (url: string) => Promise<void>;
  pendingDownloads: string[];
  retryImport: (id: string) => Promise<void>;
  cancelImport: (id: string) => void;
  dismissImport: (id: string) => void;
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
  reorderPlaylists: (ids: number[]) => Promise<void>;
  addTrackToPlaylist: (trackId: number, playlistId: number) => Promise<void>;
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
  clearPendingSeek: () => void;
  setView: (v: AppView) => void;
  goHome: () => void;
  selectCategory: (slug: string | null) => void;
  selectSource: (source: MediaSource | null) => void;
  updateTrackTiming: (
    trackId: number,
    startTime?: number,
    endTime?: number,
  ) => Promise<void>;
  updateTrackMetadata: (
    trackId: number,
    updates: Pick<Track, 'title' | 'author' | 'cover' | 'category'>,
  ) => Promise<void>;
  setTrackSort: (sort: TrackSort) => void;
  runHealthCheck: () => Promise<HealthResult | null>;
  cleanupCache: () => Promise<{ removed: number } | null>;
}

export interface HealthIssue {
  id: number;
  title: string;
  detail: string;
  kind: string;
}

export interface HealthResult {
  totalTracks: number;
  missing: HealthIssue[];
  unreferencedKeys: string[];
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
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Yêu cầu không thành công');
  }
  return data;
}

export function AppStoreProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  initialData: InitialAppData;
}) {
  const {
    currentTrack,
    currentIndex,
    isPlaying,
    shuffle,
    repeat,
    volume,
    speed,
    eqGains,
    initializeTrack,
    playTrack: playGlobalTrack,
    playAll: playGlobalQueue,
    togglePlay: toggleGlobalPlay,
    setPlaying,
    next,
    prev,
    setVolume,
    setSpeed,
    setEqGains,
    setShuffle,
    cycleRepeat,
    updateTrack: updatePlaybackTrack,
  } = usePlayback();
  const [tracks, setTracks] = useState<Track[]>(initialData.tracks);
  const [importJobs, setImportJobs] = useState<ImportJob[]>([]);
  const importControllers = useRef(new Map<string, AbortController>());
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
  const [query, setQuery] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pendingSeek, setPendingSeek] = useState<number | null>(
    initialData.pendingSeek,
  );
  const [view, setView] = useState<AppView>(initialData.view);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [categories, setCategories] = useState<MusicCategory[]>(
    initialData.categories || [],
  );
  const [sources, setSources] = useState<MusicSource[]>(
    initialData.sources || [],
  );
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedSource, setSelectedSource] = useState<MediaSource | null>(
    null,
  );
  const [trackSort, setTrackSort] = useState<TrackSort>(
    initialData.currentPlaylistId > 1 ? 'playlist' : 'added_desc',
  );

  // A shared URL can seed global playback on the first route mount. Later
  // route transitions must never replace the already-running global track.
  useEffect(() => {
    if (initialData.currentTrack) {
      initializeTrack(initialData.currentTrack, initialData.tracks);
    }
  }, [initialData.currentTrack, initialData.tracks, initializeTrack]);

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

  const loadCategoriesFn = useCallback(async () => {
    const data = await api<{ categories: MusicCategory[] }>('/api/categories');
    setCategories(data.categories || []);
  }, []);

  const loadSourcesFn = useCallback(async () => {
    const data = await api<{ sources: MusicSource[] }>('/api/sources');
    setSources(data.sources || []);
  }, []);

  const loadAll = useCallback(async () => {
    await Promise.all([
      loadPlaylists(),
      loadTracks(currentPlaylistId),
      loadAutoRules(),
      loadCategoriesFn(),
      loadSourcesFn(),
    ]);
  }, [
    loadPlaylists,
    loadTracks,
    loadAutoRules,
    loadCategoriesFn,
    loadSourcesFn,
    currentPlaylistId,
  ]);

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
  // always shareable. Uses path-based routing (/library, /library/3, etc.)
  // instead of query params.
  useEffect(() => {
    const basePath =
      currentPlaylistId === 1
        ? '/library'
        : currentPlaylistId === -1
          ? '/library/favorites'
          : `/library/${currentPlaylistId}`;

    const params = new URLSearchParams();
    if (currentTrack) params.set('track', String(currentTrack.id));
    const qs = params.toString();
    const href = qs ? `${basePath}?${qs}` : basePath;

    // Only update if the path part differs to avoid infinite loops with
    // router.replace triggering re-renders.
    if (
      window.location.pathname !== basePath ||
      window.location.search !== (qs ? `?${qs}` : '')
    ) {
      window.history.replaceState(null, '', href);
    }
  }, [currentPlaylistId, currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectPlaylist = useCallback(
    (id: number) => {
      setSelectedCategory(null);
      setSelectedSource(null);
      setCurrentPlaylistId(id);
      setView('library');
      setTrackSort(id > 1 ? 'playlist' : 'added_desc');
      loadTracks(id, query);
    },
    [loadTracks, query],
  );

  // Home always reflects the full library, regardless of whatever playlist
  // was last browsed — so switching to it re-scopes `tracks`/`favorites` to
  // "All Tracks" rather than leaving them narrowed to the last playlist.
  const goHome = useCallback(() => {
    setSelectedCategory(null);
    setSelectedSource(null);
    setCurrentPlaylistId(1);
    setView('home');
    setTrackSort('added_desc');
    loadTracks(1, query);
  }, [loadTracks, query]);

  const selectCategory = useCallback(
    async (slug: string | null) => {
      setSelectedCategory(slug);
      setSelectedSource(null);
      if (slug) {
        setCurrentPlaylistId(1);
        setView('library');
        setTrackSort('added_desc');
        const data = await api<{ tracks: Track[] }>(
          `/api/categories?slug=${encodeURIComponent(slug)}`,
        );
        setTracks(data.tracks || []);
        const favSet = new Set(
          (data.tracks || []).filter((t) => t.isFavorite).map((t) => t.id),
        );
        setFavorites(favSet);
      } else {
        loadTracks(1, query);
      }
    },
    [loadTracks, query],
  );

  const selectSource = useCallback(
    async (source: MediaSource | null) => {
      setSelectedSource(source);
      setSelectedCategory(null);
      if (source) {
        setCurrentPlaylistId(1);
        setView('library');
        setTrackSort('added_desc');
        const data = await api<{ tracks: Track[] }>(
          `/api/sources?source=${encodeURIComponent(source)}`,
        );
        setTracks(data.tracks || []);
        const favSet = new Set(
          (data.tracks || []).filter((t) => t.isFavorite).map((t) => t.id),
        );
        setFavorites(favSet);
      } else {
        loadTracks(1, query);
      }
    },
    [loadTracks, query],
  );

  const addTrackFromUrl = useCallback(
    async (url: string) => {
      const jobId = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      setImportJobs((jobs) => [
        ...jobs,
        { id: jobId, url, status: 'processing' },
      ]);
      const controller = new AbortController();
      importControllers.current.set(jobId, controller);
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
          signal: controller.signal,
        });
        if (!res.ok) {
          setImportJobs((jobs) =>
            jobs.map((job) =>
              job.id === jobId
                ? {
                    ...job,
                    status: 'failed',
                    error: res.error || 'Failed to download',
                  }
                : job,
            ),
          );
          setError(res.error || 'Failed to download');
          return;
        }
        if (selectedSource) {
          await selectSource(selectedSource);
        } else if (selectedCategory) {
          await selectCategory(selectedCategory);
        } else {
          await loadTracks(currentPlaylistId, query);
        }
        await loadPlaylists();
        await loadCategoriesFn();
        await loadSourcesFn();
        // Auto-play the new track
        if (res.data && res.trackId) {
          const newTrack: Track = {
            id: res.trackId,
            url,
            audioUrl: res.data.audioUrl,
            title: res.data.title,
            author: res.data.author,
            cover: res.data.cover,
            duration: res.data.duration,
            addedAt: Date.now(),
            source: res.data.source ?? 'tiktok',
          };
          // Don't auto-play if global playback already owns a track.
          if (!currentTrack) {
            playGlobalTrack(newTrack, [...tracks, newTrack]);
          }
        }
        setImportJobs((jobs) => jobs.filter((job) => job.id !== jobId));
      } catch (error) {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : 'Lỗi mạng khi tải bài hát';
        setError(message);
        setImportJobs((jobs) =>
          jobs.map((job) =>
            job.id === jobId
              ? { ...job, status: 'failed', error: message }
              : job,
          ),
        );
      } finally {
        importControllers.current.delete(jobId);
      }
    },
    [
      currentPlaylistId,
      query,
      selectedCategory,
      selectedSource,
      selectCategory,
      selectSource,
      loadTracks,
      loadPlaylists,
      loadCategoriesFn,
      loadSourcesFn,
      currentTrack,
      playGlobalTrack,
      tracks,
    ],
  );

  const cancelImport = useCallback((id: string) => {
    importControllers.current.get(id)?.abort();
    importControllers.current.delete(id);
    setImportJobs((jobs) =>
      jobs.map((job) =>
        job.id === id ? { ...job, status: 'cancelled' } : job,
      ),
    );
  }, []);

  const dismissImport = useCallback((id: string) => {
    setImportJobs((jobs) => jobs.filter((job) => job.id !== id));
  }, []);

  const retryImport = useCallback(
    async (id: string) => {
      const job = importJobs.find((item) => item.id === id);
      if (!job) return;
      dismissImport(id);
      await addTrackFromUrl(job.url);
    },
    [addTrackFromUrl, dismissImport, importJobs],
  );

  const playTrack = useCallback(
    (track: Track) => {
      playGlobalTrack(track, tracks);
    },
    [playGlobalTrack, tracks],
  );

  const playAll = useCallback(() => {
    playGlobalQueue(tracks);
  }, [playGlobalQueue, tracks]);

  const togglePlay = useCallback(() => {
    toggleGlobalPlay(tracks);
  }, [toggleGlobalPlay, tracks]);

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
      if (selectedSource) {
        await selectSource(selectedSource);
      } else if (selectedCategory) {
        await selectCategory(selectedCategory);
      } else {
        await loadTracks(currentPlaylistId, query);
      }
      await loadPlaylists();
      await loadCategoriesFn();
      await loadSourcesFn();
    },
    [
      currentPlaylistId,
      query,
      selectedCategory,
      selectedSource,
      selectCategory,
      selectSource,
      loadTracks,
      loadPlaylists,
      loadCategoriesFn,
      loadSourcesFn,
    ],
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

  const reorderPlaylistsAction = useCallback(
    async (ids: number[]) => {
      await api('/api/playlists', {
        method: 'PUT',
        body: JSON.stringify({ ids }),
      });
      await loadPlaylists();
    },
    [loadPlaylists],
  );

  const addTrackToPlaylistAction = useCallback(
    async (trackId: number, playlistId: number) => {
      await api(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: JSON.stringify({ trackId }),
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

  const updateTrackTiming = useCallback(
    async (trackId: number, startTime?: number, endTime?: number) => {
      await api('/api/tracks', {
        method: 'PATCH',
        body: JSON.stringify({ id: trackId, startTime, endTime }),
      });
      // Update local state directly so we don't have to reload all tracks just for this
      setTracks((prev) =>
        prev.map((t) => (t.id === trackId ? { ...t, startTime, endTime } : t)),
      );
      updatePlaybackTrack(trackId, { startTime, endTime });
    },
    [updatePlaybackTrack],
  );

  const updateTrackMetadata = useCallback(
    async (
      trackId: number,
      updates: Pick<Track, 'title' | 'author' | 'cover' | 'category'>,
    ) => {
      const data = await api<{ track: Track }>('/api/tracks', {
        method: 'PATCH',
        body: JSON.stringify({ id: trackId, ...updates }),
      });
      setTracks((prev) =>
        prev.map((track) => (track.id === trackId ? data.track : track)),
      );
      updatePlaybackTrack(trackId, data.track);
      await Promise.all([loadCategoriesFn(), loadSourcesFn()]);
    },
    [loadCategoriesFn, loadSourcesFn, updatePlaybackTrack],
  );

  const clearPendingSeek = useCallback(() => setPendingSeek(null), []);

  const runHealthCheck = useCallback(async () => {
    try {
      const data = await api<HealthResult>('/api/tracks/health');
      return data;
    } catch {
      return null;
    }
  }, []);

  const cleanupCache = useCallback(async () => {
    try {
      const data = await api<{ removed: number }>('/api/tracks/health', {
        method: 'POST',
        body: JSON.stringify({ action: 'cleanup-cache' }),
      });
      return data;
    } catch {
      return null;
    }
  }, []);

  const filteredTracks = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? tracks.filter(
          (track) =>
            track.title.toLowerCase().includes(q) ||
            track.author.toLowerCase().includes(q),
        )
      : tracks;
    if (trackSort === 'playlist') return filtered;

    return [...filtered].sort((a, b) => {
      switch (trackSort) {
        case 'added_asc':
          return a.addedAt - b.addedAt;
        case 'title':
          return a.title.localeCompare(b.title, 'vi');
        case 'author':
          return a.author.localeCompare(b.author, 'vi');
        case 'duration':
          return b.duration - a.duration;
        case 'source':
          return a.source.localeCompare(b.source);
        case 'category':
          return (a.category || 'others').localeCompare(b.category || 'others');
        default:
          return b.addedAt - a.addedAt;
      }
    });
  }, [tracks, query, trackSort]);

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
    categories,
    sources,
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
    loading: importJobs.some((job) => job.status === 'processing'),
    error,
    pendingSeek,
    view,
    recentlyPlayed,
    selectedCategory,
    selectedSource,
    trackSort,
    importJobs,
    loadAll,
    selectPlaylist,
    addTrackFromUrl,
    pendingDownloads: importJobs
      .filter((job) => job.status === 'processing')
      .map((job) => job.url),
    retryImport,
    cancelImport,
    dismissImport,
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
    reorderPlaylists: reorderPlaylistsAction,
    addTrackToPlaylist: addTrackToPlaylistAction,
    createAutoRule: createAutoRuleAction,
    deleteAutoRule: deleteAutoRuleAction,
    updateTrackTiming,
    updateTrackMetadata,
    setTrackSort,
    setVolume,
    setSpeed,
    setEqGains,
    setShuffle,
    cycleRepeat,
    setQuery,
    clearPendingSeek,
    setView,
    goHome,
    selectCategory,
    selectSource,
    runHealthCheck,
    cleanupCache,
  };

  return (
    <StoreContext.Provider value={store}>{children}</StoreContext.Provider>
  );
}
