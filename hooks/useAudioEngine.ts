'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EQ_BANDS } from '../lib/types';

export type AudioLoadState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'stalled'
  | 'error';

export interface AudioMetrics {
  startupMs: number | null;
  stallCount: number;
  stallMs: number;
}

interface AudioEngineOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  startTime?: number;
  endTime?: number;
}

function releaseAudioElement(audio: HTMLAudioElement) {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
}

export function useAudioEngine(opts: AudioEngineOptions = {}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ctxRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const filtersRef = useRef<BiquadFilterNode[]>([]);
  const gainRef = useRef<GainNode | null>(null);
  const limiterRef = useRef<DynamicsCompressorNode | null>(null);
  // Tap for the spectrum analyzer — read-only, sits at the end of the chain.
  const analyserRef = useRef<AnalyserNode | null>(null);
  const connectedRef = useRef(false);
  const lastUrlRef = useRef<string | null>(null);
  const lastVolumeRef = useRef(0.8);
  // Desired volume (0–3): may be set before the audio graph exists.
  const desiredVolumeRef = useRef(0.8);
  const desiredSpeedRef = useRef(1);
  const pendingInitialTimeRef = useRef<number | null>(null);

  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [loadState, setLoadState] = useState<AudioLoadState>('idle');
  const [startupMs, setStartupMs] = useState<number | null>(null);
  const [stallCount, setStallCount] = useState(0);
  const [stallMs, setStallMs] = useState(0);
  const [errorCode, setErrorCode] = useState<number | null>(null);
  const loadStartedAtRef = useRef(0);
  const stalledAtRef = useRef(0);
  const recoveryAttemptsRef = useRef(0);
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Fraction of `duration` that the browser has buffered (0–1). Read from
  // audio.buffered on the `progress` event only — not on every `timeupdate` —
  // so the seek bar's "loaded" layer doesn't thrash while playing.
  const [buffered, setBuffered] = useState(0);

  const getOrCreateAudio = useCallback(() => {
    if (!audioRef.current) {
      const audio = new Audio();
      audio.id = 'global-audio';
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';
      audioRef.current = audio;
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
    getOrCreateAudio(); // Ensures both A and B are created

    const ctx = new AudioContext();
    ctxRef.current = ctx;

    ctx.addEventListener('statechange', () => {
      const el = audioRef.current;
      if (ctx.state !== 'running' && el && !el.paused) {
        ctx.resume().catch(() => {});
      }
    });

    const source = ctx.createMediaElementSource(audioRef.current!);
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

    // Spectrum analyzer tap. fftSize 256 → 128 frequency bins, enough for a
    // clean bar visualization; smoothing damps per-frame jitter. It's a
    // pass-through node (doesn't alter the signal) placed last so it sees the
    // final post-EQ/limiter output.
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.8;
    analyserRef.current = analyser;

    // Chain: source → filters → gain (boost) → limiter → analyser → destination
    let prev: AudioNode = source;
    for (const f of filters) {
      prev.connect(f);
      prev = f;
    }
    prev.connect(gain);
    gain.connect(limiter);
    limiter.connect(analyser);
    analyser.connect(ctx.destination);

    connectedRef.current = true;
  }, [getOrCreateAudio]);

  const endHandledRef = useRef(false);
  const trackGenerationRef = useRef(0);
  const playRequestRef = useRef(0);

  const loadTrack = useCallback(
    (audioUrl: string, initialTime?: number) => {
      if (lastUrlRef.current === audioUrl) {
        if (initialTime != null && initialTime > 0) {
          const audio = getOrCreateAudio();
          audio.currentTime = initialTime;
          setCurrentTime(initialTime);
        }
        return;
      }

      getOrCreateAudio();

      const audio = getOrCreateAudio();
      audio.pause();
      lastUrlRef.current = audioUrl;
      trackGenerationRef.current += 1;
      playRequestRef.current += 1;
      recoveringRef.current = false;
      recoveryAttemptsRef.current = 0;
      stalledAtRef.current = 0;
      loadStartedAtRef.current = performance.now();
      setLoadState('loading');
      setStartupMs(null);
      setStallCount(0);
      setStallMs(0);
      setErrorCode(null);

      audio.src = audioUrl;
      audio.volume = Math.min(desiredVolumeRef.current, 1);
      audio.playbackRate = desiredSpeedRef.current;
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setIsReady(false);
      endHandledRef.current = false;
      pendingInitialTimeRef.current =
        initialTime != null && initialTime > 0 ? initialTime : null;
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
  const recover = useCallback((force = false) => {
    const audio = audioRef.current;
    const url = lastUrlRef.current;
    if (!audio || !url) return;
    if (recoveringRef.current || (!force && !wantsPlayingRef.current)) return;
    if (!force && recoveryAttemptsRef.current >= 1) {
      setErrorCode(audio.error?.code ?? 0);
      setLoadState('error');
      return;
    }
    recoveryAttemptsRef.current += 1;
    recoveringRef.current = true;
    if (force) wantsPlayingRef.current = true;
    setErrorCode(null);
    setLoadState('loading');
    const generation = trackGenerationRef.current;
    const resumeAt = audio.currentTime || 0;
    // Force a fresh load by clearing src first, then re-arming it.
    audio.removeAttribute('src');
    audio.load();
    const reload = () => {
      audio.src = url;
      // Seek back to where we were once metadata is back, then play.
      const onReady = () => {
        if (
          audio !== audioRef.current ||
          url !== lastUrlRef.current ||
          generation !== trackGenerationRef.current ||
          !wantsPlayingRef.current
        ) {
          recoveringRef.current = false;
          return;
        }
        let targetTime = resumeAt;
        if (
          optsRef.current.startTime &&
          targetTime < optsRef.current.startTime
        ) {
          targetTime = optsRef.current.startTime;
        }
        if (
          targetTime > 0 &&
          Number.isFinite(audio.duration) &&
          targetTime < audio.duration
        ) {
          audio.currentTime = targetTime;
        }
        audio.play().catch(() => {});
        recoveringRef.current = false;
        audio.removeEventListener('canplay', onReady);
      };
      audio.addEventListener('canplay', onReady, { once: true });
    };
    reload();
  }, []);

  const retry = useCallback(() => {
    recoveryAttemptsRef.current = 0;
    recover(true);
  }, [recover]);

  const play = useCallback(async () => {
    const audio = getOrCreateAudio();
    const generation = trackGenerationRef.current;
    const request = ++playRequestRef.current;
    ensureAudioGraph();
    if (ctxRef.current?.state === 'suspended') {
      await ctxRef.current.resume();
    }
    if (
      audio !== audioRef.current ||
      request !== playRequestRef.current ||
      generation !== trackGenerationRef.current
    ) {
      return;
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
    playRequestRef.current += 1;
    wantsPlayingRef.current = false;
    if (audioRef.current && !audioRef.current.paused) audioRef.current.pause();
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
      const targetEnd = optsRef.current.endTime || audio.duration;
      if (!targetEnd || time < targetEnd) endHandledRef.current = false;
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
    desiredSpeedRef.current = s;
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

    const handleTimeUpdate = (e: Event) => {
      if (e.target !== audioRef.current) return;
      resumeContext();

      const el = e.target as HTMLAudioElement;
      const t = el.currentTime;
      const d = el.duration || 0;

      // A custom trim end needs an explicit stop; untrimmed tracks use the
      // native `ended` event so their final seconds are never cut off.
      const targetEnd = optsRef.current.endTime;
      if (
        targetEnd != null &&
        targetEnd < d &&
        t >= targetEnd &&
        !endHandledRef.current
      ) {
        endHandledRef.current = true;
        optsRef.current.onEnded?.();
      }

      setCurrentTime(t);
      setDuration(d);
      optsRef.current.onTimeUpdate?.(t, d);
    };

    const handleEnded = (e: Event) => {
      if (e.target !== audioRef.current) return;
      endHandledRef.current = true;
      optsRef.current.onEnded?.();
    };

    const handleCanPlay = (e: Event) => {
      if (e.target !== audioRef.current) return;
      const el = e.target as HTMLAudioElement;
      setIsReady(true);
      setLoadState((state) => (state === 'playing' ? state : 'ready'));
      setDuration(el.duration || 0);
      const initialTime = pendingInitialTimeRef.current;
      if (
        initialTime != null &&
        Number.isFinite(el.duration) &&
        initialTime < el.duration
      ) {
        el.currentTime = initialTime;
        setCurrentTime(initialTime);
        pendingInitialTimeRef.current = null;
      } else if (
        optsRef.current.startTime &&
        el.currentTime < optsRef.current.startTime
      ) {
        el.currentTime = optsRef.current.startTime;
      }
    };

    // Buffered amount changed (network chunk arrived). Take the furthest
    // buffered end and express it as a fraction of the duration.
    const handleProgress = (e: Event) => {
      if (e.target !== audioRef.current) return;
      const el = e.target as HTMLAudioElement;
      const ranges = el.buffered;
      const dur = el.duration || 0;
      if (!ranges.length || !dur) {
        setBuffered(0);
        return;
      }
      const end = ranges.end(ranges.length - 1);
      setBuffered(dur > 0 ? Math.min(1, end / dur) : 0);
    };

    const finishStall = () => {
      if (!stalledAtRef.current) return;
      const elapsed = performance.now() - stalledAtRef.current;
      stalledAtRef.current = 0;
      setStallMs((total) => total + elapsed);
      if (process.env.NODE_ENV === 'development') {
        console.debug(`[audio] stall ${Math.round(elapsed)}ms`);
      }
    };

    const handlePlaying = (e: Event) => {
      if (e.target !== audioRef.current) return;
      finishStall();
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setLoadState('playing');
      if (loadStartedAtRef.current > 0) {
        const elapsed = performance.now() - loadStartedAtRef.current;
        setStartupMs(elapsed);
        if (process.env.NODE_ENV === 'development') {
          console.debug(`[audio] startup ${Math.round(elapsed)}ms`);
        }
        loadStartedAtRef.current = 0;
      }
    };

    const handleWaiting = (e: Event) => {
      if (e.target !== audioRef.current || !wantsPlayingRef.current) return;
      if (!stalledAtRef.current) {
        stalledAtRef.current = performance.now();
        setStallCount((count) => count + 1);
      }
      setLoadState('stalled');
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = setTimeout(() => {
        if (stalledAtRef.current && wantsPlayingRef.current) {
          setErrorCode(0);
          setLoadState('error');
        }
      }, 15_000);
    };

    // Element errored (network drop while backgrounded, decode failure, etc).
    // Try to recover once, then expose an error if recovery cannot begin.
    const handleError = (e: Event) => {
      if (e.target !== audioRef.current) return;
      finishStall();
      const canRecover =
        wantsPlayingRef.current &&
        !recoveringRef.current &&
        recoveryAttemptsRef.current < 1;
      if (canRecover) recover();
      else {
        setErrorCode(audioRef.current?.error?.code ?? 0);
        setLoadState('error');
      }
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

    getOrCreateAudio();
    const audio = audioRef.current!;

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadedmetadata', handleCanPlay);
    audio.addEventListener('progress', handleProgress);
    audio.addEventListener('playing', handlePlaying);
    audio.addEventListener('waiting', handleWaiting);
    audio.addEventListener('stalled', handleWaiting);
    audio.addEventListener('error', handleError);
    audio.addEventListener('play', resumeContext);
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', handleVisible);

    return () => {
      wantsPlayingRef.current = false;
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      recoveringRef.current = false;
      trackGenerationRef.current += 1;
      playRequestRef.current += 1;

      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadedmetadata', handleCanPlay);
      audio.removeEventListener('progress', handleProgress);
      audio.removeEventListener('playing', handlePlaying);
      audio.removeEventListener('waiting', handleWaiting);
      audio.removeEventListener('stalled', handleWaiting);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('play', resumeContext);
      releaseAudioElement(audio);
      document.removeEventListener('visibilitychange', handleVisible);
      window.removeEventListener('pageshow', handleVisible);
      document.removeEventListener('touchstart', unlock);
      document.removeEventListener('click', unlock);

      sourceRef.current?.disconnect();
      if (ctxRef.current?.state !== 'closed') {
        ctxRef.current?.close().catch(() => {});
      }

      audioRef.current = null;
      ctxRef.current = null;
      sourceRef.current = null;
      filtersRef.current = [];
      gainRef.current = null;
      limiterRef.current = null;
      analyserRef.current = null;
      connectedRef.current = false;
      lastUrlRef.current = null;
    };
  }, [getOrCreateAudio, resumeContext, ensureAudioGraph, recover]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    loadTrack,
    play,
    retry,
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
    loadState,
    errorCode,
    metrics: { startupMs, stallCount, stallMs } satisfies AudioMetrics,
    buffered,
    audioRef,
    analyserRef,
  };
}
