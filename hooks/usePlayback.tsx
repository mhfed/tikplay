'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { RepeatMode, Track } from '../lib/types';
import { EQ_PRESETS } from '../lib/types';
import { useAudioEngine } from './useAudioEngine';

const DEFAULT_EQ_GAINS =
  EQ_PRESETS.find((preset) => preset.name === 'Bass Boost')?.gains ??
  EQ_PRESETS[0].gains;

type AudioEngine = ReturnType<typeof useAudioEngine>;

const PLAYBACK_STORAGE_KEY = 'tikplay:playback:v1';

interface SavedPlaybackSession {
  version: 1;
  currentTrackId: number | null;
  queueIds: number[];
  position: number;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  speed: number;
  eqGains: number[];
}

function readSavedSession(): SavedPlaybackSession | null {
  try {
    const value = JSON.parse(
      window.localStorage.getItem(PLAYBACK_STORAGE_KEY) || 'null',
    );
    if (value?.version !== 1) return null;
    if (!Array.isArray(value.queueIds) || !Array.isArray(value.eqGains)) {
      return null;
    }
    return value as SavedPlaybackSession;
  } catch {
    return null;
  }
}

interface PlaybackController {
  currentTrack: Track | null;
  currentIndex: number;
  queue: Track[];
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  volume: number;
  speed: number;
  eqGains: number[];
  initializeTrack: (track: Track, queue: Track[]) => void;
  playTrack: (track: Track, queue?: Track[]) => void;
  playAll: (queue: Track[]) => void;
  togglePlay: (fallbackQueue?: Track[]) => void;
  setPlaying: (playing: boolean) => void;
  next: () => void;
  prev: () => void;
  setVolume: (volume: number) => void;
  setSpeed: (speed: number) => void;
  setEqGains: (gains: number[]) => void;
  setShuffle: (shuffle: boolean) => void;
  cycleRepeat: () => void;
  updateTrack: (trackId: number, patch: Partial<Omit<Track, 'id'>>) => void;
}

const PlaybackContext = createContext<PlaybackController | null>(null);
const AudioEngineContext = createContext<AudioEngine | null>(null);

export function usePlayback() {
  const playback = useContext(PlaybackContext);
  if (!playback) {
    throw new Error('usePlayback must be used inside PlaybackProvider');
  }
  return playback;
}

export function useGlobalAudioEngine() {
  const engine = useContext(AudioEngineContext);
  if (!engine) {
    throw new Error(
      'useGlobalAudioEngine must be used inside PlaybackProvider',
    );
  }
  return engine;
}

