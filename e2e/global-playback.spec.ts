import { expect, test } from '@playwright/test';

declare global {
  interface Window {
    __audioInstances: HTMLAudioElement[];
  }
}

test('keeps one audio source playing across route navigation', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.__audioInstances = [];
    const NativeAudio = window.Audio;
    // biome-ignore lint/complexity/useArrowFunction: Constructor shim must support `new Audio()`.
    const TrackedAudio = function (src?: string) {
      const audio = new NativeAudio(src);
      window.__audioInstances.push(audio);
      return audio;
    } as unknown as typeof Audio;
    TrackedAudio.prototype = NativeAudio.prototype;
    Object.setPrototypeOf(TrackedAudio, NativeAudio);
    window.Audio = TrackedAudio;
  });

  await page.goto('/');
  await page.locator('button.home-card-reveal').first().click();
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

  await page.getByRole('link', { name: 'Tất cả bài hát', exact: true }).click();
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

  await page
    .getByRole('button', { name: /^Phát / })
    .first()
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
});
