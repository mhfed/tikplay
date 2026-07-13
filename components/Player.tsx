'use client';

import { useEffect, useRef, useState } from 'react';
import type { Track, RepeatMode } from '../lib/types';

interface PlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  repeat: RepeatMode;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onProgress: (currentTime: number, duration: number) => void;
  onEnded: () => void;
  volume: number;
  onVolumeChange: (v: number) => void;
}

function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * Single global <audio> element + transport controls. The parent owns playback
 * state (currentTrack / isPlaying); this component bridges it to the DOM audio
 * element and surfaces progress/ended events.
 */
export default function Player({
  currentTrack,
  isPlaying,
  repeat,
  onToggle,
  onNext,
  onPrev,
  onProgress,
  onEnded,
  volume,
  onVolumeChange,
}: PlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastUrl = useRef<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Load a new source whenever the track's audio URL changes.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (lastUrl.current !== currentTrack.audioUrl) {
      lastUrl.current = currentTrack.audioUrl;
      audio.src = currentTrack.audioUrl;
      setCurrentTime(0);
      setDuration(0);
    }
  }, [currentTrack]);

  // Play / pause in response to the parent's isPlaying flag.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.play().catch(() => {
        // Autoplay can be blocked until a user gesture; ignore.
      });
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

  // Keep the audio element's volume in sync.
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = volume;
  }, [volume]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    setCurrentTime(audio.currentTime);
    setDuration(audio.duration || 0);
    onProgress(audio.currentTime, audio.duration || 0);
  };

  // Repeat-one is handled locally so the audio truly restarts; otherwise defer
  // to the parent to decide what plays next.
  const handleEnded = () => {
    if (repeat === 'one' && currentTrack) {
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => {});
      }
      return;
    }
    onEnded();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const t = Number(e.target.value);
    audio.currentTime = t;
    setCurrentTime(t);
  };

  return (
    <section className={`player${currentTrack ? ' player--active' : ''}`} aria-label="Player">
      {/* The single shared audio element for the whole app. */}
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="player__info">
        {currentTrack ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="player__cover" src={currentTrack.cover} alt="" />
            <div className="player__meta">
              <span className="player__title" title={currentTrack.title}>
                {currentTrack.title}
              </span>
              <span className="player__author">{currentTrack.author}</span>
            </div>
          </>
        ) : (
          <div className="player__meta player__meta--empty">
            <span className="player__title">Nothing playing</span>
            <span className="player__author">Add a TikTok URL to start</span>
          </div>
        )}
      </div>

      <div className="player__center">
        <div className="player__controls">
          <button className="btn btn--icon" onClick={onPrev} aria-label="Previous" disabled={!currentTrack}>
            ⏮
          </button>
          <button className="btn btn--play" onClick={onToggle} aria-label={isPlaying ? 'Pause' : 'Play'}>
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button className="btn btn--icon" onClick={onNext} aria-label="Next" disabled={!currentTrack}>
            ⏭
          </button>
        </div>

        <div className="player__progress">
          <span className="player__time">{formatTime(currentTime)}</span>
          <input
            type="range"
            className="player__seek"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            disabled={!currentTrack}
            aria-label="Seek"
          />
          <span className="player__time">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="player__volume">
        <span className="player__vol-icon" aria-hidden>🔊</span>
        <input
          type="range"
          className="player__vol-range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Volume"
        />
      </div>
    </section>
  );
}
