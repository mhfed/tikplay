'use client';

import { useEffect, useRef, useState } from 'react';
import type { RepeatMode, Track } from '../lib/types';
import Cover from './Cover';
import {
  NextIcon,
  PauseIcon,
  PlayIcon,
  PrevIcon,
  VolumeIcon,
  VolumeMuteIcon,
} from './icons';

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
 * Now-playing panel: a spinning vinyl disc (centre thumbnail, gradient ring)
 * that rotates only while audio is playing, plus transport + progress + volume.
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
  const lastVolume = useRef(volume || 0.8);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const toggleMute = () => {
    if (volume > 0) {
      lastVolume.current = volume;
      onVolumeChange(0);
    } else {
      onVolumeChange(lastVolume.current || 0.8);
    }
  };

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrack) return;
    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrack]);

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
    <section
      className={`np${currentTrack ? ' np--active' : ''}${isPlaying ? ' np--playing' : ''}`}
      aria-label="Trình phát nhạc"
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleTimeUpdate}
        onEnded={handleEnded}
        preload="metadata"
      />

      <div className="np__disc-wrap" aria-hidden>
        <div className="np__disc">
          <div className="np__grooves" />
          <Cover
            src={currentTrack?.cover}
            alt={currentTrack?.title ?? ''}
            subtitle={currentTrack?.author}
            className="np__art"
          />
          <div className="np__hole" />
        </div>
        <div className="np__glow" />
      </div>

      <div className="np__meta">
        {currentTrack ? (
          <>
            <span className="np__title" title={currentTrack.title}>
              {currentTrack.title}
            </span>
            <span className="np__author">{currentTrack.author}</span>
          </>
        ) : (
          <>
            <span className="np__title">Chưa có bài hát</span>
            <span className="np__author">Dán link TikTok để bắt đầu</span>
          </>
        )}
      </div>

      <div className="np__controls">
        <button
          className="btn btn--icon"
          onClick={onPrev}
          aria-label="Bài trước"
          disabled={!currentTrack}
        >
          <PrevIcon size={20} />
        </button>
        <button
          className="btn btn--play"
          onClick={onToggle}
          aria-label={isPlaying ? 'Tạm dừng' : 'Phát'}
        >
          {isPlaying ? <PauseIcon size={24} /> : <PlayIcon size={24} />}
        </button>
        <button
          className="btn btn--icon"
          onClick={onNext}
          aria-label="Bài tiếp"
          disabled={!currentTrack}
        >
          <NextIcon size={20} />
        </button>
      </div>

      <div className="np__progress">
        <span className="np__time">{formatTime(currentTime)}</span>
        <input
          type="range"
          className="np__seek"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          onChange={handleSeek}
          disabled={!currentTrack}
          aria-label="Tua"
        />
        <span className="np__time">{formatTime(duration)}</span>
      </div>

      <div className="np__volume">
        <button
          type="button"
          className="np__vol-btn"
          onClick={toggleMute}
          aria-label={volume > 0 ? 'Tắt tiếng' : 'Bật tiếng'}
          title={volume > 0 ? 'Tắt tiếng' : 'Bật tiếng'}
        >
          {volume > 0 ? <VolumeIcon size={18} /> : <VolumeMuteIcon size={18} />}
        </button>
        <input
          type="range"
          className="np__vol-range"
          min={0}
          max={1}
          step={0.01}
          value={volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          aria-label="Âm lượng"
        />
      </div>
    </section>
  );
}
