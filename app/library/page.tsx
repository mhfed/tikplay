import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { AppStoreProvider, type InitialAppData } from '@/hooks/useAppStore';
import {
  getAllCategories,
  getAllPlaylists,
  getAllSources,
  getAutoRules,
  getFavoriteIds,
  getTrack,
  getTrackBySlug,
  getTrackPage,
} from '@/lib/db/queries';
import { toTrack } from '@/lib/types';

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
  const page = getTrackPage({
    scope: { type: 'library' },
    sort: 'added_desc',
  });
  const tracks = page.tracks.map((r) => toTrack(r, favIds));
  const trackSlug = sp.track?.trim() || '';
  const sharedTrackId = Number(sp.track) || 0;
  const seekTime = Number(sp.t) || 0;
  const sharedRow = trackSlug
    ? (getTrackBySlug(trackSlug) ?? getTrack(sharedTrackId))
    : undefined;
  const currentTrack = sharedRow ? toTrack(sharedRow, favIds) : null;

  const initialData: InitialAppData = {
    tracks,
    trackPage: {
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total,
    },
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
