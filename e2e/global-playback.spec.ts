import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __audioInstances: HTMLAudioElement[];
  }
}

interface CreatedTrack {
  id: number;
  title: string;
  audioUrl: string;
}

test('keeps one audio source playing across route navigation', async ({
  page,
  request,
}) => {
  const timestamp = Date.now();
  const tracks: CreatedTrack[] = [];
  for (const index of [1, 2, 3]) {
    const audioKey = `${timestamp.toString(16).padStart(16, '0')}${index.toString(16).padStart(48, '0')}`;
    const response = await request.post('/api/tracks', {
      data: {
        url: `https://example.com/global-playback-${timestamp}-${index}`,
        audioKey,
        title: `Global Playback Track ${index}`,
        author: 'E2E Artist',
        cover: '',
        duration: 120,
      },
    });
    expect(response.ok()).toBe(true);
    const { track } = (await response.json()) as { track: CreatedTrack };
    tracks.push(track);
  }

  await page.addInitScript(() => {
    window.__audioInstances = [];
    const NativeAudio = window.Audio;
    const states = new WeakMap<
      HTMLAudioElement,
      { paused: boolean; startedAt: number; elapsed: number }
    >();
    // biome-ignore lint/complexity/useArrowFunction: Constructor shim must support `new Audio()`.
    const TrackedAudio = function (src?: string) {
      const audio = new NativeAudio(src);
      states.set(audio, { paused: true, startedAt: 0, elapsed: 0 });
      Object.defineProperties(audio, {
        currentSrc: { configurable: true, get: () => audio.src },
        currentTime: {
          configurable: true,
          get: () => {
            const state = states.get(audio)!;
            return (
              state.elapsed +
              (state.paused ? 0 : (performance.now() - state.startedAt) / 1000)
            );
          },
          set: (value: number) => {
            const state = states.get(audio)!;
            state.elapsed = value;
            if (!state.paused) state.startedAt = performance.now();
          },
        },
        paused: {
          configurable: true,
          get: () => states.get(audio)!.paused,
        },
      });
      audio.load = () => {
        queueMicrotask(() => {
          audio.dispatchEvent(new Event('loadedmetadata'));
          audio.dispatchEvent(new Event('canplay'));
        });
      };
      audio.play = async () => {
        const state = states.get(audio)!;
        if (state.paused) state.startedAt = performance.now();
        state.paused = false;
        audio.dispatchEvent(new Event('playing'));
      };
      audio.pause = () => {
        const state = states.get(audio)!;
        if (!state.paused) {
          state.elapsed += (performance.now() - state.startedAt) / 1000;
          state.paused = true;
        }
        audio.dispatchEvent(new Event('pause'));
      };
      window.__audioInstances.push(audio);
      return audio;
    } as unknown as typeof Audio;
    TrackedAudio.prototype = NativeAudio.prototype;
    Object.setPrototypeOf(TrackedAudio, NativeAudio);
    window.Audio = TrackedAudio;
  });

  try {
    await page.goto('/');
    await page.getByRole('button', { name: 'Phát ngay' }).click();
    await page.waitForFunction(
      () =>
        window.__audioInstances.length === 1 &&
        !window.__audioInstances[0].paused &&
        window.__audioInstances[0].currentTime > 0,
    );

    const beforeRoute = await page.evaluate(() => ({
      count: window.__audioInstances.length,
      currentTime: window.__audioInstances[0].currentTime,
      src: window.__audioInstances[0].currentSrc,
    }));

    await page
      .getByRole('link', { name: 'Tất cả bài hát', exact: true })
      .click();
    await page.waitForTimeout(500);

    const afterRoute = await page.evaluate(() => ({
      count: window.__audioInstances.length,
      currentTime: window.__audioInstances[0].currentTime,
      paused: window.__audioInstances[0].paused,
      src: window.__audioInstances[0].currentSrc,
    }));

    expect(afterRoute.count).toBe(1);
    expect(afterRoute.paused).toBe(false);
    expect(afterRoute.src).toBe(beforeRoute.src);
    expect(afterRoute.currentTime).toBeGreaterThan(beforeRoute.currentTime);

    const nextTrack = tracks.find(
      (track) => !beforeRoute.src.endsWith(track.audioUrl),
    );
    expect(nextTrack).toBeTruthy();
    await page
      .getByRole('button', { name: `Phát ${nextTrack!.title}` })
      .click();
    await page.waitForFunction(
      (previousSrc) =>
        window.__audioInstances.length === 1 &&
        !window.__audioInstances[0].paused &&
        window.__audioInstances[0].currentSrc !== previousSrc,
      beforeRoute.src,
    );

    const afterSwitch = await page.evaluate(() => ({
      count: window.__audioInstances.length,
      paused: window.__audioInstances[0].paused,
      src: window.__audioInstances[0].currentSrc,
    }));

    expect(afterSwitch.count).toBe(1);
    expect(afterSwitch.paused).toBe(false);
    expect(afterSwitch.src).not.toBe(beforeRoute.src);
  } finally {
    for (const track of tracks) {
      await request.delete('/api/tracks', { data: { id: track.id } });
    }
  }
});
