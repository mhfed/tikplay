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
} from '@/lib/db/queries';
import { type Track, toTrack } from '@/lib/types';
import { resolveSharedTrack } from './shared';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Tất cả bài hát',
  description:
    'Danh sách toàn bộ nhạc đã tải về từ TikTok hoặc YouTube trên TikPlay.',
  openGraph: {
    title: 'Tất cả bài hát | TikPlay',
    description:
      'Danh sách toàn bộ nhạc đã tải về từ TikTok hoặc YouTube trên TikPlay.',
  },
};

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; t?: string }>;
}) {
  const sp = await searchParams;
  const favIds = getFavoriteIds();
  const tracks: Track[] = getAllTracks().map((r) => toTrack(r, favIds));
  const sharedTrackId = Number(sp.track) || 0;
  const seekTime = Number(sp.t) || 0;
  const currentTrack = resolveSharedTrack(tracks, tracks, sharedTrackId);

  const initialData: InitialAppData = {
    tracks,
    playlists: getAllPlaylists(),
    categories: getAllCategories(),
    sources: getAllSources(),
    favoriteIds: Array.from(favIds),
    autoRules: getAutoRules(),
    currentPlaylistId: 1,
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
