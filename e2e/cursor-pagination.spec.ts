import { expect, test } from '@playwright/test';

interface ApiTrack {
  id: number;
  title: string;
}

interface TrackPage {
  ok: boolean;
  tracks: ApiTrack[];
  nextCursor: string | null;
  hasMore: boolean;
  total: number;
}

test.describe.configure({ mode: 'serial' });

test('returns bounded stable cursor pages and rejects cursor reuse across queries', async ({
  request,
}) => {
  const timestamp = Date.now();
  const prefix = `Cursor E2E ${timestamp}`;
  const trackIds: number[] = [];

  try {
    for (let index = 0; index < 5; index += 1) {
      const response = await request.post('/api/tracks', {
        data: {
          url: `https://example.com/cursor-${timestamp}-${index}`,
          audioKey: `cursor-e2e-${timestamp}-${index}`,
          title: `${prefix} ${String(index).padStart(2, '0')}`,
          author: 'Cursor E2E Artist',
          cover: '',
          duration: 30,
        },
      });
      expect(response.ok()).toBe(true);
      const { track } = (await response.json()) as { track: ApiTrack };
      trackIds.push(track.id);
    }

    const firstResponse = await request.get(
      `/api/tracks?q=${encodeURIComponent(prefix)}&sort=title&limit=2`,
    );
    expect(firstResponse.ok()).toBe(true);
    const first = (await firstResponse.json()) as TrackPage;
    expect(first.tracks).toHaveLength(2);
    expect(first.total).toBe(5);
    expect(first.hasMore).toBe(true);
    expect(first.nextCursor).toBeTruthy();

    const secondResponse = await request.get(
      `/api/tracks?q=${encodeURIComponent(prefix)}&sort=title&limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`,
    );
    expect(secondResponse.ok()).toBe(true);
    const second = (await secondResponse.json()) as TrackPage;
    expect(second.tracks).toHaveLength(2);
    expect(second.tracks.map(({ id }) => id)).not.toEqual(
      expect.arrayContaining(first.tracks.map(({ id }) => id)),
    );

    const thirdResponse = await request.get(
      `/api/tracks?q=${encodeURIComponent(prefix)}&sort=title&limit=2&cursor=${encodeURIComponent(second.nextCursor!)}`,
    );
    expect(thirdResponse.ok()).toBe(true);
    const third = (await thirdResponse.json()) as TrackPage;
    expect(third.tracks).toHaveLength(1);
    expect(third.hasMore).toBe(false);
    expect(third.nextCursor).toBeNull();

    const allIds = [...first.tracks, ...second.tracks, ...third.tracks].map(
      ({ id }) => id,
    );
    expect(new Set(allIds).size).toBe(5);

    const mismatch = await request.get(
      `/api/tracks?q=${encodeURIComponent(prefix)}&sort=author&limit=2&cursor=${encodeURIComponent(first.nextCursor!)}`,
    );
    expect(mismatch.status()).toBe(400);

    const clampedResponse = await request.get(
      `/api/tracks?q=${encodeURIComponent(prefix)}&sort=title&limit=999`,
    );
    expect(clampedResponse.ok()).toBe(true);
    const clamped = (await clampedResponse.json()) as TrackPage;
    expect(clamped.tracks).toHaveLength(5);
  } finally {
    for (const id of trackIds) {
      await request.delete('/api/tracks', { data: { id } });
    }
  }
});
