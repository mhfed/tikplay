'use client';

import { useAppStore } from '../hooks/useAppStore';
import Cover from './Cover';
import { NextIcon, PauseIcon, PlayIcon } from './icons';

interface MiniPlayerProps {
  mobileTab?: string;
  onOpenPlayer?: () => void;
}

export default function MiniPlayer({
  mobileTab,
  onOpenPlayer,
}: MiniPlayerProps) {
  const { currentTrack, isPlaying, togglePlay, next } = useAppStore();

  if (!currentTrack) return null;

  const showOnMobile = mobileTab !== 'player';
  const className = `mini-player${showOnMobile ? ' is-visible' : ''}`;

  return (
    <div className={className} onClick={onOpenPlayer}>
      <div className="mini-player__progress" aria-hidden>
        <div className="mini-player__progress-fill" />
      </div>
      <Cover
        src={currentTrack.cover}
        alt={currentTrack.title}
        subtitle={currentTrack.author}
        className="mini-player__cover"
      />
      <div className="mini-player__info">
        <div className="mini-player__title">{currentTrack.title}</div>
        <div className="mini-player__author">{currentTrack.author}</div>
      </div>
      <div
        className="mini-player__controls"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="mini-player__btn mini-player__btn--play"
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
        </button>
        <button className="mini-player__btn" onClick={next} aria-label="Next">
          <NextIcon size={16} />
        </button>
      </div>
    </div>
  );
}
