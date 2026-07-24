import { expect, test } from '@playwright/test';

const SOUNDCLOUD_URL = 'https://soundcloud.com/charlieputh/attention';

test('clone a SoundCloud track and play the extracted audio', async ({
  page,
}) => {
  await page.goto('/?pl=1'); // Go to library view to see the UrlInput

  // 1. Input the URL and submit.
  const input = page
    .getByRole('textbox', { name: 'Liên kết bài hát/video' })
    .or(page.getByPlaceholder('Dán link TikTok'));
  await expect(input).toBeVisible();
  await input.fill(SOUNDCLOUD_URL);
  await page.getByRole('button', { name: 'Thêm' }).click();

  // 2. Wait until either a track loaded into the player or an error appeared.
  // The input becomes disabled while loading.
  await expect(input).toBeDisabled();
  await expect(input).toBeEnabled({ timeout: 120_000 });

  const errorAlert = page.locator('#tiktok-url-error');
  if (await errorAlert.isVisible()) {
    const msg = await errorAlert.innerText();
    throw new Error(`Backend failed to process URL: ${msg}`);
  }

  // 3. Title must be populated (not the empty placeholder).
  const playerTitle = page
    .locator('button[aria-label="Mở trình phát"]')
    .locator('span.font-bold')
    .first();
  const title = (await playerTitle.innerText()).trim();
  expect(title.length).toBeGreaterThan(0);
  expect(title).not.toContain('Chưa phát bài nào');

  // 4. The audio element should point at our streaming endpoint.
  const audioSrc = await page.locator('audio').getAttribute('src');
  console.log('DEBUG: audioSrc is', audioSrc);
  expect(audioSrc).toMatch(/\/api\/audio\/.+/);

  // 5. The audio endpoint must serve real audio bytes.
  const resp = await page.request.get(audioSrc!);
  console.log('DEBUG: resp status is', resp.status());
  if (resp.status() !== 200) {
    console.log('DEBUG: resp body is', await resp.text());
  }
  expect(resp.status()).toBe(200);
  expect(resp.headers()['content-type']).toContain('audio');
  expect(Number(resp.headers()['content-length'])).toBeGreaterThan(0);

  // 6. The track should also appear in the playlist list.
  // Navigate to "Tất cả bài hát" first so the TrackList renders.
  await page.getByRole('link', { name: 'Tất cả bài hát' }).click();
  const trackRow = page.locator('button[aria-label*="Phát"]');
  await expect(trackRow.first()).toBeVisible();
});
