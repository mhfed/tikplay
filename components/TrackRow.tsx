'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Track } from '../lib/types';
import Cover from './Cover';
import { GripIcon, PauseIcon, PlayIcon } from './icons';

interface TrackRowProps {
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  isDraggable: boolean;
  onPlay: () => void;
  onFavorite: () => void;
  onRemove: () => void;
}

export default function TrackRow({
  track,
  isActive,
  isPlaying,
  isFavorite,
  isDraggable,
  onPlay,
  onFavorite,
  onRemove,
}: TrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: track.id, disabled: !isDraggable });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // The whole row is the play surface; nested controls (drag/fav/remove) stop
  // propagation so they don't also trigger playback.
  const stop =
    (fn?: () => void) => (e: React.MouseEvent | React.PointerEvent) => {
      e.stopPropagation();
      fn?.();
    };

  const handlePlayClick = () => {
    // If the track is not active, this first click activates it.
    // Ensure we trigger the global audio unlock correctly natively attached to this touch/click.
    // The hook in AppStore will also call `el.play()`.
    onPlay();
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`track-row${isActive ? ' track-row--active' : ''}${isDragging ? ' track-row--dragging' : ''}`}
      onClick={handlePlayClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          onPlay();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`Phát ${track.title}`}
    >
      {isDraggable && (
        <span
          className="track-row__drag"
          onClick={stop()}
          {...attributes}
          {...listeners}
        >
          <GripIcon size={14} />
        </span>
      )}
      <Cover
        src={track.cover}
        alt={track.title}
        subtitle={track.author}
        className="track-row__cover"
      />
      <div className="track-row__info">
        <span className="track-row__title">{track.title}</span>
        <span className="track-row__author">{track.author}</span>
      </div>
      {isActive && (
        <span className="track-row__badge">
          {isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
        </span>
      )}
      <button
        type="button"
        className={`track-row__fav${isFavorite ? ' is-fav' : ''}`}
        onClick={stop(onFavorite)}
        aria-label={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
        title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
      >
        {isFavorite ? '♥' : '♡'}
      </button>
      <button
        type="button"
        className="track-row__remove"
        onClick={stop(onRemove)}
        aria-label="Xóa"
        title="Xóa"
      >
        ×
      </button>
    </li>
  );
}
