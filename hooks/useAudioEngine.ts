'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EQ_BANDS } from '../lib/types';

interface AudioEngineOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
}

export function useAudioEngine(opts: AudioEngineOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const gainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  const connectedRef = useRef(false);
  const lastUrlRef = useRef<string | null>(null);
  const lastVolumeRef = useRef(0.8);
  // Desired volume (0–3): may be set before the audio graph exists.
  const desiredVolumeRef = useRef(0.8);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);

  const getOrCreateAudio = useCallback(() => {
    if (!audioRef.current) {
      const el = new Audio();
      el.crossOrigin = 'anonymous';
      el.preload = 'metadata';
      audioRef.current = el;
    }
    return audioRef.current;
  }, []);

  // Mobile browsers suspend (iOS: "interrupted") the context on screen lock,
  // app switch, or incoming calls. The media element keeps advancing into the
  // dead graph, so playback turns silent until the context is resumed.
  const resumeContext = useCallback(() => {
    const ctx = ctxRef.current;
    if (ctx && ctx.state !== 'running' && ctx.state !== 'closed') {
      ctx.resume().catch(() => {});
    }
  }, []);

  const ensureAudioGraph = useCallback(() => {
    if (connectedRef.current) return;
    const audio = getOrCreateAudio();

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    ctx.addEventListener('statechange', () => {
      const el = audioRef.current;
      if (ctx.state !== 'running' && el && !el.paused) {
        ctx.resume().catch(() => {});
      }
    });

    const source = ctx.createMediaElementSource(audio);
    sourceRef.current = source;

    const filters: BiquadFilterNode[] = EQ_BANDS.map((freq, i) => {
      const filter = ctx.createBiquadFilter();
      filter.type =
        i === 0
          ? 'lowshelf'
          : i === EQ_BANDS.length - 1
            ? 'highshelf'
            : 'peaking';
      filter.frequency.value = freq;
      filter.Q.value = 1.414;
      filter.gain.value = 0;
      return filter;
    });
    filtersRef.current = filters;

    const gain = ctx.createGain();
    gain.gain.value = Math.max(desiredVolumeRef.current, 1);
    gainRef.current = gain;

    // Brick-wall limiter: lets the gain boost past 1x (and EQ bands stack up)
    // without clipping at the destination.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -3;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiterRef.current = limiter;

    // Chain: source → filters → gain (boost) → limiter → destination
    let prev: AudioNode = source;
    for (const f of filters) {
      prev.connect(f);
      prev = f;
    }
    prev.connect(gain);
    gain.connect(limiter);
    limiter.connect(ctx.destination);

    connectedRef.current = true;
  }, [getOrCreateAudio]);

  const loadTrack = useCallback(
    (audioUrl: string) => {
      const audio = getOrCreateAudio();
      if (lastUrlRef.current === audioUrl) return;
      lastUrlRef.current = audioUrl;
      audio.src = audioUrl;
      setCurrentTime(0);
      setDuration(0);
      setIsReady(false);
    },
    [getOrCreateAudio],
  );

  const play = useCallback(async () => {
    const audio = getOrCreateAudio();
    ensureAudioGraph();
    if (ctxRef.current?.state === 'suspended') {
      await ctxRef.current.resume();
    }
    await audio.play().catch(() => {});
  }, [getOrCreateAudio, ensureAudioGraph]);

  const pause = useCallback(() => {
    audioRef.current?.pause();
  }, []);

  const toggle = useCallback(async () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) await play();
    else pause();
  }, [play, pause]);

  const seek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  // v: 0–3. The element's volume caps at 1; anything above rides the GainNode
  // and is kept clean by the limiter.
  const setVolume = useCallback((v: number) => {
    desiredVolumeRef.current = v;
    const audio = audioRef.current;
    if (audio) audio.volume = Math.min(v, 1);
    if (gainRef.current) gainRef.current.gain.value = Math.max(v, 1);
  }, []);

  const setSpeed = useCallback((s: number) => {
    const audio = audioRef.current;
    if (audio) audio.playbackRate = s;
  }, []);

  const setBand = useCallback((index: number, gain: number) => {
    const filter = filtersRef.current[index];
    if (filter) filter.gain.value = gain;
  }, []);

  const setAllBands = useCallback((gains: number[]) => {
    gains.forEach((g, i) => {
      const filter = filtersRef.current[i];
      if (filter) filter.gain.value = g;
    });
  }, []);

  // Track mute state from the store's volume (not audio.volume, which caps at
  // 1) so boosted levels above 100% survive a mute/unmute round-trip.
  const toggleMute = useCallback(
    (volume: number, setVol: (v: number) => void) => {
      if (volume > 0) {
        lastVolumeRef.current = volume;
        setVol(0);
      } else {
        setVol(lastVolumeRef.current || 0.8);
      }
    },
    [],
  );

  // Attach event listeners
  useEffect(() => {
    const audio = getOrCreateAudio();

    const handleTimeUpdate = () => {
      // Watchdog: media events keep firing in the background even when the
      // context got suspended, so this is the one hook that can revive audio
      // while the page is hidden or the screen is locked.
      resumeContext();
      setCurrentTime(audio.currentTime);
      setDuration(audio.duration || 0);
      opts.onTimeUpdate?.(audio.currentTime, audio.duration || 0);
    };

    const handleEnded = () => {
      opts.onEnded?.();
    };

    const handleCanPlay = () => {
      setIsReady(true);
      setDuration(audio.duration || 0);
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') resumeContext();
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleCanPlay);
    audio.addEventListener('play', resumeContext);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', handleVisible);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleCanPlay);
      audio.removeEventListener('play', resumeContext);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('pageshow', handleVisible);
    };
  }, [getOrCreateAudio, resumeContext]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    loadTrack,
    play,
    pause,
    toggle,
    seek,
    setVolume,
    setSpeed,
    setBand,
    setAllBands,
    toggleMute,
    currentTime,
    duration,
    isReady,
    audioRef,
  };
}
