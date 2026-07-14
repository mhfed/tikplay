'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import Cover from './Cover';
import Equalizer from './Equalizer';
import {
  CheckIcon,
  ListMusicIcon,
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShareIcon,
  ShuffleIcon,
  SlidersIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from './icons';
import SpeedControl from './SpeedControl';

type PanelTab = 'playing' | 'queue' | 'eq';

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PlayerPanelProps {
  mobileTab?: string;
}

export default function PlayerPanel({ mobileTab }: PlayerPanelProps) {
  const {
    tracks,
    currentTrack,
    currentIndex,
    currentPlaylistId,
    isPlaying,
    repeat,
    shuffle,
    volume,
    speed,
    eqGains,
    pendingSeek,
    clearPendingSeek,
    togglePlay,
    setPlaying,
    playTrack,
    next,
    prev,
    setVolume,
    setSpeed,
    setEqGains,
    setShuffle,
    cycleRepeat,
    onEnded,
  } = useAppStore();

  const [shareCopied, setShareCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<PanelTab>('playing');
  const showExtras = activeTab !== 'playing';
  const upNext = currentIndex >= 0 ? tracks.slice(currentIndex + 1) : tracks;

  const engine = useAudioEngine({
    onEnded: () => {
      if (repeat === 'one' && currentTrack) {
        engine.seek(0);
        engine.play();
        return;
      }
      onEnded();
    },
  });

  // Load + play/pause sync. Changing `src` implicitly pauses the element, so
  // switching tracks mid-playback must re-trigger play() even though
  // `isPlaying` never flipped — hence a single effect over both deps.
  useEffect(() => {
    if (currentTrack) engine.loadTrack(currentTrack.audioUrl);
    if (isPlaying && currentTrack) engine.play();
    else engine.pause();
  }, [currentTrack?.audioUrl, isPlaying]); // eslint-disable-line react-hooks/exhaustive-deps

  // Restore the timestamp from a shared URL once the track's metadata is in.
  useEffect(() => {
    if (pendingSeek == null || !engine.isReady || !currentTrack) return;
    engine.seek(pendingSeek);
    clearPendingSeek();
  }, [pendingSeek, engine.isReady, currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Volume sync
  useEffect(() => {
    engine.setVolume(volume);
  }, [volume]); // eslint-disable-line react-hooks/exhaustive-deps

  // Speed sync
  useEffect(() => {
    engine.setSpeed(speed);
  }, [speed]); // eslint-disable-line react-hooks/exhaustive-deps

  // EQ sync
  useEffect(() => {
    engine.setAllBands(eqGains);
  }, [eqGains]); // eslint-disable-line react-hooks/exhaustive-deps

  // Media Session API — lock-screen / notification controls. Handlers are
  // explicit play/pause (not toggle): after an OS interruption (call, screen
  // lock) the element can pause without the store knowing, and a toggle from
  // the lock screen would then invert the intent.
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.author,
      artwork: currentTrack.cover
        ? [{ src: currentTrack.cover, sizes: '512x512', type: 'image/jpeg' }]
        : [],
    });
    navigator.mediaSession.setActionHandler('play', () => {
      setPlaying(true);
      engine.play();
    });
    navigator.mediaSession.setActionHandler('pause', () => {
      setPlaying(false);
      engine.pause();
    });
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
    try {
      navigator.mediaSession.setActionHandler('seekto', (e) => {
        if (e.seekTime != null) engine.seek(e.seekTime);
      });
    } catch {
      // 'seekto' not supported on some browsers.
    }
  }, [currentTrack, setPlaying, prev, next]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep lock-screen state/position in sync so the OS renders the correct
  // button and a live scrubber.
  useEffect(() => {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.playbackState = currentTrack
      ? isPlaying
        ? 'playing'
        : 'paused'
      : 'none';
  }, [isPlaying, currentTrack]);

  useEffect(() => {
    if (
      !('mediaSession' in navigator) ||
      !navigator.mediaSession.setPositionState
    )
      return;
    if (
      !currentTrack ||
      !Number.isFinite(engine.duration) ||
      engine.duration <= 0
    )
      return;
    navigator.mediaSession.setPositionState({
      duration: engine.duration,
      playbackRate: speed,
      position: Math.min(engine.currentTime, engine.duration),
    });
  }, [currentTrack?.id, engine.duration, engine.currentTime, speed]); // eslint-disable-line react-hooks/exhaustive-deps

  // Coming back from background: if the OS paused the element (interruption)
  // while the app still thinks it's playing, restart it.
  useEffect(() => {
    const handleVisible = () => {
      if (document.visibilityState !== 'visible') return;
      if (isPlaying && currentTrack && engine.audioRef.current?.paused) {
        engine.play();
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () =>
      document.removeEventListener('visibilitychange', handleVisible);
  }, [isPlaying, currentTrack]); // eslint-disable-line react-hooks/exhaustive-deps

  // Global playback shortcuts. Skip while typing or when focus is on a
  // button/link so native Space/Enter activation (e.g. dialog Cancel/Save)
  // isn't hijacked — preventDefault on a keydown Space suppresses the
  // browser's synthetic click for a focused button.
  useEffect(() => {
    const isInteractiveTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      return (
        ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName) ||
        el.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInteractiveTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey)
        return;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.shiftKey) next();
          else if (currentTrack)
            engine.seek(Math.min(engine.currentTime + 5, engine.duration || 0));
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.shiftKey) prev();
          else if (currentTrack)
            engine.seek(Math.max(engine.currentTime - 5, 0));
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(3, Math.round((volume + 0.1) * 100) / 100));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, Math.round((volume - 0.1) * 100) / 100));
          break;
        case 'm':
        case 'M':
          engine.toggleMute(volume, setVolume);
          break;
        case 's':
        case 'S':
          setShuffle(!shuffle);
          break;
        case 'r':
        case 'R':
          cycleRepeat();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    togglePlay,
    next,
    prev,
    engine,
    currentTrack,
    volume,
    setVolume,
    shuffle,
    setShuffle,
    cycleRepeat,
  ]);

  const shareTrack = async () => {
    if (!currentTrack) return;
    const params = new URLSearchParams();
    if (currentPlaylistId !== 1) params.set('pl', String(currentPlaylistId));
    params.set('track', String(currentTrack.id));
    if (engine.currentTime > 1)
      params.set('t', String(Math.floor(engine.currentTime)));
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    // Native share sheet only on touch devices — on desktop, copying the link
    // is what people actually want.
    const isTouch = window.matchMedia('(pointer: coarse)').matches;
    if (isTouch && navigator.share) {
      try {
        await navigator.share({ title: currentTrack.title, url });
        return;
      } catch {
        // User dismissed the sheet or share failed — fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  };

  const progressPercent =
    engine.duration > 0 ? (engine.currentTime / engine.duration) * 100 : 0;

  // MiniPlayer lives outside this component; publish progress as a CSS var
  // so its bar tracks playback without lifting engine state into the store.
  useEffect(() => {
    document.documentElement.style.setProperty(
      '--mini-progress',
      `${progressPercent}%`,
    );
  }, [progressPercent]);

  const panelClass = `player-panel${mobileTab === 'player' ? ' mobile-visible' : ''}`;

  return (
    <div className={panelClass}>
      {/* Turntable disc — grooves are the primary surface and spin; the cover
          label and spindle sit outside the rotating element so they stay readable */}
      <div className={`np__disc-wrap${isPlaying ? ' np--playing' : ''}`}>
        <div className="np__disc-guide" aria-hidden />
        <div className="np__disc">
          <div className="np__grooves" aria-hidden />
        </div>
        {currentTrack ? (
          <Cover
            src={currentTrack.cover}
            alt={currentTrack.title}
            subtitle={currentTrack.author}
            className="np__label np__label--art"
          />
        ) : (
          <div className="np__label" aria-hidden>
            ♪
          </div>
        )}
        <div className="np__spindle" aria-hidden />
        <div className="np__sheen" aria-hidden />
        <div className="np__glow" aria-hidden />
      </div>

      {/* Meta */}
      <div className="np__meta">
        {currentTrack ? (
          <>
            <span className="np__title" title={currentTrack.title}>
              {currentTrack.title}
            </span>
            <span className="np__author">{currentTrack.author}</span>
            <button
              type="button"
              className={`np__share${shareCopied ? ' is-copied' : ''}`}
              onClick={shareTrack}
              aria-label="Chia sẻ bài hát"
              title="Chia sẻ bài hát"
            >
              {shareCopied ? <CheckIcon size={13} /> : <ShareIcon size={13} />}
              <span>{shareCopied ? 'Đã copy link!' : 'Chia sẻ'}</span>
            </button>
          </>
        ) : (
          <>
            <span className="np__title">No track playing</span>
            <span className="np__author">Paste a TikTok URL to start</span>
          </>
        )}
      </div>

      {/* Controls */}
      <div className="np__controls">
        <button
          className={`iconbtn${shuffle ? ' iconbtn--on' : ''}`}
          onClick={() => setShuffle(!shuffle)}
          aria-label="Shuffle"
          title="Shuffle (S)"
        >
          <ShuffleIcon size={16} />
        </button>
        <button
          className="btn btn--icon"
          onClick={prev}
          disabled={!currentTrack}
          aria-label="Previous"
          title="Previous (Shift+←)"
        >
          <PrevIcon size={18} />
        </button>
        <button
          className="btn btn--play"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          title={`${isPlaying ? 'Pause' : 'Play'} (Space)`}
        >
          {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <button
          className="btn btn--icon"
          onClick={next}
          disabled={!currentTrack}
          aria-label="Next"
          title="Next (Shift+→)"
        >
          <NextIcon size={18} />
        </button>
        <button
          className={`iconbtn${repeat !== 'off' ? ' iconbtn--on' : ''}`}
          onClick={cycleRepeat}
          aria-label={
            repeat === 'one'
              ? 'Repeat one'
              : repeat === 'all'
                ? 'Repeat all'
                : 'Repeat off'
          }
          title={`${repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'} (R)`}
        >
          {repeat === 'one' ? (
            <RepeatOneIcon size={16} />
          ) : (
            <RepeatIcon size={16} />
          )}
        </button>
      </div>

      {/* Progress */}
      <div className="np__progress">
        <span className="np__time">{formatTime(engine.currentTime)}</span>
        <input
          type="range"
          className="np__seek"
          min={0}
          max={engine.duration || 0}
          step={0.1}
          value={Math.min(engine.currentTime, engine.duration || 0)}
          onChange={(e) => engine.seek(Number(e.target.value))}
          disabled={!currentTrack}
          aria-label="Seek"
          style={{ '--progress': `${progressPercent}%` } as React.CSSProperties}
        />
        <span className="np__time">{formatTime(engine.duration)}</span>
      </div>

      {/* Volume */}
      <div className="np__volume">
        <button
          type="button"
          className="np__vol-btn"
          onClick={() => engine.toggleMute(volume, setVolume)}
          aria-label={volume > 0 ? 'Mute' : 'Unmute'}
          title={`${volume > 0 ? 'Mute' : 'Unmute'} (M)`}
        >
          {volume > 0 ? <VolumeIcon size={16} /> : <VolumeMuteIcon size={16} />}
        </button>
        <input
          type="range"
          className="np__vol-range"
          min={0}
          max={3}
          step={0.05}
          value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
        />
        <span className={`np__vol-value${volume > 1 ? ' is-boosted' : ''}`}>
          {Math.round(volume * 100)}%
        </span>
      </div>

      {/* Playing / Queue / Equalizer — segmented tab switches the panel below */}
      <div className="np__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'playing'}
          className={`np__tab${activeTab === 'playing' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('playing')}
        >
          Playing
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'queue'}
          className={`np__tab${activeTab === 'queue' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('queue')}
        >
          <ListMusicIcon size={13} />
          Queue
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'eq'}
          className={`np__tab${activeTab === 'eq' ? ' is-active' : ''}`}
          onClick={() => setActiveTab('eq')}
        >
          <SlidersIcon size={13} />
          Equalizer
        </button>
      </div>
      <div className={`np__extras${showExtras ? ' is-open' : ''}`}>
        {activeTab === 'eq' && (
          <>
            <SpeedControl speed={speed} onChange={setSpeed} />
            <Equalizer
              gains={eqGains}
              onGainChange={(i, v) => {
                const next = [...eqGains];
                next[i] = v;
                setEqGains(next);
              }}
              onPreset={setEqGains}
            />
          </>
        )}
        {activeTab === 'queue' && (
          <div className="np__queue">
            {upNext.length === 0 ? (
              <p className="np__queue-empty">
                {shuffle
                  ? 'Bài tiếp theo sẽ được chọn ngẫu nhiên.'
                  : 'Đã hết danh sách phát.'}
              </p>
            ) : (
              <ul className="np__queue-list">
                {upNext.map((track, i) => (
                  <li key={track.id}>
                    <button
                      type="button"
                      className="np__queue-item"
                      onClick={() => playTrack(track)}
                    >
                      <span className="np__queue-index">{i + 1}</span>
                      <Cover
                        src={track.cover}
                        alt={track.title}
                        subtitle={track.author}
                        className="np__queue-cover"
                      />
                      <span className="np__queue-meta">
                        <span className="np__queue-title">{track.title}</span>
                        <span className="np__queue-author">{track.author}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