export function PlaybackProvider({ children }: { children: ReactNode }) {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');
  const [volume, setVolume] = useState(0.8);
  const [speed, setSpeed] = useState(1);
  const [eqGains, setEqGains] = useState<number[]>([...DEFAULT_EQ_GAINS]);
  const [storageReady, setStorageReady] = useState(false);
  const handleEndedRef = useRef<() => void>(() => {});
  const restoredPositionRef = useRef<number | null>(null);
  const resumePositionRef = useRef<number | null>(null);
  const lastPositionWriteRef = useRef(0);
  const playbackPositionRef = useRef(0);

  const resolveQueue = useCallback(
    (track: Track, nextQueue?: Track[]) => {
      if (nextQueue?.length) return nextQueue;
      if (queue.length) return queue;
      return [track];
    },
    [queue],
  );

  const selectTrack = useCallback(
    (track: Track, nextQueue: Track[], playing: boolean) => {
      restoredPositionRef.current = null;
      resumePositionRef.current = null;
      setQueue(nextQueue);
      setCurrentTrack(track);
      setCurrentIndex(nextQueue.findIndex((item) => item.id === track.id));
      setIsPlaying(playing);
    },
    [],
  );

  const initializeTrack = useCallback(
    (track: Track, initialQueue: Track[]) => {
      if (currentTrack) return;
      selectTrack(track, initialQueue.length ? initialQueue : [track], false);
    },
    [currentTrack, selectTrack],
  );

  const playTrack = useCallback(
    (track: Track, nextQueue?: Track[]) => {
      selectTrack(track, resolveQueue(track, nextQueue), true);
    },
    [resolveQueue, selectTrack],
  );

  const playAll = useCallback(
    (nextQueue: Track[]) => {
      if (nextQueue.length) selectTrack(nextQueue[0], nextQueue, true);
    },
    [selectTrack],
  );

  const togglePlay = useCallback(
    (fallbackQueue: Track[] = []) => {
      if (!currentTrack) {
        playAll(fallbackQueue);
        return;
      }
      setIsPlaying((playing) => !playing);
    },
    [currentTrack, playAll],
  );

  const chooseRandomIndex = useCallback(() => {
    if (queue.length <= 1) return 0;
    let index = currentIndex;
    while (index === currentIndex) {
      index = Math.floor(Math.random() * queue.length);
    }
    return index;
  }, [currentIndex, queue.length]);

  const next = useCallback(() => {
    if (!queue.length) return;

    if (shuffle) {
      const index = chooseRandomIndex();
      selectTrack(queue[index], queue, true);
      return;
    }

    const nextIndex = currentIndex + 1;
    if (nextIndex >= queue.length) {
      if (repeat === 'all') selectTrack(queue[0], queue, true);
      else setIsPlaying(false);
      return;
    }

    selectTrack(queue[nextIndex], queue, true);
  }, [chooseRandomIndex, currentIndex, queue, repeat, selectTrack, shuffle]);

  const prev = useCallback(() => {
    if (!queue.length) return;

    if (shuffle) {
      const index = chooseRandomIndex();
      selectTrack(queue[index], queue, true);
      return;
    }

    const prevIndex = currentIndex - 1;
    const index =
      prevIndex < 0 ? (repeat === 'all' ? queue.length - 1 : 0) : prevIndex;
    selectTrack(queue[index], queue, true);
  }, [chooseRandomIndex, currentIndex, queue, repeat, selectTrack, shuffle]);

  const cycleRepeat = useCallback(() => {
    setRepeat((mode) =>
      mode === 'off' ? 'all' : mode === 'all' ? 'one' : 'off',
    );
  }, []);

  const updateTrack = useCallback(
    (trackId: number, patch: Partial<Omit<Track, 'id'>>) => {
      setCurrentTrack((track) =>
        track?.id === trackId ? { ...track, ...patch } : track,
      );
      setQueue((tracks) =>
        tracks.map((track) =>
          track.id === trackId ? { ...track, ...patch } : track,
        ),
      );
    },
    [],
  );

  const engine = useAudioEngine({
    startTime: currentTrack?.startTime,
    endTime: currentTrack?.endTime,
    onEnded: () => handleEndedRef.current(),
  });
  const {
    loadTrack,
    play: playAudio,
    pause: pauseAudio,
    seek: seekAudio,
    setVolume: applyVolume,
    setSpeed: applySpeed,
    setAllBands: applyEqGains,
  } = engine;
  if (engine.currentTime > 0) {
    playbackPositionRef.current = engine.currentTime;
    resumePositionRef.current = null;
  }

  useEffect(() => {
    const restore = async () => {
      const saved = readSavedSession();
      if (!saved) {
        setStorageReady(true);
        return;
      }

      setShuffle(Boolean(saved.shuffle));
      if (
        saved.repeat === 'off' ||
        saved.repeat === 'all' ||
        saved.repeat === 'one'
      ) {
        setRepeat(saved.repeat);
      }
      if (Number.isFinite(saved.volume)) {
        setVolume(Math.min(3, Math.max(0, saved.volume)));
      }
      if (Number.isFinite(saved.speed)) {
        setSpeed(Math.min(2, Math.max(0.5, saved.speed)));
      }
      if (
        saved.eqGains.length === DEFAULT_EQ_GAINS.length &&
        saved.eqGains.every(Number.isFinite)
      ) {
        setEqGains(
          saved.eqGains.map((gain) => Math.min(12, Math.max(-12, gain))),
        );
      }

      const sharedTrackId = new URLSearchParams(window.location.search).get(
        'track',
      );
      if (!saved.currentTrackId || sharedTrackId) {
        setStorageReady(true);
        return;
      }

      try {
        const response = await fetch('/api/tracks');
        if (!response.ok) return;
        const data = (await response.json()) as { tracks?: Track[] };
        const byId = new Map(
          (data.tracks || []).map((track) => [track.id, track]),
        );
        const restoredQueue = saved.queueIds
          .map((id) => byId.get(id))
          .filter((track): track is Track => Boolean(track));
        const restoredTrack = byId.get(saved.currentTrackId);
        if (restoredTrack) {
          const nextQueue = restoredQueue.some(
            (track) => track.id === restoredTrack.id,
          )
            ? restoredQueue
            : [restoredTrack, ...restoredQueue];
          selectTrack(restoredTrack, nextQueue, false);
          const position = Math.max(0, saved.position || 0);
          restoredPositionRef.current = position;
          resumePositionRef.current = position;
        }
      } finally {
        setStorageReady(true);
      }
    };

    restore();
  }, [selectTrack]);

  handleEndedRef.current = () => {
    if (repeat === 'one' && currentTrack) {
      seekAudio(currentTrack.startTime || 0);
      playAudio();
      return;
    }
    next();
  };

  // The engine lives here, above the route tree. Route-level players only
  // render controls; navigation never creates or tears down playback.
  useEffect(() => {
    if (!currentTrack) {
      pauseAudio();
      return;
    }

    loadTrack(currentTrack.audioUrl, restoredPositionRef.current ?? undefined);
    restoredPositionRef.current = null;
    if (isPlaying) playAudio();
    else pauseAudio();
  }, [currentTrack, isPlaying, loadTrack, pauseAudio, playAudio]);

  useEffect(() => {
    applyVolume(volume);
  }, [applyVolume, volume]);

  useEffect(() => {
    applySpeed(speed);
  }, [applySpeed, speed]);

  useEffect(() => {
    applyEqGains(eqGains);
  }, [applyEqGains, eqGains]);

  useEffect(() => {
    if (!storageReady) return;
    const session: SavedPlaybackSession = {
      version: 1,
      currentTrackId: currentTrack?.id ?? null,
      queueIds: queue.map((track) => track.id),
      position: resumePositionRef.current ?? playbackPositionRef.current,
      shuffle,
      repeat,
      volume,
      speed,
      eqGains,
    };
    try {
      window.localStorage.setItem(
        PLAYBACK_STORAGE_KEY,
        JSON.stringify(session),
      );
      lastPositionWriteRef.current = Date.now();
    } catch {
      // Storage can be unavailable in private mode or when quota is exhausted.
    }
  }, [
    storageReady,
    currentTrack?.id,
    queue,
    shuffle,
    repeat,
    volume,
    speed,
    eqGains,
  ]);

  useEffect(() => {
    if (!storageReady || !currentTrack) return;
    if (Date.now() - lastPositionWriteRef.current < 5_000) return;
    const saved = readSavedSession();
    if (!saved || saved.currentTrackId !== currentTrack.id) return;
    try {
      window.localStorage.setItem(
        PLAYBACK_STORAGE_KEY,
        JSON.stringify({
          ...saved,
          position: resumePositionRef.current ?? engine.currentTime,
        }),
      );
      lastPositionWriteRef.current = Date.now();
    } catch {
      // Ignore browser storage failures during playback.
    }
  }, [storageReady, currentTrack?.id, engine.currentTime]);

  // Record a meaningful play when the user listens to a track long enough.
  const recordedPlayRef = useRef<Set<number>>(new Set());
  useEffect(() => {
    if (!currentTrack || !isPlaying) return;
    const trackId = currentTrack.id;
    if (recordedPlayRef.current.has(trackId)) return;
    const dur = currentTrack.duration || 0;
    if (dur <= 0) return;
    const threshold = Math.min(30, dur * 0.5);
    if (engine.currentTime < threshold) return;
    if (recordedPlayRef.current.size > 200) {
      recordedPlayRef.current.clear();
    }
    recordedPlayRef.current.add(trackId);
    const durationListened = engine.currentTime;
    const percentage = dur > 0 ? engine.currentTime / dur : 0;
    fetch('/api/tracks/play', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackId, durationListened, percentage }),
    }).catch(() => {});
  }, [currentTrack?.id, isPlaying, engine.currentTime]);

  const controller = useMemo<PlaybackController>(
    () => ({
      currentTrack,
      currentIndex,
      queue,
      isPlaying,
      shuffle,
      repeat,
      volume,
      speed,
      eqGains,
      initializeTrack,
      playTrack,
      playAll,
      togglePlay,
      setPlaying: setIsPlaying,
      next,
      prev,
      setVolume,
      setSpeed,
      setEqGains,
      setShuffle,
      cycleRepeat,
      updateTrack,
    }),
    [
      currentTrack,
      currentIndex,
      queue,
      isPlaying,
      shuffle,
      repeat,
      volume,
      speed,
      eqGains,
      initializeTrack,
      playTrack,
      playAll,
      togglePlay,
      next,
      prev,
      cycleRepeat,
      updateTrack,
    ],
  );

  return (
    <PlaybackContext.Provider value={controller}>
      <AudioEngineContext.Provider value={engine}>
        {children}
      </AudioEngineContext.Provider>
    </PlaybackContext.Provider>
  );
}
