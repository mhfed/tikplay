import type { Track } from '@/lib/types';

export function resolveSharedTrack(
  tracks: Track[],
  allTracks: Track[],
  sharedTrackSlug: string,
): Track | null {
  if (!sharedTrackSlug) return null;

  return (
    tracks.find(
      (track) =>
        track.slug === sharedTrackSlug || String(track.id) === sharedTrackSlug,
    ) ??
    allTracks.find(
      (track) =>
        track.slug === sharedTrackSlug || String(track.id) === sharedTrackSlug,
    ) ??
    null
  );
}
