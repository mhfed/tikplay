'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  SpinnerIcon,
  VolumeIcon,
  VolumeLowIcon,
  VolumeMuteIcon,
} from './icons';
import SpeedControl from './SpeedControl';

type PopoverPanel = 'queue' | 'eq' | null;

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface PlayerPanelProps {
  mobileTab?: string;
  onClosePlayer?: () => void;
  onOpenPlayer?: () => void;
}

// Distance (px) the sheet must be dragged down before it dismisses.
const SHEET_CLOSE_THRESHOLD = 100;
// Matches the mobile sheet slide transition so the local close animation
// lines up with the CSS one.
const SHEET_CLOSE_MS = 280;

export default function PlayerPanel({
  mobileTab,
  onClosePlayer,
  onOpenPlayer,
}: PlayerPanelProps) {
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
  const [openPanel, setOpenPanel] = useState<PopoverPanel>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const upNext = currentIndex >= 0 ? tracks.slice(currentIndex + 1) : tracks;

  // ── Scrub-preview seeking ──────────────────────────────
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);

  // ── Iconbtn activation pulse (one-shot, not infinite) ──
  const [pulseShuffle, setPulseShuffle] = useState(false);
  const [pulseRepeat, setPulseRepeat] = useState(false);

  // ── Mobile sheet drag / close ──────────────────────────
  const isMobileVisible = mobileTab === 'player';
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [closing, setClosing] = useState(false);
  const dragStartY = useRef(0);

  // Scroll-wheel volume: a native, non-passive listener (React's onWheel is
  // passive, so preventDefault there can't stop the page from scrolling).
  const volTrackRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  // Volume bar is collapsed to just the icon; it reveals on hover (CSS) or,
  // on touch, when tapped open. `volOpen` drives only the touch path.
  const volGroupRef = useRef<HTMLDivElement>(null);
  const [volOpen, setVolOpen] = useState(false);
  const pointerTypeRef = useRef<string>('mouse');

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

  // Scroll-wheel over the volume track nudges volume in 5% steps (0–300%).
  useEffect(() => {
    const el = volTrackRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.05 : -0.05;
      const next = Math.max(
        0,
        Math.min(3, Math.round((volumeRef.current + delta) * 100) / 100),
      );
      setVolume(next);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [setVolume]);

  // Touch: collapse the volume bar again when tapping anywhere outside it.
  useEffect(() => {
    if (!volOpen) return;
    const onDown = (e: PointerEvent) => {
      if (!volGroupRef.current?.contains(e.target as Node)) setVolOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [volOpen]);

  // Close the queue/EQ popover when clicking outside it (but not when clicking
  // the toggle button that owns it — that button handles its own toggle).
  useEffect(() => {
    if (!openPanel) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement;
      if (popoverRef.current?.contains(target)) return;
      if (target.closest?.('.pb__toggle')) return;
      setOpenPanel(null);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [openPanel]);

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

  // Global playback shortcuts. Only text-entry elements (INPUT/TEXTAREA/SELECT/
  // contentEditable) suppress the shortcuts so typing isn't hijacked. BUTTON/A are
  // intentionally NOT skipped: when a player control is focused, Space must still
  // toggle play/pause — preventDefault() on keydown suppresses the browser's
  // synthetic click on the focused button so it doesn't also fire. While a modal
  // dialog is open, defer to native activation (dialog Cancel/Close buttons).
  useEffect(() => {
    const isTextEntryTarget = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      return (
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) ||
        el.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        isTextEntryTarget(e.target) ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        document.querySelector('.modal-backdrop')
      )
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

  const isLoading = !!currentTrack && !engine.isReady;

  const progressPercent =
    engine.duration > 0 ? (engine.currentTime / engine.duration) * 100 : 0;

  // While scrubbing, the UI follows the finger (previewTime) and ignores
  // timeupdate-driven jumps; otherwise it tracks real playback.
  const displayedTime = isScrubbing ? previewTime : engine.currentTime;
  const displayedPercent =
    engine.duration > 0 ? (displayedTime / engine.duration) * 100 : 0;
  const seekValue =
    engine.duration > 0 ? Math.min(displayedTime, engine.duration) : 0;
  const bufferedPercent = engine.buffered * 100;
  const volPercent = (volume / 3) * 100;
  const isBoosted = volume > 1;
  const isMuted = volume === 0;

  const commitScrub = () => {
    if (!isScrubbing) return;
    engine.seek(previewTime);
    setIsScrubbing(false);
  };

  const requestClose = useCallback(() => {
    if (!isMobileVisible) {
      onClosePlayer?.();
      return;
    }
    setClosing(true);
    window.setTimeout(() => {
      onClosePlayer?.();
      setClosing(false);
    }, SHEET_CLOSE_MS);
  }, [isMobileVisible, onClosePlayer]);

  const onSheetPointerDown = (e: React.PointerEvent) => {
    if (!isMobileVisible) return;
    setDragging(true);
    setDragOffset(0); // clear any leftover offset from a prior close so the sheet doesn't jump on the first move
    dragStartY.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const onSheetPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    setDragOffset(Math.max(0, e.clientY - dragStartY.current));
  };

  const onSheetPointerUp = () => {
    if (!dragging) return;
    const offset = dragOffset;
    setDragging(false);
    if (offset > SHEET_CLOSE_THRESHOLD) requestClose();
    else setDragOffset(0); // snap back — CSS transition eases it home
  };

  // Sheet transform is driven by inline style only during a drag or the
  // local close animation; otherwise CSS owns it (translateY(0) when open).
  const sheetStyle: React.CSSProperties | undefined = closing
    ? { transform: 'translateY(100%)' }
    : dragging
      ? { transform: `translateY(${dragOffset}px)`, transition: 'none' }
      : undefined;

  const panelClass = `player-bar${isMobileVisible ? ' mobile-visible' : ''}${currentTrack ? ' has-track' : ''}`;

  // On mobile the compact bar is tappable to expand into the full sheet; on
  // desktop there's no sheet, so tapping the identity area does nothing.
  const expandOnMobile = () => {
    if (isMobileVisible) return;
    if (window.matchMedia('(max-width: 1024px)').matches) onOpenPlayer?.();
  };

  // Esc closes the mobile sheet.
  useEffect(() => {
    if (!isMobileVisible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isMobileVisible, requestClose]);

  return (
    <>
      <div
        className={`player-sheet-backdrop${isMobileVisible ? ' is-visible' : ''}`}
        onClick={requestClose}
        aria-hidden
      />
      <div className={panelClass} style={sheetStyle}>
        {/* Drag handle — the grip zone for swipe-to-dismiss (mobile) */}
        <div
          className="np__sheet-handle"
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          aria-hidden
        />

        {/* Thin indeterminate line while the track buffers */}
        {isLoading && (
          <div className="np__loading-line" aria-hidden>
            <span className="np__loading-bar" />
          </div>
        )}

        {/* Compact-bar progress line — a thin fill along the top of the bar,
            visible only in the collapsed (mobile) state via CSS. */}
        <div className="pb__mini-progress" aria-hidden>
          <span style={{ width: `${progressPercent}%` }} />
        </div>

        {/* LEFT — track identity. On mobile the whole zone expands the sheet. */}
        <button
          type="button"
          className="pb__identity"
          onClick={expandOnMobile}
          aria-label={currentTrack ? 'Mở trình phát' : undefined}
        >
          {currentTrack ? (
            <Cover
              key={`art-${currentTrack.id}`}
              src={currentTrack.cover}
              alt={currentTrack.title}
              subtitle={currentTrack.author}
              className="pb__cover"
            />
          ) : (
            <span className="pb__cover pb__cover--empty" aria-hidden>
              ♪
            </span>
          )}
          <span className="pb__meta">
            {currentTrack ? (
              <>
                <span className="pb__title" title={currentTrack.title}>
                  {currentTrack.title}
                </span>
                <span className="pb__author">{currentTrack.author}</span>
              </>
            ) : (
              <>
                <span className="pb__title">No track playing</span>
                <span className="pb__author">Paste a TikTok URL to start</span>
              </>
            )}
          </span>
        </button>
        {currentTrack && (
          <button
            type="button"
            className={`pb__share${shareCopied ? ' is-copied' : ''}`}
            onClick={shareTrack}
            aria-label="Chia sẻ bài hát"
            title={shareCopied ? 'Đã copy link!' : 'Chia sẻ bài hát'}
          >
            {shareCopied ? <CheckIcon size={16} /> : <ShareIcon size={16} />}
          </button>
        )}

        {/* CENTER — transport + progress */}
        <div className="pb__center">
          {/* Controls */}
          <div className="np__controls">
            <button
              className={`iconbtn pb__ctrl pb__ctrl--shuffle${shuffle ? ' iconbtn--on' : ''}${pulseShuffle ? ' iconbtn--pulse' : ''}`}
              onClick={() => {
                setShuffle(!shuffle);
                setPulseShuffle(true);
              }}
              onAnimationEnd={() => setPulseShuffle(false)}
              aria-label="Shuffle"
              title="Shuffle (S)"
            >
              <ShuffleIcon size={16} />
            </button>
            <button
              className="btn btn--icon pb__ctrl pb__ctrl--prev"
              onClick={prev}
              disabled={!currentTrack}
              aria-label="Previous"
              title="Previous (Shift+←)"
            >
              <PrevIcon size={18} />
            </button>
            <button
              className="btn btn--play pb__ctrl pb__ctrl--play"
              onClick={togglePlay}
              aria-label={isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'}
              title={`${isLoading ? 'Loading' : isPlaying ? 'Pause' : 'Play'} (Space)`}
            >
              {isLoading ? (
                <SpinnerIcon className="np__spin" size={22} />
              ) : (
                <span
                  className="np__play-icon"
                  key={isPlaying ? 'pause' : 'play'}
                >
                  {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
                </span>
              )}
            </button>
            <button
              className="btn btn--icon pb__ctrl pb__ctrl--next"
              onClick={next}
              disabled={!currentTrack}
              aria-label="Next"
              title="Next (Shift+→)"
            >
              <NextIcon size={18} />
            </button>
            <button
              className={`iconbtn pb__ctrl pb__ctrl--repeat${repeat !== 'off' ? ' iconbtn--on' : ''}${pulseRepeat ? ' iconbtn--pulse' : ''}`}
              onClick={() => {
                cycleRepeat();
                setPulseRepeat(true);
              }}
              onAnimationEnd={() => setPulseRepeat(false)}
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
            <div className="np__seek-wrap">
              <input
                type="range"
                className="np__seek"
                min={0}
                max={engine.duration || 0}
                step={0.1}
                value={seekValue}
                onPointerDown={() => {
                  if (engine.duration > 0) {
                    setIsScrubbing(true);
                    setPreviewTime(displayedTime);
                  }
                }}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (isScrubbing) setPreviewTime(v);
                  else engine.seek(v);
                }}
                onPointerUp={commitScrub}
                onPointerCancel={commitScrub}
                disabled={!currentTrack || engine.duration <= 0}
                aria-label="Seek"
                style={
                  {
                    '--progress': `${displayedPercent}%`,
                    '--buffered': `${bufferedPercent}%`,
                  } as React.CSSProperties
                }
              />
              {isScrubbing && (
                <div
                  className="np__seek-tip"
                  style={{ left: `${displayedPercent}%` }}
                >
                  {formatTime(previewTime)}
                </div>
              )}
            </div>
            <span className="np__time">{formatTime(engine.duration)}</span>
          </div>
        </div>
        {/* /CENTER */}

        {/* RIGHT — queue / equalizer / volume */}
        <div className="pb__right">
          <button
            type="button"
            className={`iconbtn pb__toggle${openPanel === 'queue' ? ' iconbtn--on' : ''}`}
            onClick={() =>
              setOpenPanel((p) => (p === 'queue' ? null : 'queue'))
            }
            aria-label="Hàng chờ"
            title="Hàng chờ"
          >
            <ListMusicIcon size={18} />
          </button>
          <button
            type="button"
            className={`iconbtn pb__toggle${openPanel === 'eq' ? ' iconbtn--on' : ''}`}
            onClick={() => setOpenPanel((p) => (p === 'eq' ? null : 'eq'))}
            aria-label="Equalizer"
            title="Equalizer"
          >
            <SlidersIcon size={18} />
          </button>

          {/* Volume — collapsed to the icon; bar reveals on hover / tap */}
          <div
            ref={volGroupRef}
            className={`np__volume${isBoosted ? ' is-boosted' : ''}${volOpen ? ' is-open' : ''}`}
          >
            <button
              type="button"
              className="np__vol-btn"
              onPointerDown={(e) => {
                pointerTypeRef.current = e.pointerType;
              }}
              onClick={() => {
                // Touch: first tap reveals the bar, a second tap (while open) mutes.
                if (pointerTypeRef.current === 'touch' && !volOpen) {
                  setVolOpen(true);
                  return;
                }
                engine.toggleMute(volume, setVolume);
              }}
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              title={`${isMuted ? 'Unmute' : 'Mute'} (M)`}
            >
              {isMuted ? (
                <VolumeMuteIcon size={16} />
              ) : volume <= 0.5 ? (
                <VolumeLowIcon size={16} />
              ) : (
                <VolumeIcon size={16} />
              )}
            </button>
            <div className="np__vol-track" ref={volTrackRef}>
              <input
                type="range"
                className="np__vol-range"
                min={0}
                max={3}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                onDoubleClick={() => setVolume(1)}
                aria-label="Volume"
                aria-valuetext={`${Math.round(volume * 100)}%`}
                title="Double-click for 100% · scroll to adjust"
                style={{ '--vol': `${volPercent}%` } as React.CSSProperties}
              />
              {/* 100% detent — marks the end of the normal range / start of boost */}
              <span className="np__vol-detent" aria-hidden />
            </div>
            <span className={`np__vol-value${isBoosted ? ' is-boosted' : ''}`}>
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
        {/* /RIGHT */}

        {/* Popover — Queue or Equalizer, anchored above the right zone */}
        {openPanel && (
          <div
            ref={popoverRef}
            className={`pb__popover pb__popover--${openPanel}`}
          >
            <div className="pb__popover-head">
              <span className="pb__popover-title">
                {openPanel === 'queue' ? 'Hàng chờ' : 'Equalizer & tốc độ'}
              </span>
              <button
                type="button"
                className="pb__popover-close"
                onClick={() => setOpenPanel(null)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>
            <div className="pb__popover-body">
              {openPanel === 'eq' && (
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
              {openPanel === 'queue' && (
                <div className="np__queue">
                  {currentTrack && (
                    <div className="np__queue-now" aria-current="true">
                      <span
                        className="np__queue-index np__queue-index--now"
                        aria-hidden
                      >
                        ♪
                      </span>
                      <Cover
                        src={currentTrack.cover}
                        alt={currentTrack.title}
                        subtitle={currentTrack.author}
                        className="np__queue-cover"
                      />
                      <span className="np__queue-meta">
                        <span className="np__queue-title">
                          {currentTrack.title}
                        </span>
                        <span className="np__queue-author">
                          {currentTrack.author}
                        </span>
                      </span>
                      <span
                        className={`eq-dots eq-dots--queue${isPlaying ? ' is-playing' : ''}`}
                        aria-hidden
                      >
                        <span />
                        <span />
                        <span />
                      </span>
                    </div>
                  )}
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
                              <span className="np__queue-title">
                                {track.title}
                              </span>
                              <span className="np__queue-author">
                                {track.author}
                              </span>
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
        )}
      </div>
    </>
  );
}
