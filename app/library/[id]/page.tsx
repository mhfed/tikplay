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
  getTrackPage,
} from '@/lib/db/queries';
import { toTrack } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ track?: string; t?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { id } = await params;
  const playlistId = Number(id);
  const playlists = getAllPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    return { title: 'Playlist không tìm thấy' };
  }

  return {
    title: playlist.name,
    description: `Playlist "${playlist.name}" trên TikPlay — ${playlist.trackCount} bài hát.`,
    openGraph: {
      title: `${playlist.name} | TikPlay`,
      description: `Playlist "${playlist.name}" trên TikPlay — ${playlist.trackCount} bài hát.`,
    },
  };
}

export default async function PlaylistPage({
  params,
  searchParams,
}: PageProps) {
  const sp = await searchParams;
  const { id } = await params;
  const playlistId = Number(id);
  const playlists = getAllPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    notFound();
  }

  const favIds = getFavoriteIds();
  const page = getTrackPage({
    scope: { type: 'playlist', playlistId },
    sort: 'playlist',
  });
  const tracks = page.tracks.map((r) => toTrack(r, favIds));
  const sharedTrackId = Number(sp.track) || 0;
  const seekTime = Number(sp.t) || 0;
  const sharedRow = sharedTrackId ? getTrack(sharedTrackId) : undefined;
  const currentTrack = sharedRow ? toTrack(sharedRow, favIds) : null;

  const initialData: InitialAppData = {
    tracks,
    trackPage: {
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
      total: page.total,
    },
    playlists,
    categories: getAllCategories(),
    sources: getAllSources(),
    favoriteIds: Array.from(favIds),
    autoRules: getAutoRules(),
    currentPlaylistId: playlistId,
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
