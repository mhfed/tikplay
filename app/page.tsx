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
import { type Track, toTrack } from '@/lib/types';

// Reads searchParams and the on-disk DB directly — must never be statically
// cached, or mutations (add/remove/favorite) would appear to silently fail.
export const dynamic = 'force-dynamic';

const DEFAULT_TITLE = 'TikPlay — Nghe nhạc từ TikTok & YouTube';
const DEFAULT_DESCRIPTION =
  'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok hoặc YouTube. Tạo playlist, yêu thích bài hát, nghe offline.';
const DEFAULT_IMAGE = '/icons/icon-512.png';

function shareDescription(track: Pick<Track, 'title' | 'author'>): string {
  return `Nghe "${track.title}" của ${track.author} trên TikPlay — trình phát nhạc cá nhân từ TikTok hoặc YouTube.`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; pl?: string; t?: string }>;
}): Promise<Metadata> {
  const sp = await searchParams;
  const trackSlug = sp.track?.trim() || '';
  const sharedTrackId = Number(sp.track) || 0;
  const row = trackSlug
    ? (getTrackBySlug(trackSlug) ?? getTrack(sharedTrackId))
    : undefined;
  if (!row) {
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESCRIPTION,
      openGraph: {
        title: DEFAULT_TITLE,
        description:
          'Trình phát nhạc cá nhân — trích xuất và nghe audio từ TikTok hoặc YouTube.',
      },
    };
  }

  const track = toTrack(row);
  const title = `${track.title} - ${track.author}`;
  const description = shareDescription(track);
  const image = track.cover || DEFAULT_IMAGE;
  const canonicalUrl = `/track/${track.slug}`;
  const shareUrl = `/track/${track.slug}${sp.t ? `?t=${sp.t}` : ''}`;

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

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ pl?: string; track?: string; t?: string }>;
}) {
  const sp = await searchParams;
  const pl = Number(sp.pl) || 1;
  const trackSlug = sp.track?.trim() || '';
  const sharedTrackId = Number(sp.track) || 0;
  const seekTime = Number(sp.t) || 0;

  const favIds = getFavoriteIds();
  const scope =
    pl === 1
      ? ({ type: 'library' } as const)
      : pl === -1
        ? ({ type: 'favorites' } as const)
        : ({ type: 'playlist', playlistId: pl } as const);
  const page = getTrackPage({
    scope,
    sort: pl > 1 ? 'playlist' : 'added_desc',
  });
  const tracks = page.tracks.map((row) => toTrack(row, favIds));
  const sharedRow = trackSlug
    ? (getTrackBySlug(trackSlug) ?? getTrack(sharedTrackId))
    : undefined;
  const currentTrack: Track | null = sharedRow
    ? toTrack(sharedRow, favIds)
    : null;

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
