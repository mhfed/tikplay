'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useAudioEngine } from '../hooks/useAudioEngine';
import Cover from './Cover';
import Equalizer from './Equalizer';
import SpeedControl from './SpeedControl';
import {
  PlayIcon,
  PauseIcon,
  PrevIcon,
  NextIcon,
  VolumeIcon,
  VolumeMuteIcon,
  ShuffleIcon,
  RepeatIcon,
  RepeatOneIcon,
  ShareIcon,
  CheckIcon,
} from './icons';

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
    currentTrack,
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

  // Media Session API
  useEffect(() => {
    if (!('mediaSession' in navigator) || !currentTrack) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: currentTrack.title,
      artist: currentTrack.author,
    });
    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => togglePlay());
    navigator.mediaSession.setActionHandler('previoustrack', () => prev());
    navigator.mediaSession.setActionHandler('nexttrack', () => next());
  }, [currentTrack, togglePlay, prev, next]);

  const shareTrack = async () => {
    if (!currentTrack) return;
    const params = new URLSearchParams();
    if (currentPlaylistId !== 1) params.set('pl', String(currentPlaylistId));
    params.set('track', String(currentTrack.id));
    if (engine.currentTime > 1) params.set('t', String(Math.floor(engine.currentTime)));
    const url = `${window.location.origin}${window.location.pathname}?${params}`;
    if (navigator.share) {
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

  const panelClass = `player-panel${mobileTab === 'player' ? ' mobile-visible' : ''}`;

  return (
    <div className={panelClass}>
      {/* Vinyl picture disc — cover art fills the whole disc */}
      <div className={`np__disc-wrap${isPlaying ? ' np--playing' : ''}`}>
        <div className="np__disc">
          <Cover
            src={currentTrack?.cover}
            alt={currentTrack?.title ?? ''}
            subtitle={currentTrack?.author}
            className="np__art"
          />
          <div className="np__grooves" aria-hidden />
          <div className="np__hole" aria-hidden />
        </div>
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
          title="Shuffle"
        >
          <ShuffleIcon size={16} />
        </button>
        <button className="btn btn--icon" onClick={prev} disabled={!currentTrack} aria-label="Previous">
          <PrevIcon size={18} />
        </button>
        <button className="btn btn--play" onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon size={22} /> : <PlayIcon size={22} />}
        </button>
        <button className="btn btn--icon" onClick={next} disabled={!currentTrack} aria-label="Next">
          <NextIcon size={18} />
        </button>
        <button
          className={`iconbtn${repeat !== 'off' ? ' iconbtn--on' : ''}`}
          onClick={cycleRepeat}
          aria-label={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
          title={repeat === 'one' ? 'Repeat one' : repeat === 'all' ? 'Repeat all' : 'Repeat off'}
        >
          {repeat === 'one' ? <RepeatOneIcon size={16} /> : <RepeatIcon size={16} />}
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

      {/* Speed */}
      <SpeedControl speed={speed} onChange={setSpeed} />

      {/* Equalizer */}
      <Equalizer
        gains={eqGains}
        onGainChange={(i, v) => {
          const next = [...eqGains];
          next[i] = v;
          setEqGains(next);
        }}
        onPreset={setEqGains}
      />
    </div>
  );
}
