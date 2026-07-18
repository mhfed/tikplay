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
  getTrack,
} from '@/lib/db/queries';
import { type Track, toTrack } from '@/lib/types';

// Reads searchParams and the on-disk DB directly — must never be statically
// cached, or mutations (add/remove/favorite) would appear to silently fail.
export const dynamic = 'force-dynamic';

const DEFAULT_TITLE = 'TikPlay — Nghe nhạc từ TikTok';
const DEFAULT_DESCRIPTION =
  'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok. Tạo playlist, yêu thích bài hát, nghe offline.';
const DEFAULT_IMAGE = '/icons/icon-512.png';

function shareDescription(track: Pick<Track, 'title' | 'author'>): string {
  return `Nghe "${track.title}" của ${track.author} trên TikPlay — trình phát nhạc cá nhân từ TikTok.`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; pl?: string; t?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const sharedTrackId = Number(sp.track) || 0;
  if (!sharedTrackId) {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      openGraph: {
        title: DEFAULT_TITLE,
        description:
          'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok.',
      },
    };
  }

  const row = getTrack(sharedTrackId);
  if (!row) {
    return {
      title: 'Bài hát không tìm thấy',
      description: DEFAULT_DESCRIPTION,
      robots: { index: false, follow: true },
    };
  }

  const track = toTrack(row);
  const title = `${track.title} - ${track.author}`;
  const description = shareDescription(track);
  const image = track.cover || DEFAULT_IMAGE;
  const canonicalUrl = `/?track=${track.id}`;
  const shareParams = new URLSearchParams();
  if (sp.pl) shareParams.set('pl', sp.pl);
  shareParams.set('track', String(track.id));
  if (sp.t) shareParams.set('t', sp.t);
  const shareUrl = `/?${shareParams}`;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title: `${title} | TikPlay`,
      description,
      type: 'music.song',
      url: shareUrl,
      images: [
        {
          url: image,
          alt: `${track.title} - ${track.author}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | TikPlay`,
      description,
      images: [image],
    },
  };
}

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
