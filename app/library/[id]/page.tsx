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
  getPlaylistTracks,
} from '@/lib/db/queries';
import { type Track, toTrack } from '@/lib/types';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
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

export default async function PlaylistPage({ params }: PageProps) {
  const { id } = await params;
  const playlistId = Number(id);
  const playlists = getAllPlaylists();
  const playlist = playlists.find((p) => p.id === playlistId);

  if (!playlist) {
    notFound();
  }

  const favIds = getFavoriteIds();
  const tracks: Track[] = getPlaylistTracks(playlistId).map((r) =>
    toTrack(r, favIds),
  );

  const initialData: InitialAppData = {
    tracks,
    playlists,
    categories: getAllCategories(),
    sources: getAllSources(),
    favoriteIds: Array.from(favIds),
    autoRules: getAutoRules(),
    currentPlaylistId: playlistId,
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
