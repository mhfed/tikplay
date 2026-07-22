import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';

const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
];

for (const viewport of viewports) {
  test(`keeps TikTok input above library search on ${viewport.name}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/?pl=1');

    const urlInput = page.locator('.url-input__field');
    const searchInput = page.locator('.search-bar__field');

    await expect(urlInput).toBeVisible();
    await expect(searchInput).toBeVisible();

    const urlBox = await urlInput.boundingBox();
    const searchBox = await searchInput.boundingBox();

    expect(urlBox).not.toBeNull();
    expect(searchBox).not.toBeNull();
    expect(urlBox!.y).toBeLessThan(searchBox!.y);
  });
}

test('preserves URL and search control behavior after the move', async ({
  page,
}) => {
  await page.goto('/?pl=1');

  const urlInput = page.locator('.url-input__field');
  const addButton = page.locator('.url-input .btn--primary');
  const searchInput = page.locator('.search-bar__field');

  await expect(addButton).toBeDisabled();
  await urlInput.fill('https://www.tiktok.com/@artist/video/123');
  await expect(addButton).toBeEnabled();

  await searchInput.fill('remix');
  const clearButton = page.locator('.search-bar__clear');
  await expect(clearButton).toBeVisible();
  await clearButton.click();
  await expect(searchInput).toHaveValue('');
});

test('opens a shared library track link with the track selected', async ({
  page,
}) => {
  const db = JSON.parse(readFileSync('data/tikplay.json', 'utf8')) as {
    tracks: Array<{ id: number; title: string }>;
  };
  const sharedTrack =
    db.tracks.find((track) => track.id === 36) ?? db.tracks[0];

  expect(sharedTrack).toBeTruthy();

  await page.goto('/library?track=36');

  await expect(page.locator('.np__title')).toHaveText(sharedTrack!.title);
  expect(page.url()).toContain('track=36');
});
