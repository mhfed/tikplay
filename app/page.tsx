import type { Metadata } from 'next';
import AppShell from '@/components/AppShell';
import { AppStoreProvider, type InitialAppData } from '@/hooks/useAppStore';
import {
  getAllCategories,
  getAllPlaylists,
  getAllTracks,
  getAutoRules,
  getFavoriteIds,
  getFavoriteTracks,
  getPlaylistTracks,
} from '@/lib/db/queries';
import { type Track, toTrack } from '@/lib/types';

// Reads searchParams and the on-disk DB directly — must never be statically
// cached, or mutations (add/remove/favorite) would appear to silently fail.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'TikPlay — Nghe nhạc từ TikTok',
  description:
    'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok. Tạo playlist, yêu thích bài hát, nghe offline.',
  openGraph: {
    title: 'TikPlay — Nghe nhạc từ TikTok',
    description:
      'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok.',
  },
};

function tracksForPlaylist(playlistId: number, favIds: Set<number>): Track[] {
  const rows =
    playlistId === 1
      ? getAllTracks()
      : playlistId === -1
        ? getFavoriteTracks()
        : getPlaylistTracks(playlistId);
  return rows.map((r) => toTrack(r, favIds));
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pl?: string; track?: string; t?: string }>;
}) {
  const sp = await searchParams;
  const pl = Number(sp.pl) || 1;
  const sharedTrackId = Number(sp.track) || 0;
  const seekTime = Number(sp.t) || 0;

  const favIds = getFavoriteIds();
  const tracks = tracksForPlaylist(pl, favIds);

  let currentTrack: Track | null = null;
  if (sharedTrackId) {
    currentTrack = tracks.find((t) => t.id === sharedTrackId) ?? null;
    if (!currentTrack && pl !== 1) {
      // Fall back to the full library in case the track left the playlist.
      currentTrack =
        getAllTracks()
          .map((r) => toTrack(r, favIds))
          .find((t) => t.id === sharedTrackId) ?? null;
    }
  }

  const initialData: InitialAppData = {
    tracks,
    playlists: getAllPlaylists(),
    categories: getAllCategories(),
    favoriteIds: Array.from(favIds),
    autoRules: getAutoRules(),
    currentPlaylistId: pl,
    currentTrack,
    // A shared link always means "go straight to the track/playlist", not the dashboard.
    view: sp.pl || sp.track ? 'library' : 'home',
    pendingSeek: currentTrack && seekTime > 0 ? seekTime : null,
  };

  return (
    <AppStoreProvider initialData={initialData}>
      <AppShell />
    </AppStoreProvider>
  );
}
