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
import { useAppStore } from '../hooks/useAppStore';
import TrackRow from './TrackRow';

export default function TrackList() {
  const {
    tracks,
    pendingDownloads,
    currentTrack,
    isPlaying,
    favorites,
    currentPlaylistId,
    playTrack,
    togglePlay,
    toggleFavorite,
    removeTrack,
    reorderTracks,
  } = useAppStore();

  const isDraggable = currentPlaylistId !== 1 && currentPlaylistId !== -1;

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

  if (tracks.length === 0 && pendingDownloads.length === 0) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-1.5 text-center text-muted">
        <span className="mb-1 text-3xl text-muted-2">♪</span>
        <p className="text-sm font-semibold text-ink-secondary">
          Chưa có bài hát
        </p>
        <p className="text-xs text-muted">Dán liên kết TikTok để bắt đầu</p>
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
          {pendingDownloads.map((url) => (
            <li
              key={url}
              className="flex pointer-events-none items-center gap-2.5 rounded-control border border-transparent border-l-2 bg-transparent px-2.5 py-2 opacity-60 max-[640px]:gap-3 max-[640px]:px-2 max-[640px]:py-3"
            >
              <div className="size-10 shrink-0 animate-pulse rounded-compact bg-white/10 max-[640px]:size-11" />
              <div className="min-w-0 flex-1 px-3">
                <p className="mb-1 truncate text-[15px] font-medium text-white">
                  Đang tải & xử lý...
                </p>
                <p className="truncate text-[13px] text-white/50">{url}</p>
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
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
