import { expect, test } from '@playwright/test';

test('restores a validated playback session without autoplay', async ({
  page,
  request,
}) => {
  const timestamp = Date.now();
  const created = await request.post('/api/tracks', {
    data: {
      url: `https://example.com/persisted-track-${timestamp}`,
      audioKey: `persisted-e2e-${timestamp}`,
      title: 'Persisted E2E Track',
      author: 'Session Artist',
      cover: '',
      duration: 120,
    },
  });
  const { track } = (await created.json()) as { track: { id: number } };

  await page.addInitScript((trackId) => {
    const state = window as typeof window & { __playCalls: number };
    state.__playCalls = 0;
    const nativePlay = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function () {
      state.__playCalls += 1;
      return nativePlay.call(this);
    };
    if (!window.localStorage.getItem('tikplay:playback:v1')) {
      window.localStorage.setItem(
        'tikplay:playback:v1',
        JSON.stringify({
          version: 1,
          currentTrackId: trackId,
          queueIds: [trackId, 999999],
          position: 42,
          shuffle: true,
          repeat: 'all',
          volume: 1.25,
          speed: 1.5,
          eqGains: [1, 1, 0, 0, 0, 0, 1, 2, 2, 1],
        }),
      );
    }
  }, track.id);

  try {
    await page.goto('/library');
    await expect(
      page.getByRole('button', { name: 'Mở trình phát' }),
    ).toContainText('Persisted E2E Track');
    await expect(page.getByLabel('Âm lượng')).toHaveValue('1.25');
    expect(
      await page.evaluate(
        () => (window as typeof window & { __playCalls: number }).__playCalls,
      ),
    ).toBe(0);

    const session = await page.evaluate(() =>
      JSON.parse(window.localStorage.getItem('tikplay:playback:v1') || 'null'),
    );
    expect(session.queueIds).toEqual([track.id]);
    expect(session.position).toBe(42);
    expect(session.repeat).toBe('all');

    await page.reload();
    await expect(
      page.getByRole('button', { name: 'Mở trình phát' }),
    ).toContainText('Persisted E2E Track');
    expect(
      await page.evaluate(
        () => (window as typeof window & { __playCalls: number }).__playCalls,
      ),
    ).toBe(0);
  } finally {
    await request.delete('/api/tracks', { data: { id: track.id } });
  }
});
