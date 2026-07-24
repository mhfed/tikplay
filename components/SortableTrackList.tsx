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
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Track } from '../lib/types';
import TrackRow, { type TrackRowProps } from './TrackRow';

interface SortableTrackListProps {
  tracks: Track[];
  currentTrackId?: number;
  isPlaying: boolean;
  favorites: Set<number>;
  onPlay: TrackRowProps['onPlay'];
  onFavorite: TrackRowProps['onFavorite'];
  onRemove: TrackRowProps['onRemove'];
  onActions: TrackRowProps['onActions'];
  onReorder: (trackIds: number[]) => void;
}

function SortableTrackRow(props: TrackRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.track.id });

  return (
    <TrackRow
      {...props}
      rowRef={setNodeRef}
      rowStyle={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      isDragging={isDragging}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

export default function SortableTrackList({
  tracks,
  currentTrackId,
  isPlaying,
  favorites,
  onPlay,
  onFavorite,
  onRemove,
  onActions,
  onReorder,
}: SortableTrackListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = tracks.findIndex((track) => track.id === active.id);
    const newIndex = tracks.findIndex((track) => track.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    onReorder(arrayMove(tracks, oldIndex, newIndex).map((track) => track.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext
        items={tracks.map((track) => track.id)}
        strategy={verticalListSortingStrategy}
      >
        <ul className="flex list-none flex-col gap-0.5">
          {tracks.map((track) => (
            <SortableTrackRow
              key={track.id}
              track={track}
              isActive={currentTrackId === track.id}
              isPlaying={currentTrackId === track.id && isPlaying}
              isFavorite={favorites.has(track.id)}
              onPlay={onPlay}
              onFavorite={onFavorite}
              onRemove={onRemove}
              onActions={onActions}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
