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
      el.id = 'global-audio';
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

  // Recover from a network/decode error: if the element dies mid-playback
  // (common when the network drops while the app is backgrounded — the
  // element fires `error` and refuses to play until src is reloaded), reload
  // src and resume from the last position. Only retries when the store still
  // intends to play (wantsPlayingRef true), so a user-initiated pause isn't
  // overridden.
  const wantsPlayingRef = useRef(false);
  const recoveringRef = useRef(false);
  const recover = useCallback(() => {
    const audio = audioRef.current;
    const url = lastUrlRef.current;
    if (!audio || !url) return;
    if (recoveringRef.current || !wantsPlayingRef.current) return;
    recoveringRef.current = true;
    const resumeAt = audio.currentTime || 0;
    // Force a fresh load by clearing src first, then re-arming it.
    audio.removeAttribute('src');
    audio.load();
    const reload = () => {
      audio.src = url;
      // Seek back to where we were once metadata is back, then play.
      const onReady = () => {
        if (resumeAt > 0 && Number.isFinite(audio.duration) && resumeAt < audio.duration) {
          audio.currentTime = resumeAt;
        }
        audio.play().catch(() => {});
        recoveringRef.current = false;
        audio.removeEventListener('canplay', onReady);
      };
      audio.addEventListener('canplay', onReady, { once: true });
    };
    reload();
  }, []);

  const play = useCallback(async () => {
    const audio = getOrCreateAudio();
    ensureAudioGraph();
    if (ctxRef.current?.state === 'suspended') {
      await ctxRef.current.resume();
    }
    wantsPlayingRef.current = true;
    // If the element previously errored, clear that state so play() works.
    if (audio.error) {
      recover();
      return;
    }
    await audio.play().catch(() => {});
  }, [getOrCreateAudio, ensureAudioGraph, recover]);

  const pause = useCallback(() => {
    wantsPlayingRef.current = false;
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

    // Global interaction listener to unlock AudioContext right away
    const unlock = () => {
      ensureAudioGraph();
      if (ctxRef.current?.state === 'suspended') {
        ctxRef.current.resume().catch(() => {});
      }
      // Re-add to catch subsequent touches if the first one failed (e.g., didn't have user gesture)
    };

    document.addEventListener('touchstart', unlock, {
      once: true,
      passive: true,
    });
    document.addEventListener('click', unlock, { once: true, passive: true });

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

    // Element errored (network drop while backgrounded, decode failure, etc).
    // Try to recover once, then give up so we don't spin on a dead URL.
    const handleError = () => {
      recover();
    };

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        resumeContext();
        // Coming back to the page: if we still want to play but the element
        // died or is paused (OS paused it during the interruption), revive it.
        const el = audioRef.current;
        if (wantsPlayingRef.current && el && (el.paused || el.error)) {
          if (el.error) recover();
          else el.play().catch(() => {});
        }
      }
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', resumeContext);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', handleVisible);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleCanPlay);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', resumeContext);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('pageshow', handleVisible);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);
    };
  }, [getOrCreateAudio, resumeContext, ensureAudioGraph, recover]); // eslint-disable-line react-hooks/exhaustive-deps

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
