const MAX_PROTECTED_TRACK_IDS = 200;

/** Parse the client playback queue used to protect active tracks from eviction. */
export function parseProtectedTrackIds(value: unknown): number[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_PROTECTED_TRACK_IDS) {
    return null;
  }

  const ids = value.map((id) => (typeof id === 'number' ? id : Number(id)));
  if (ids.some((id) => !Number.isInteger(id) || id < 1)) return null;
  return [...new Set(ids)];
}
