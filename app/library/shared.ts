import type { Track } from '@/lib/types';

export function resolveSharedTrack(
  tracks: Track[],
  allTracks: Track[],
  sharedTrackId: number,
): Track | null {
  if (!sharedTrackId) return null;

  return (
    tracks.find((track) => track.id === sharedTrackId) ??
    allTracks.find((track) => track.id === sharedTrackId) ??
    null
  );
}
