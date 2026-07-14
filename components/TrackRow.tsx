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

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`track-row${isActive ? ' track-row--active' : ''}${isDragging ? ' track-row--dragging' : ''}`}
    >
      {isDraggable && (
        <span className="track-row__drag" {...attributes} {...listeners}>
          <GripIcon size={14} />
        </span>
      )}
      <Cover
        src={track.cover}
        alt={track.title}
        subtitle={track.author}
        className="track-row__cover"
      />
      <button className="track-row__info" onClick={onPlay}>
        <span className="track-row__title">{track.title}</span>
        <span className="track-row__author">{track.author}</span>
      </button>
      {isActive && (
        <span className="track-row__badge">
          {isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
        </span>
      )}
      <button
        className={`track-row__fav${isFavorite ? ' is-fav' : ''}`}
        onClick={onFavorite}
        aria-label={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
        title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
      >
        {isFavorite ? '♥' : '♡'}
      </button>
      <button
        className="track-row__remove"
        onClick={onRemove}
        aria-label="Xóa"
        title="Xóa"
      >
        ×
      </button>
    </li>
  );
}
