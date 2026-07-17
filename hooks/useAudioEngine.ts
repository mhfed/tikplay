'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { EQ_BANDS } from '../lib/types';

interface AudioEngineOptions {
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onEnded?: () => void;
  startTime?: number;
  endTime?: number;
}

export function useAudioEngine(opts: AudioEngineOptions = {}) {
  const audioRefA = useRef<HTMLAudioElement | null>(null);
  const audioRefB = useRef<HTMLAudioElement | null>(null);
  const activeDeckRef = useRef<'A' | 'B'>('A');
  // For external refs (like analyser), we expose the currently active audio
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const ctxRef = useRef<AudioContext | null>(null);
  const sourceARef = useRef<MediaElementAudioSourceNode | null>(null);
  const sourceBRef = useRef<MediaElementAudioSourceNode | null>(null);
  const gainARef = useRef<GainNode | null>(null);
  const gainBRef = useRef<GainNode | null>(null);
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
  
  const optsRef = useRef(opts);
  useEffect(() => {
    optsRef.current = opts;
  }, [opts]);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  // Fraction of `duration` that the browser has buffered (0–1). Read from
  // audio.buffered on the `progress` event only — not on every `timeupdate` —
  // so the seek bar's "loaded" layer doesn't thrash while playing.
  const [buffered, setBuffered] = useState(0);

  const getOrCreateAudio = useCallback(() => {
    if (!audioRefA.current) {
      const elA = new Audio();
      elA.id = 'global-audio-A';
      elA.crossOrigin = 'anonymous';
      elA.preload = 'metadata';
      audioRefA.current = elA;
      
      const elB = new Audio();
      elB.id = 'global-audio-B';
      elB.crossOrigin = 'anonymous';
      elB.preload = 'metadata';
      audioRefB.current = elB;
    }
    const currentAudio = activeDeckRef.current === 'A' ? audioRefA.current! : audioRefB.current!;
    audioRef.current = currentAudio; // Update exported ref
    return currentAudio;
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
      const el = activeDeckRef.current === 'A' ? audioRefA.current : audioRefB.current;
      if (ctx.state !== 'running' && el && !el.paused) {
        ctx.resume().catch(() => {});
      }
    });

    const sourceA = ctx.createMediaElementSource(audioRefA.current!);
    const sourceB = ctx.createMediaElementSource(audioRefB.current!);
    sourceARef.current = sourceA;
    sourceBRef.current = sourceB;
    
    // Crossfade gain nodes (for fading out/in)
    const fadeA = ctx.createGain();
    const fadeB = ctx.createGain();
    gainARef.current = fadeA;
    gainBRef.current = fadeB;
    fadeA.gain.value = 1;
    fadeB.gain.value = 1;
    
    sourceA.connect(fadeA);
    sourceB.connect(fadeB);
    
    // Mix them into a single track before hitting EQ
    const mix = ctx.createGain();
    fadeA.connect(mix);
    fadeB.connect(mix);

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

    // Chain: mix → filters → gain (boost) → limiter → analyser → destination
    let prev: AudioNode = mix;
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

  const crossfadeQueuedRef = useRef(false);

  const loadTrack = useCallback(
    (audioUrl: string) => {
      if (lastUrlRef.current === audioUrl) return;
      
      // If we are playing, and it's a new track, swap decks and crossfade
      const nextDeck = activeDeckRef.current === 'A' ? 'B' : 'A';
      const newAudio = nextDeck === 'A' ? audioRefA.current! : audioRefB.current!;
      const oldAudio = activeDeckRef.current === 'A' ? audioRefA.current! : audioRefB.current!;
      const oldFade = activeDeckRef.current === 'A' ? gainARef.current : gainBRef.current;
      const newFade = nextDeck === 'A' ? gainARef.current : gainBRef.current;
      
      activeDeckRef.current = nextDeck;
      audioRef.current = newAudio;
      lastUrlRef.current = audioUrl;
      
      newAudio.src = audioUrl;
      setCurrentTime(0);
      setDuration(0);
      setBuffered(0);
      setIsReady(false);
      crossfadeQueuedRef.current = false;
      
      if (ctxRef.current && oldFade && newFade && !oldAudio.paused) {
        // Crossfade!
        newFade.gain.setValueAtTime(0, ctxRef.current.currentTime);
        newFade.gain.linearRampToValueAtTime(1, ctxRef.current.currentTime + 3);
        
        oldFade.gain.setValueAtTime(1, ctxRef.current.currentTime);
        oldFade.gain.linearRampToValueAtTime(0, ctxRef.current.currentTime + 3);
        
        setTimeout(() => {
           oldAudio.pause();
           oldFade.gain.value = 1; // reset for next time
        }, 3000);
      }
    },
    [],
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
        let targetTime = resumeAt;
        if (optsRef.current.startTime && targetTime < optsRef.current.startTime) {
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
    if (audioRefA.current && !audioRefA.current.paused) audioRefA.current.pause();
    if (audioRefB.current && !audioRefB.current.paused) audioRefB.current.pause();
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
      
      // Auto-skip or Crossfade logic
      const targetEnd = optsRef.current.endTime || d;
      
      // If within 3 seconds of the end, trigger crossfade
      if (targetEnd > 3 && t >= targetEnd - 3 && !crossfadeQueuedRef.current) {
        crossfadeQueuedRef.current = true;
        optsRef.current.onEnded?.();
      }
      
      setCurrentTime(t);
      setDuration(d);
      optsRef.current.onTimeUpdate?.(t, d);
    };

    const handleEnded = (e: Event) => {
      if (e.target !== audioRef.current) return;
      optsRef.current.onEnded?.();
    };

    const handleCanPlay = (e: Event) => {
      if (e.target !== audioRef.current) return;
      const el = e.target as HTMLAudioElement;
      setIsReady(true);
      setDuration(el.duration || 0);
      if (optsRef.current.startTime && el.currentTime < optsRef.current.startTime) {
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

    // Element errored (network drop while backgrounded, decode failure, etc).
    // Try to recover once, then give up so we don't spin on a dead URL.
    const handleError = (e: Event) => {
      if (e.target !== audioRef.current) return;
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

    getOrCreateAudio();
    const elA = audioRefA.current!;
    const elB = audioRefB.current!;

    [elA, elB].forEach(el => {
      el.addEventListener('timeupdate', handleTimeUpdate);
      el.addEventListener('ended', handleEnded);
      el.addEventListener('canplay', handleCanPlay);
      el.addEventListener('loadedmetadata', handleCanPlay);
      el.addEventListener('progress', handleProgress);
      el.addEventListener('error', handleError);
      el.addEventListener('play', resumeContext);
    });
    document.addEventListener('visibilitychange', handleVisible);
    window.addEventListener('pageshow', handleVisible);

    return () => {
      [elA, elB].forEach(el => {
        if (!el) return;
        el.removeEventListener('timeupdate', handleTimeUpdate as any);
        el.removeEventListener('ended', handleEnded as any);
        el.removeEventListener('canplay', handleCanPlay as any);
        el.removeEventListener('loadedmetadata', handleCanPlay as any);
        el.removeEventListener('progress', handleProgress as any);
        el.removeEventListener('error', handleError as any);
        el.removeEventListener('play', resumeContext);
      });
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
    buffered,
    audioRef,
    analyserRef,
  };
}
