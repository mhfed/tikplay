import type { MetadataRoute } from 'next';
import { getAllPlaylists } from '@/lib/db/queries';

const SITE_URL = 'https://craw-music.fly.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const playlists = getAllPlaylists();

  const staticPages: MetadataRoute.Sitemap = [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
    {
      url: `${SITE_URL}/library`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/library/favorites`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/terms`,
      lastModified: new Date('2026-07-21'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/copyright`,
      lastModified: new Date('2026-07-21'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];

  const playlistPages: MetadataRoute.Sitemap = playlists
    .filter((p) => p.id !== 1)
    .map((p) => ({
      url: `${SITE_URL}/library/${p.id}`,
      lastModified: new Date(p.created_at),
      changeFrequency: 'weekly' as const,
      priority: 0.7,
    }));

  return [...staticPages, ...playlistPages];
}
