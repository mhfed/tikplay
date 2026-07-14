import { getFavoriteIds as dbGetFavIds } from '@/lib/db/queries';
import type { DbTrack } from '@/lib/types';
import { toTrack as typeToTrack } from '@/lib/types';

export function getFavoriteIds(): Set<number> {
  return dbGetFavIds();
}

export function toTrack(row: DbTrack, favIds: Set<number>) {
  return typeToTrack(row, favIds);
}
