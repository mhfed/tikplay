'use client';

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import type { Track } from '../lib/types';
import { useAppStore } from '../hooks/useAppStore';
import TrackRow from './TrackRow';

export default function TrackList() {
  const {
    tracks,
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
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((t) => t.id === active.id);
    const newIndex = tracks.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(tracks, oldIndex, newIndex);
    reorderTracks(reordered.map((t) => t.id));
  };

  if (tracks.length === 0) {
    return (
      <div className="empty">
        <span className="empty__icon">♪</span>
        <p className="empty__text">No tracks yet</p>
        <p className="empty__sub">Paste a TikTok URL to get started</p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={tracks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className="track-list">
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
