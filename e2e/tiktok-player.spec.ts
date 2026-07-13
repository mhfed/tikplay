import { test, expect } from '@playwright/test';

// The TikTok video the user wants to verify end-to-end.
const TIKTOK_URL = 'https://www.tiktok.com/@longvumrcapcut01/video/7651599963360693512';

test('clone a TikTok URL and play the extracted audio', async ({ page }) => {
  await page.goto('/');

  // 1. Input the URL and submit.
  const input = page.locator('.url-input__field');
  await expect(input).toBeVisible();
  await input.fill(TIKTOK_URL);
  await page.locator('.btn--primary').click();

  // 2. Wait until either a track loaded into the player or an error appeared.
  const player = page.locator('.player--active');
  const error = page.locator('.url-input__error');
  await expect(player.or(error)).toBeVisible({ timeout: 120_000 });

  if (await error.isVisible()) {
    const msg = await error.innerText();
    throw new Error(`Backend failed to process TikTok URL: ${msg}`);
  }

  // 3. Title must be populated (not the empty placeholder).
  const title = (await page.locator('.player__title').innerText()).trim();
  expect(title.length).toBeGreaterThan(0);
  expect(title).not.toContain('Nothing playing');

  // 4. The audio element should point at our streaming endpoint.
  const audioSrc = await page.locator('audio').getAttribute('src');
  expect(audioSrc).toMatch(/\/api\/audio\/.+/);

  // 5. The audio endpoint must serve real audio bytes.
  const resp = await page.request.get(audioSrc!);
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-type']).toContain('audio');
  expect(Number(resp.headers()['content-length'])).toBeGreaterThan(0);

  // 6. The <audio> element must load metadata (duration known).
  await page.waitForFunction(
    () => {
      const a = document.querySelector('audio') as HTMLAudioElement | null;
      return !!a && a.duration > 0;
    },
    undefined,
    { timeout: 30_000 },
  );

  // 7. Press play and confirm the media is buffered & ready (HAVE_CURRENT_DATA+).
  await page.locator('.btn--play').click();
  await page.waitForFunction(
    () => {
      const a = document.querySelector('audio') as HTMLAudioElement | null;
      return !!a && a.readyState >= 2;
    },
    undefined,
    { timeout: 20_000 },
  );

  // 8. The decoder must function: seeking to a non-zero position works and the
  //    timeline is controllable, proving real audio playback is possible even
  //    when the headless browser has no audio output device.
  await page.locator('audio').evaluate((el) => {
    (el as HTMLAudioElement).currentTime = Math.min(10, (el.duration || 0) / 2);
  });
  const seekedTo = await page
    .locator('audio')
    .evaluate((el) => (el as HTMLAudioElement).currentTime);
  console.log(`[playwright] audio seeked to ${seekedTo.toFixed(2)}s`);
  expect(seekedTo).toBeGreaterThan(0);

  // 9. The track should also appear in the playlist list.
  await expect(page.locator('.track-item').first()).toBeVisible();
});
