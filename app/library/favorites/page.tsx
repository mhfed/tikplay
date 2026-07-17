import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { AppStoreProvider, type InitialAppData } from '@/hooks/useAppStore';
import {
  getAllCategories,
  getAllPlaylists,
  getAutoRules,
  getFavoriteIds,
  getFavoriteTracks,
} from '@/lib/db/queries';
import { type Track, toTrack } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Yêu thích',
  description: 'Những bài hát bạn đã yêu thích trên TikPlay.',
  openGraph: {
    title: 'Yêu thích | TikPlay',
    description: 'Những bài hát bạn đã yêu thích trên TikPlay.',
  },
};

export default async function FavoritesPage() {
  const favIds = getFavoriteIds();
  const tracks: Track[] = getFavoriteTracks().map((r) => toTrack(r, favIds));

  const initialData: InitialAppData = {
    tracks,
    playlists: getAllPlaylists(),
    categories: getAllCategories(),
    favoriteIds: Array.from(favIds),
    autoRules: getAutoRules(),
    currentPlaylistId: -1,
    currentTrack: null,
    view: 'library',
    pendingSeek: null,
  };

  return (
    <AppStoreProvider initialData={initialData}>
      <AppShell />
    </AppStoreProvider>
  );
}
