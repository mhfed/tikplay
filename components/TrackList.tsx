'use client';

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import type { Track } from '../lib/types';
import { CloseIcon, RefreshCwIcon, SpinnerIcon } from './icons';
import TrackActionsDialog from './TrackActionsDialog';
import TrackRow from './TrackRow';

export default function TrackList() {
  const {
    tracks,
    importJobs,
    currentTrack,
    isPlaying,
    favorites,
    currentPlaylistId,
    playTrack,
    togglePlay,
    toggleFavorite,
    removeTrack,
    reorderTracks,
    trackSort,
    retryImport,
    cancelImport,
    dismissImport,
  } = useAppStore();
  const [actionTrack, setActionTrack] = useState<Track | null>(null);

  const isDraggable = currentPlaylistId > 1 && trackSort === 'playlist';

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tracks, oldIndex, newIndex);
    reorderTracks(reordered.map((t) => t.id));
  };

  const showJobs = importJobs.length > 0;

  if (tracks.length === 0 && !showJobs) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-1.5 text-center text-muted">
        <span className="mb-1 text-3xl text-muted-2">♪</span>
        <p className="text-sm font-semibold text-ink-secondary">
          Chưa có bài hát
        </p>
        <p className="text-xs text-muted">
          Dán liên kết TikTok hoặc YouTube để bắt đầu
        </p>
      </div>
    );
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tracks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex list-none flex-col gap-0.5">
          {importJobs.map((job) => (
            <li
              key={job.id}
              className={`flex items-center gap-2.5 rounded-control border border-transparent border-l-2 bg-transparent px-2.5 py-2 transition-[background] max-[640px]:gap-3 max-[640px]:px-2 max-[640px]:py-3${job.status === 'processing' ? ' opacity-60' : ''}${job.status === 'failed' ? ' border-l-danger bg-danger-muted' : ''}`}
            >
              <div
                className={`flex size-10 shrink-0 items-center justify-center rounded-compact max-[640px]:size-11${job.status === 'processing' ? ' animate-pulse bg-white/10' : ''}${job.status === 'failed' ? ' bg-danger-muted' : ''}${job.status === 'cancelled' ? ' bg-surface-2' : ''}`}
              >
                {job.status === 'processing' && <SpinnerIcon size={18} />}
                {job.status === 'failed' && (
                  <span className="text-xs text-danger">!</span>
                )}
                {job.status === 'cancelled' && <CloseIcon size={14} />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="mb-0.5 truncate text-sm font-medium text-ink">
                  {job.status === 'processing' && 'Đang tải & xử lý...'}
                  {job.status === 'failed' && (job.error || 'Không thể tải')}
                  {job.status === 'cancelled' && 'Đã hủy'}
                </p>
                <p className="truncate text-xs text-muted">{job.url}</p>
                {job.error && job.status === 'failed' && (
                  <p className="mt-0.5 truncate text-xs text-danger">
                    {job.error}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                {job.status === 'failed' && (
                  <button
                    type="button"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted-2 hover:text-accent"
                    onClick={() => retryImport(job.id)}
                    aria-label="Thử lại"
                    title="Thử lại"
                  >
                    <RefreshCwIcon size={15} />
                  </button>
                )}
                {job.status === 'cancelled' && (
                  <button
                    type="button"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted-2 hover:text-danger"
                    onClick={() => dismissImport(job.id)}
                    aria-label="Xóa"
                    title="Xóa"
                  >
                    <CloseIcon size={14} />
                  </button>
                )}
                {job.status === 'processing' && (
                  <button
                    type="button"
                    className="flex size-8 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted-2 hover:text-danger"
                    onClick={() => cancelImport(job.id)}
                    aria-label="Hủy"
                    title="Hủy"
                  >
                    <CloseIcon size={14} />
                  </button>
                )}
              </div>
            </li>
          ))}
          {tracks.map((track) => (
            <TrackRow
              key={track.id}
              track={track}
              isActive={currentTrack?.id === track.id}
              isPlaying={currentTrack?.id === track.id && isPlaying}
              isFavorite={favorites.has(track.id)}
              isDraggable={isDraggable}
              onPlay={() =>
                currentTrack?.id === track.id ? togglePlay() : playTrack(track)
              }
              onFavorite={() => toggleFavorite(track.id)}
              onRemove={() => removeTrack(track.id)}
              onActions={() => setActionTrack(track)}
            />
          ))}
        </ul>
      </SortableContext>
      {actionTrack && (
        <TrackActionsDialog
          track={actionTrack}
          onClose={() => setActionTrack(null)}
        />
      )}
    </DndContext>
  );
}
