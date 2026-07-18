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
  updateTrack: (
    trackId: number,
    patch: Pick<Track, 'startTime' | 'endTime'>,
  ) => void;
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
  const handleEndedRef = useRef<() => void>(() => {});

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
    (trackId: number, patch: Pick<Track, 'startTime' | 'endTime'>) => {
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

    loadTrack(currentTrack.audioUrl);
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
