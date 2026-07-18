import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { AppStoreProvider, type InitialAppData } from '@/hooks/useAppStore';
import {
  getAllCategories,
  getAllPlaylists,
  getAllSources,
  getAllTracks,
  getAutoRules,
  getFavoriteIds,
  getFavoriteTracks,
} from '@/lib/db/queries';
import { type Track, toTrack } from '@/lib/types';
import { resolveSharedTrack } from '../shared';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Yêu thích',
  description: 'Những bài hát bạn đã yêu thích trên TikPlay.',
  openGraph: {
    title: 'Yêu thích | TikPlay',
    description: 'Những bài hát bạn đã yêu thích trên TikPlay.',
  },
};

export default async function FavoritesPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; t?: string }>;
}) {
  const sp = await searchParams;
  const favIds = getFavoriteIds();
  const tracks: Track[] = getFavoriteTracks().map((r) => toTrack(r, favIds));
  const allTracks: Track[] = getAllTracks().map((r) => toTrack(r, favIds));
  const sharedTrackId = Number(sp.track) || 0;
  const seekTime = Number(sp.t) || 0;
  const currentTrack = resolveSharedTrack(tracks, allTracks, sharedTrackId);

  const initialData: InitialAppData = {
    tracks,
    playlists: getAllPlaylists(),
    categories: getAllCategories(),
    sources: getAllSources(),
    favoriteIds: Array.from(favIds),
    autoRules: getAutoRules(),
    currentPlaylistId: -1,
    currentTrack,
    view: 'library',
    pendingSeek: currentTrack && seekTime > 0 ? seekTime : null,
  };

  return (
    <AppStoreProvider initialData={initialData}>
      <AppShell />
    </AppStoreProvider>
  );
}
