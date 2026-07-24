import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
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

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ t?: string }>;
}

const DEFAULT_IMAGE = '/icons/icon-512.png';
const SITE_NAME = 'TikPlay';

function shareDescription(track: { title: string; author: string }): string {
  return `Nghe "${track.title}" của ${track.author} trên TikPlay — trình phát nhạc cá nhân từ TikTok hoặc YouTube.`;
}

export async function generateMetadata({
  params,
  searchParams,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const sp = await searchParams;
  const numId = Number(slug) || 0;
  const row = getTrackBySlug(slug) ?? (numId ? getTrack(numId) : undefined);

  if (!row) {
    return { title: 'Bài hát không tìm thấy' };
  }

  const track = toTrack(row);
  const title = `${track.title} - ${track.author}`;
  const description = shareDescription(track);
  const image = track.cover || DEFAULT_IMAGE;

  return {
    title,
    description,
    alternates: { canonical: `/track/${track.slug}` },
    openGraph: {
      title: `${title} | ${SITE_NAME}`,
      description,
      type: 'music.song',
      url: `/track/${track.slug}`,
      siteName: SITE_NAME,
      locale: 'vi_VN',
      images: [
        {
          url: image,
          width: 512,
          height: 512,
          alt: `${track.title} - ${track.author}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${title} | ${SITE_NAME}`,
      description,
      images: [image],
    },
  };
}

export default async function TrackPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const sp = await searchParams;
  const numId = Number(slug) || 0;
  const seekTime = Number(sp.t) || 0;

  const favIds = getFavoriteIds();
  const row = getTrackBySlug(slug) ?? (numId ? getTrack(numId) : undefined);
  if (!row) notFound();

  const page = getTrackPage({
    scope: { type: 'library' },
    sort: 'added_desc',
  });
  const tracks = page.tracks.map((r) => toTrack(r, favIds));
  const currentTrack: Track | null = toTrack(row, favIds);

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
    pendingSeek: seekTime > 0 ? seekTime : null,
  };

  return (
    <AppStoreProvider initialData={initialData}>
      <AppShell />
    </AppStoreProvider>
  );
}
