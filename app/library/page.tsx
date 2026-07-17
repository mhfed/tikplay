import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { AppStoreProvider, type InitialAppData } from '@/hooks/useAppStore';
import {
  getAllCategories,
  getAllPlaylists,
  getAllTracks,
  getAutoRules,
  getFavoriteIds,
} from '@/lib/db/queries';
import { type Track, toTrack } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tất cả bài hát',
  description: 'Danh sách toàn bộ nhạc đã tải về từ TikTok trên TikPlay.',
  openGraph: {
    title: 'Tất cả bài hát | TikPlay',
    description: 'Danh sách toàn bộ nhạc đã tải về từ TikTok trên TikPlay.',
  },
};

export default async function LibraryPage() {
  const favIds = getFavoriteIds();
  const tracks: Track[] = getAllTracks().map((r) => toTrack(r, favIds));

  const initialData: InitialAppData = {
    tracks,
    playlists: getAllPlaylists(),
    categories: getAllCategories(),
    favoriteIds: Array.from(favIds),
    autoRules: getAutoRules(),
    currentPlaylistId: 1,
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
