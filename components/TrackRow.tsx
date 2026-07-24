'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { MEDIA_SOURCE_LABELS, SOURCE_BADGE_COLORS } from '../lib/media/source';
import type { CSSProperties, HTMLAttributes, Ref } from 'react';
import { memo } from 'react';
import type { Track } from '../lib/types';
import Cover from './Cover';
import {
  CloseIcon,
  GripIcon,
  HeartIcon,
  PauseIcon,
  PlayIcon,
  SettingsIcon,
  SourceIcon,
} from './icons';

export interface TrackRowProps {
  track: Track;
  isActive: boolean;
  isPlaying: boolean;
  isFavorite: boolean;
  onPlay: (track: Track) => void;
  onFavorite: (trackId: number) => void;
  onRemove: (track: Track) => void;
  onActions: (track: Track) => void;
  dragHandleProps?: HTMLAttributes<HTMLSpanElement>;
  rowRef?: Ref<HTMLLIElement>;
  rowStyle?: CSSProperties;
  isDragging?: boolean;
}

function TrackRow({
  track,
  isActive,
  isPlaying,
  isFavorite,
  onPlay,
  onFavorite,
  onRemove,
  onActions,
  dragHandleProps,
  rowRef,
  rowStyle,
  isDragging = false,
}: TrackRowProps) {
  return (
    <li
      ref={rowRef}
      style={rowStyle}
      data-track-row
      className={`group flex items-center gap-2.5 rounded-control border border-transparent border-l-2 bg-transparent px-2.5 py-2 transition-[background,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:border-l-secondary hover:bg-surface max-[640px]:gap-3 max-[640px]:px-2 max-[640px]:py-3 [@media(hover:none)]:gap-2.5${isActive ? ' border-l-accent bg-accent-muted shadow-[inset_0_0_0_1px_var(--accent-glow)]' : ''}${isDragging ? ' z-10 bg-surface-2 shadow-app' : ''}`}
    >
      {dragHandleProps && (
        <span
          className="flex cursor-grab touch-none p-0.5 text-muted-2 opacity-0 transition-opacity duration-[var(--motion-fast)] ease-out-app group-hover:opacity-100 active:cursor-grabbing max-[640px]:hidden [@media(hover:none)]:px-1 [@media(hover:none)]:py-2.5 [@media(hover:none)]:opacity-60"
          {...dragHandleProps}
        >
          <GripIcon size={14} />
        </span>
      )}
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-pointer appearance-none items-center gap-2.5 border-0 bg-transparent p-0 text-left text-inherit"
        onClick={() => onPlay(track)}
        aria-label={`${isActive && isPlaying ? 'Tạm dừng' : 'Phát'} ${track.title}`}
      >
        <Cover
          src={track.cover}
          alt={track.title}
          subtitle={track.author}
          className="size-10 shrink-0 rounded-compact bg-surface-2 object-cover transition-transform duration-[var(--motion-base)] ease-out-app group-hover:scale-[1.06] max-[640px]:size-11"
        />
        <span className="min-w-0 max-w-full flex-1 cursor-pointer overflow-hidden border-0 bg-transparent p-0 text-left text-inherit">
          <span className="block max-w-full truncate text-sm font-semibold text-ink max-[640px]:text-[15px]">
            {track.title}
          </span>
          <span className="mt-px flex items-center gap-1.5">
            <span className="block max-w-full truncate text-xs text-muted">
              {track.author}
            </span>
            <span
              className="inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-[1px] text-[10px] font-medium leading-normal"
              style={{
                backgroundColor: SOURCE_BADGE_COLORS[track.source].bg,
                color: SOURCE_BADGE_COLORS[track.source].text,
              }}
            >
              <SourceIcon source={track.source} size={10} />
              {MEDIA_SOURCE_LABELS[track.source]}
            </span>
          </span>
        </span>
        {isActive && (
          <span className="shrink-0 text-xs text-accent">
            {isPlaying ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
          </span>
        )}
      </button>
      <button
        type="button"
        className="flex size-[30px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-muted-2 opacity-0 transition-[opacity,color,transform] duration-[var(--motion-fast)] group-hover:opacity-100 hover:scale-[1.08] hover:text-accent max-[640px]:opacity-100 [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-9"
        onClick={() => onActions(track)}
        aria-label="Tùy chọn bài hát"
        title="Tùy chọn"
      >
        <SettingsIcon size={16} />
      </button>
      <button
        type="button"
        className={`flex size-[30px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-muted-2 transition-[color,transform] duration-[var(--motion-fast)] ease-spring hover:scale-[1.08] hover:text-secondary [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-9 [@media(hover:none)]:px-2 [@media(hover:none)]:py-2.5${isFavorite ? ' text-secondary' : ''}`}
        onClick={() => onFavorite(track.id)}
        aria-label={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
        title={isFavorite ? 'Bỏ yêu thích' : 'Yêu thích'}
      >
        <HeartIcon size={17} filled={isFavorite} />
      </button>
      <button
        type="button"
        className="flex size-[30px] shrink-0 cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-muted-2 opacity-0 transition-[opacity,color,transform] duration-[var(--motion-fast)] ease-spring group-hover:opacity-100 hover:scale-[1.08] hover:text-danger max-[640px]:opacity-100 [@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-9 [@media(hover:none)]:px-2 [@media(hover:none)]:py-2.5 [@media(hover:none)]:opacity-100"
        onClick={() => onRemove(track)}
        aria-label="Xóa"
        title="Xóa"
      >
        <CloseIcon size={16} />
      </button>
    </li>
  );
}

export default memo(TrackRow);
