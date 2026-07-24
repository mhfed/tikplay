'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useGlobalAudioEngine, usePlayback } from '../hooks/usePlayback';
import Cover from './Cover';
import Equalizer from './Equalizer';
import {
  CheckIcon,
  CloseIcon,
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
import SpectrumAnalyzer from './SpectrumAnalyzer';
import SpeedControl from './SpeedControl';
import TrackTrimmer from './TrackTrimmer';

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
const SHEET_CLOSE_MS = 320;

export default function PlayerPanel({
  mobileTab,
  onClosePlayer,
  onOpenPlayer,
}: PlayerPanelProps) {
  const {
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
    next,
    prev,
    setVolume,
    setSpeed,
    setEqGains,
    setShuffle,
    cycleRepeat,
  } = useAppStore();
  const { queue: playbackQueue, playTrack: playQueuedTrack } = usePlayback();
  const engine = useGlobalAudioEngine();

  const [shareCopied, setShareCopied] = useState(false);
  const [openPanel, setOpenPanel] = useState<PopoverPanel>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const upNext =
    currentIndex >= 0 ? playbackQueue.slice(currentIndex + 1) : playbackQueue;

  // ── Scrub-preview seeking ──────────────────────────────
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [previewTime, setPreviewTime] = useState(0);

  // ── Iconbtn activation pulse (one-shot, not infinite) ──
  const [pulseShuffle, setPulseShuffle] = useState(false);
  const [pulseRepeat, setPulseRepeat] = useState(false);

  // ── Mobile sheet drag / close ──────────────────────────
  const isMobileVisible = mobileTab === 'player';
  const isMobileObscured = mobileTab === 'playlists';
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const [closing, setClosing] = useState(false);
  const dragStartY = useRef(0);

  // Scroll-wheel volume: a native, non-passive listener (React's onWheel is
  // passive, so preventDefault there can't stop the page from scrolling).
  const volTrackRef = useRef<HTMLDivElement>(null);
  const volumeRef = useRef(volume);
  volumeRef.current = volume;

  const volGroupRef = useRef<HTMLDivElement>(null);

  // Restore the timestamp from a shared URL once the track's metadata is in.
  useEffect(() => {
    if (pendingSeek == null || !engine.isReady || !currentTrack) return;
    engine.seek(pendingSeek);
    clearPendingSeek();
  }, [pendingSeek, engine.isReady, currentTrack?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
          if (!currentTrack) {
            togglePlay();
            return;
          }
          if (isPlaying) {
            setPlaying(false);
            engine.pause();
          } else {
            setPlaying(true);
            engine.play();
          }
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
    isPlaying,
    currentTrack,
    setPlaying,
    next,
    prev,
    engine,
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
        await navigator.share({
          title: `${currentTrack.title} - ${currentTrack.author}`,
          text: `Nghe "${currentTrack.title}" của ${currentTrack.author} trên TikPlay.`,
          url,
        });
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

  const isBuffering =
    !!currentTrack &&
    isPlaying &&
    (engine.loadState === 'loading' || engine.loadState === 'stalled');
  const hasPlaybackError = engine.loadState === 'error';
  const playbackStatus = hasPlaybackError
    ? 'Không thể phát. Nhấn để thử lại'
    : engine.loadState === 'stalled'
      ? 'Đang chờ mạng'
      : isBuffering
        ? 'Đang tải'
        : isPlaying
          ? 'Tạm dừng'
          : 'Phát';

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

  const panelClass = `fixed inset-x-0 bottom-0 z-[45] flex h-[var(--player-bar-h)] items-center gap-3.5 border-t border-line-soft bg-[var(--glass-bg)] px-5 backdrop-blur-[20px] max-[1024px]:left-2 max-[1024px]:right-2 max-[1024px]:bottom-[calc(var(--bottom-stack)+8px)] max-[1024px]:h-[var(--player-bar-h-mobile)] max-[1024px]:gap-2.5 max-[1024px]:rounded-[18px] max-[1024px]:border max-[1024px]:bg-[rgba(16,16,18,0.94)] max-[1024px]:px-3 max-[1024px]:shadow-[inset_0_1px_0_rgba(255,255,255,0.08),0_14px_42px_rgba(0,0,0,0.3)] max-[1024px]:transition-[opacity,transform,visibility] max-[1024px]:duration-[var(--motion-base)] max-[1024px]:ease-out-app${isMobileVisible ? " player-sheet-open max-[1024px]:z-[32] max-[1024px]:h-auto max-[1024px]:max-h-[calc(100dvh-var(--bottom-stack)-24px)] max-[1024px]:flex-col max-[1024px]:justify-center max-[1024px]:gap-[22px] max-[1024px]:overflow-y-auto max-[1024px]:rounded-3xl max-[1024px]:px-6 max-[1024px]:pb-7 max-[1024px]:pt-[calc(28px+env(safe-area-inset-top))] max-[1024px]:before:min-h-0 max-[1024px]:before:flex-[1_1_0] max-[1024px]:before:content-[''] max-[1024px]:after:min-h-0 max-[1024px]:after:flex-[1_1_0] max-[1024px]:after:content-[''] max-[1024px]:[&>*]:shrink-0 max-[640px]:px-4 max-[640px]:pb-5 max-[640px]:pt-[calc(16px+env(safe-area-inset-top))]" : ''}${isMobileObscured ? ' max-[1024px]:invisible max-[1024px]:pointer-events-none max-[1024px]:translate-y-4 max-[1024px]:scale-[0.985] max-[1024px]:opacity-0' : ''}${!currentTrack && !isMobileVisible ? ' max-[1024px]:hidden' : ''}`;
  const iconButtonClass =
    'inline-flex size-9 cursor-pointer items-center justify-center rounded-full border border-line bg-surface-2 text-muted transition-[color,background,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:-translate-y-0.5 hover:border-accent hover:text-ink active:scale-[0.92] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent max-[1024px]:size-9';
  const activeIconButtonClass =
    ' border-accent bg-accent text-[#00201e] shadow-[0_0_12px_var(--accent-glow)]';
  const transportButtonClass =
    'inline-flex size-10 cursor-pointer items-center justify-center rounded-full border-0 bg-surface-2 text-ink transition-[background,transform,filter] duration-[var(--motion-fast)] ease-spring hover:-translate-y-0.5 hover:bg-surface-3 active:scale-[0.94] disabled:cursor-not-allowed disabled:opacity-[0.35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

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
      <button
        type="button"
        className={`fixed inset-x-0 top-0 bottom-[var(--bottom-stack)] z-30 hidden bg-black/[0.55] transition-[opacity,visibility] duration-[var(--motion-base)] ease-out-app max-[1024px]:block${isMobileVisible ? ' visible opacity-100' : ' invisible opacity-0'}`}
        onClick={requestClose}
        aria-label="Đóng trình phát"
      />
      <div className={panelClass} style={sheetStyle}>
        {/* Drag handle — the grip zone for swipe-to-dismiss (mobile) */}
        <div
          className={`${isMobileVisible ? 'max-[1024px]:flex' : 'hidden'} hidden h-[22px] w-full shrink-0 touch-none cursor-grab items-center justify-center -mt-1 before:h-1 before:w-10 before:rounded-full before:bg-line before:opacity-80 before:content-['']`}
          onPointerDown={onSheetPointerDown}
          onPointerMove={onSheetPointerMove}
          onPointerUp={onSheetPointerUp}
          onPointerCancel={onSheetPointerUp}
          aria-hidden
        />

        {/* Thin indeterminate line while the track buffers */}
        {isBuffering && (
          <div
            className="absolute inset-x-0 top-0 z-[5] h-0.5 overflow-hidden rounded-full bg-surface-3"
            role="status"
            aria-label={playbackStatus}
          >
            <span className="absolute inset-y-0 left-0 w-2/5 -translate-x-[110%] rounded-full bg-accent [animation:np-indeterminate_1.1s_cubic-bezier(0.45,0,0.55,1)_infinite]" />
          </div>
        )}

        {/* Compact-bar progress line — a thin fill along the top of the bar,
            visible only in the collapsed (mobile) state via CSS. */}
        <div
          className={`${isMobileVisible ? 'max-[1024px]:hidden' : 'max-[1024px]:block'} absolute inset-x-0 top-0 hidden h-0.5 bg-white/[0.08]`}
          aria-hidden
        >
          <span
            className="block size-full origin-left bg-accent"
            style={{ transform: `scaleX(${progressPercent / 100})` }}
          />
        </div>

        {/* LEFT — track identity. On mobile the whole zone expands the sheet. */}
        <button
          type="button"
          className={`flex min-w-0 flex-[1_1_0] items-center gap-3 border-0 bg-transparent p-0 text-left text-inherit${isMobileVisible ? ' max-[1024px]:flex-[0_0_auto] max-[1024px]:cursor-default max-[1024px]:flex-col max-[1024px]:gap-[18px] max-[1024px]:text-center' : ' max-[1024px]:cursor-pointer'}`}
          onClick={expandOnMobile}
          aria-label={currentTrack ? 'Mở trình phát' : undefined}
        >
          {currentTrack ? (
            <Cover
              key={`art-${currentTrack.id}`}
              src={currentTrack.cover}
              alt={currentTrack.title}
              subtitle={currentTrack.author}
              className={`shrink-0 rounded-[10px] object-cover shadow-[0_4px_14px_rgba(0,0,0,0.45)]${isMobileVisible ? ' max-[1024px]:size-[min(46vw,26dvh,220px)] max-[1024px]:rounded-[18px]' : ' size-14 max-[1024px]:size-11'}`}
            />
          ) : (
            <span
              className={`grid shrink-0 place-items-center rounded-[10px] bg-white/[0.04] text-[22px] text-muted shadow-[0_4px_14px_rgba(0,0,0,0.45)]${isMobileVisible ? ' max-[1024px]:size-[min(46vw,26dvh,220px)] max-[1024px]:rounded-[18px]' : ' size-14 max-[1024px]:size-11'}`}
              aria-hidden
            >
              ♪
            </span>
          )}
          <span
            className={`flex min-w-0 flex-col${isMobileVisible ? ' max-[1024px]:items-center max-[1024px]:text-center' : ''}`}
          >
            {currentTrack ? (
              <>
                <span
                  className={`truncate text-sm leading-[1.3] font-bold${isMobileVisible ? ' max-[1024px]:text-xl max-[1024px]:whitespace-normal' : ''}`}
                  title={currentTrack.title}
                >
                  {currentTrack.title}
                </span>
                <span
                  className={`mt-0.5 truncate text-xs text-muted${isMobileVisible ? ' max-[1024px]:text-sm' : ''}`}
                >
                  {currentTrack.author}
                </span>
              </>
            ) : (
              <>
                <span className="truncate text-sm leading-[1.3] font-bold">
                  Chưa phát bài nào
                </span>
                <span className="mt-0.5 truncate text-xs text-muted">
                  Dán URL TikTok hoặc YouTube để bắt đầu
                </span>
              </>
            )}
          </span>
        </button>
        {currentTrack && (
          <button
            type="button"
            className={`grid size-[34px] shrink-0 cursor-pointer place-items-center rounded-full border bg-transparent transition-[color,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:border-current hover:text-ink active:scale-[0.92]${isMobileVisible ? ' max-[1024px]:grid' : ' max-[1024px]:hidden'}${shareCopied ? ' border-accent text-accent' : ' border-line text-muted'}`}
            onClick={shareTrack}
            aria-label="Chia sẻ bài hát"
            title={shareCopied ? 'Đã copy link!' : 'Chia sẻ bài hát'}
          >
            {shareCopied ? <CheckIcon size={16} /> : <ShareIcon size={16} />}
          </button>
        )}

        {/* Spectrum analyzer — mobile sheet centerpiece (between the shrunk
            cover and the transport controls). Hidden on desktop via CSS. */}
        {currentTrack && (
          <SpectrumAnalyzer
            analyserRef={engine.analyserRef}
            isPlaying={isPlaying}
            className={`${isMobileVisible ? 'max-[1024px]:block' : ''} hidden h-[72px] w-[min(72vw,360px)] shrink-0 opacity-90 max-[1024px]:mx-auto`}
          />
        )}

        {/* CENTER — transport + progress */}
        <div
          className={`flex w-[min(46vw,560px)] flex-[0_1_auto] flex-col items-center gap-1.5${isMobileVisible ? ' max-[1024px]:w-full max-[1024px]:flex-[0_0_auto] max-[1024px]:gap-[18px]' : ' max-[1024px]:w-auto max-[1024px]:flex-[0_0_auto] max-[1024px]:flex-row max-[1024px]:gap-1.5'}`}
        >
          {/* Controls */}
          <div
            className={`flex items-center gap-[18px]${isMobileVisible ? ' max-[1024px]:gap-5' : ' max-[1024px]:gap-1.5'}`}
          >
            <button
              type="button"
              className={`${iconButtonClass}${shuffle ? activeIconButtonClass : ''}${pulseShuffle ? ' [animation:iconbtn-pulse_var(--motion-base)_var(--ease-spring)]' : ''}${isMobileVisible ? ' max-[1024px]:size-12' : ' max-[1024px]:hidden'}`}
              onClick={() => {
                setShuffle(!shuffle);
                setPulseShuffle(true);
              }}
              onAnimationEnd={() => setPulseShuffle(false)}
              aria-label="Phát ngẫu nhiên"
              title="Phát ngẫu nhiên (S)"
            >
              <ShuffleIcon size={16} />
            </button>
            <button
              type="button"
              className={`${transportButtonClass}${isMobileVisible ? ' max-[1024px]:size-[54px]' : ' max-[1024px]:hidden'}`}
              onClick={prev}
              disabled={!currentTrack}
              aria-label="Bài trước"
              title="Bài trước (Shift+←)"
            >
              <PrevIcon size={18} />
            </button>
            <button
              type="button"
              className={`inline-flex size-14 cursor-pointer items-center justify-center rounded-full border-0 bg-linear-to-br from-accent to-tertiary text-[#00201e] shadow-accent transition-[transform,filter] duration-[var(--motion-fast)] ease-spring hover:-translate-y-0.5 hover:brightness-110 active:scale-[0.94] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent${isMobileVisible ? ' max-[1024px]:size-[76px] max-[1024px]:[&_svg]:size-7' : ''}`}
              onClick={hasPlaybackError ? engine.retry : togglePlay}
              aria-label={playbackStatus}
              title={`${playbackStatus} (Space)`}
              aria-busy={isBuffering}
            >
              {isBuffering ? (
                <SpinnerIcon
                  className="[animation:np-spin-icon_0.8s_linear_infinite]"
                  size={22}
                />
              ) : (
                <span
                  className="inline-flex [animation:np-icon-morph_var(--motion-fast)_var(--ease-spring)]"
                  key={isPlaying ? 'pause' : 'play'}
                >
                  {isPlaying && !hasPlaybackError ? (
                    <PauseIcon size={22} />
                  ) : (
                    <PlayIcon size={22} />
                  )}
                </span>
              )}
            </button>
            <button
              type="button"
              className={`${transportButtonClass}${isMobileVisible ? ' max-[1024px]:size-[54px]' : ''}`}
              onClick={next}
              disabled={!currentTrack}
              aria-label="Bài tiếp theo"
              title="Bài tiếp theo (Shift+→)"
            >
              <NextIcon size={18} />
            </button>
            <button
              type="button"
              className={`${iconButtonClass}${repeat !== 'off' ? activeIconButtonClass : ''}${pulseRepeat ? ' [animation:iconbtn-pulse_var(--motion-base)_var(--ease-spring)]' : ''}${isMobileVisible ? ' max-[1024px]:size-12' : ' max-[1024px]:hidden'}`}
              onClick={() => {
                cycleRepeat();
                setPulseRepeat(true);
              }}
              onAnimationEnd={() => setPulseRepeat(false)}
              aria-label={
                repeat === 'one'
                  ? 'Lặp lại một bài'
                  : repeat === 'all'
                    ? 'Lặp lại tất cả'
                    : 'Tắt lặp lại'
              }
              title={`${repeat === 'one' ? 'Lặp lại một bài' : repeat === 'all' ? 'Lặp lại tất cả' : 'Tắt lặp lại'} (R)`}
            >
              {repeat === 'one' ? (
                <RepeatOneIcon size={16} />
              ) : (
                <RepeatIcon size={16} />
              )}
            </button>
          </div>

          {/* Progress */}
          <div
            className={`flex w-full items-center gap-2${isMobileVisible ? '' : ' max-[1024px]:hidden'}`}
          >
            <span className="min-w-[34px] text-center text-[11px] text-muted tabular-nums">
              {formatTime(engine.currentTime)}
            </span>
            <div className="relative flex flex-1 items-center">
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
                aria-label="Tua bài hát"
                style={
                  {
                    '--progress': `${displayedPercent}%`,
                    '--buffered': `${bufferedPercent}%`,
                  } as React.CSSProperties
                }
              />
              {isScrubbing && (
                <div
                  className="pointer-events-none absolute bottom-[calc(100%+8px)] -translate-x-1/2 whitespace-nowrap rounded-full border border-accent-muted bg-[var(--scrub-tip-bg)] px-2 py-[3px] text-[11px] text-ink tabular-nums shadow-app-sm [animation:np-tip-in_var(--motion-fast)_var(--ease-out)]"
                  style={{ left: `${displayedPercent}%` }}
                >
                  {formatTime(previewTime)}
                </div>
              )}
            </div>
            <span className="min-w-[34px] text-center text-[11px] text-muted tabular-nums">
              {formatTime(engine.duration)}
            </span>
          </div>
        </div>
        {/* /CENTER */}

        {/* RIGHT — queue / equalizer / volume */}
        <div
          className={`flex flex-[1_1_0] items-center justify-end gap-2${isMobileVisible ? ' max-[1024px]:w-full max-[1024px]:flex-[0_0_auto] max-[1024px]:justify-center max-[1024px]:gap-4' : ' max-[1024px]:hidden'}`}
        >
          {/* Spectrum analyzer — compact desktop strip. Hidden on mobile. */}
          {currentTrack && (
            <SpectrumAnalyzer
              analyserRef={engine.analyserRef}
              isPlaying={isPlaying}
              barCount={24}
              className="mr-0.5 block h-10 w-[132px] shrink-0 opacity-90 max-[1024px]:hidden"
            />
          )}
          <button
            type="button"
            className={`${iconButtonClass}${openPanel === 'queue' ? activeIconButtonClass : ''}${isMobileVisible ? ' max-[1024px]:size-12' : ''}`}
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
            className={`${iconButtonClass}${openPanel === 'eq' ? activeIconButtonClass : ''}${isMobileVisible ? ' max-[1024px]:size-12' : ''}`}
            onClick={() => setOpenPanel((p) => (p === 'eq' ? null : 'eq'))}
            aria-label="Bộ cân bằng"
            title="Bộ cân bằng"
          >
            <SlidersIcon size={18} />
          </button>

          {/* Volume */}
          <div
            ref={volGroupRef}
            className={`np__volume flex w-auto items-center gap-0${isBoosted ? ' is-boosted' : ''}`}
          >
            <button
              type="button"
              className="inline-flex shrink-0 cursor-pointer items-center rounded-full border-0 bg-transparent p-1.5 text-muted transition-[color,background,transform] duration-[var(--motion-fast)] ease-spring hover:bg-surface-3 hover:text-ink active:scale-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={() => engine.toggleMute(volume, setVolume)}
              aria-label={isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'}
              title={`${isMuted ? 'Bật âm thanh' : 'Tắt âm thanh'} (M)`}
            >
              {isMuted ? (
                <VolumeMuteIcon size={16} />
              ) : volume <= 0.5 ? (
                <VolumeLowIcon size={16} />
              ) : (
                <VolumeIcon size={16} />
              )}
            </button>
            <div
              className="np__vol-track relative ml-2 flex w-[100px] flex-1 items-center opacity-100"
              ref={volTrackRef}
            >
              <input
                type="range"
                className="np__vol-range"
                min={0}
                max={3}
                step={0.05}
                value={volume}
                onChange={(e) => setVolume(Number(e.target.value))}
                onDoubleClick={() => setVolume(1)}
                aria-label="Âm lượng"
                aria-valuetext={`${Math.round(volume * 100)}%`}
                title="Nhấp đúp về 100% · cuộn để điều chỉnh"
                style={{ '--vol': `${volPercent}%` } as React.CSSProperties}
              />
              {/* 100% detent — marks the end of the normal range / start of boost */}
              <span
                className="np__vol-detent pointer-events-none absolute top-1/2 left-1/3 h-2.5 w-0.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-muted-2 opacity-70 transition-[background,opacity] duration-[var(--motion-fast)] ease-out-app"
                aria-hidden
              />
            </div>
            <span
              className={`ml-2 w-8 shrink-0 overflow-hidden text-right text-[11px] whitespace-nowrap tabular-nums${isBoosted ? ' text-tertiary-light' : ' text-muted'}`}
            >
              {Math.round(volume * 100)}%
            </span>
          </div>
        </div>
        {/* /RIGHT */}

        {/* Popover — Queue or Equalizer, anchored above the right zone */}
        {openPanel && (
          <div
            ref={popoverRef}
            className={`absolute right-4 bottom-[calc(100%+10px)] z-50 flex max-h-[min(60vh,460px)] flex-col overflow-hidden rounded-panel border border-line-soft bg-[rgba(18,18,22,0.97)] shadow-app backdrop-blur-[20px] [animation:pb-pop_var(--motion-base)_var(--ease-out)] max-[1024px]:fixed max-[1024px]:inset-x-0 max-[1024px]:bottom-[var(--bottom-stack)] max-[1024px]:w-full max-[1024px]:max-w-full max-[1024px]:max-h-[72vh] max-[1024px]:rounded-b-none${openPanel === 'eq' ? ' w-[min(420px,calc(100vw-32px))]' : ' w-[min(360px,calc(100vw-32px))]'}`}
          >
            <div className="flex items-center justify-between border-b border-line-soft px-3.5 py-3">
              <span className="font-display text-sm font-bold">
                {openPanel === 'queue' ? 'Hàng chờ' : 'Bộ cân bằng & tốc độ'}
              </span>
              <button
                type="button"
                className="grid size-7 cursor-pointer place-items-center rounded-full border-0 bg-transparent text-[13px] text-muted transition-[color,background,transform] duration-[var(--motion-fast)] ease-spring hover:bg-white/[0.06] hover:text-ink active:scale-90"
                onClick={() => setOpenPanel(null)}
                aria-label="Đóng"
              >
                <CloseIcon size={15} />
              </button>
            </div>
            <div className="overflow-y-auto px-3.5 py-3">
              {openPanel === 'eq' && (
                <>
                  <TrackTrimmer />
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
                <div className="max-h-[260px] w-full overflow-y-auto">
                  {currentTrack && (
                    <div
                      className="mb-2 flex items-center gap-2.5 rounded-control border border-accent-glow bg-accent-muted p-2 shadow-[inset_0_0_0_1px_var(--accent-glow)]"
                      aria-current="true"
                    >
                      <span
                        className="w-[18px] shrink-0 text-center font-mono text-base text-accent"
                        aria-hidden
                      >
                        ♪
                      </span>
                      <Cover
                        src={currentTrack.cover}
                        alt={currentTrack.title}
                        subtitle={currentTrack.author}
                        className="size-9 shrink-0 rounded-compact"
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className="truncate text-[13px] font-semibold">
                          {currentTrack.title}
                        </span>
                        <span className="truncate font-mono text-[10px] text-muted">
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
                    <p className="px-2 py-5 text-center text-xs text-muted">
                      {shuffle
                        ? 'Bài tiếp theo sẽ được chọn ngẫu nhiên.'
                        : 'Đã hết danh sách phát.'}
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {upNext.map((track, i) => (
                        <li key={track.id}>
                          <button
                            type="button"
                            className="flex w-full cursor-pointer items-center gap-2.5 rounded-compact border-0 bg-transparent px-2 py-1.5 text-left transition-[background,transform] duration-[var(--motion-fast)] ease-spring hover:translate-x-0.5 hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                            onClick={() =>
                              playQueuedTrack(track, playbackQueue)
                            }
                          >
                            <span className="w-[18px] shrink-0 text-center font-mono text-[11px] text-muted-2">
                              {i + 1}
                            </span>
                            <Cover
                              src={track.cover}
                              alt={track.title}
                              subtitle={track.author}
                              className="size-9 shrink-0 rounded-compact"
                            />
                            <span className="flex min-w-0 flex-col gap-px">
                              <span className="truncate text-[13px] font-semibold">
                                {track.title}
                              </span>
                              <span className="truncate font-mono text-[10px] text-muted">
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
