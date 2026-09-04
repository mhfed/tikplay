import { access, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { resolveCacheMaxGb } from '../lib/cache/config';

test('prefers a valid saved cache limit and falls back to the environment default', () => {
  expect(resolveCacheMaxGb(2.5, 5)).toBe(2.5);
  expect(resolveCacheMaxGb(undefined, 5)).toBe(5);
  expect(resolveCacheMaxGb(0, 5)).toBe(5);
  expect(resolveCacheMaxGb(Number.NaN, 5)).toBe(5);
});

test('rejects an invalid cache limit without changing the active setting', async ({
  request,
}) => {
  const response = await request.put('/api/cache', {
    data: { cacheMaxGb: 0 },
  });

  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    error: 'Giới hạn cache phải lớn hơn 0 GB',
  });
});

test('saves a cache limit and exposes storage status', async ({ request }) => {
  const update = await request.put('/api/cache', {
    data: { cacheMaxGb: 2.5 },
  });
  expect(update.ok()).toBe(true);
  await expect(update.json()).resolves.toMatchObject({
    ok: true,
    settings: { cacheMaxGb: 2.5, savedCacheMaxGb: 2.5 },
  });

  const response = await request.get(
    '/api/cache?protectedTrackIds=1,invalid,2',
  );
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    cacheMaxGb: 2.5,
    status: {
      cacheBytes: expect.any(Number),
      limitBytes: expect.any(Number),
      safeCleanupFiles: expect.any(Number),
      evictionCandidates: expect.any(Array),
    },
  });
});

test('runs safe cleanup and returns reclaimed bytes with refreshed status', async ({
  request,
}) => {
  const key = '7'.repeat(64);
  const orphanAudio = join(process.cwd(), 'cache', `${key}.m4a`);
  await writeFile(orphanAudio, Buffer.alloc(12));

  try {
    const response = await request.post('/api/cache/cleanup');
    expect(response.ok()).toBe(true);
    const body = (await response.json()) as {
      ok: boolean;
      removedFiles: number;
      freedBytes: number;
      status: { cacheBytes: number };
    };
    expect(body.ok).toBe(true);
    expect(body.removedFiles).toBeGreaterThanOrEqual(1);
    expect(body.freedBytes).toBeGreaterThanOrEqual(12);
    expect(Number.isFinite(body.status.cacheBytes)).toBe(true);
    await expect(access(orphanAudio)).rejects.toThrow();
  } finally {
    await rm(orphanAudio, { force: true });
  }
});

test('opens the storage manager, saves a limit, and cleans only safe cache data', async ({
  page,
}) => {
  const status = {
    ok: true,
    cacheMaxGb: 5,
    savedCacheMaxGb: null,
    status: {
      cacheBytes: 2 * 1024 * 1024 * 1024,
      limitBytes: 5 * 1024 * 1024 * 1024,
      remainingBytes: 3 * 1024 * 1024 * 1024,
      freeBytes: 20 * 1024 * 1024 * 1024,
      minFreeBytes: 256 * 1024 * 1024,
      isOverLimit: false,
      isLowDisk: false,
      safeCleanupBytes: 1234,
      safeCleanupFiles: 2,
      orphanedEntries: 0,
      evictionCandidates: [
        {
          trackId: 1,
          audioKey: 'a'.repeat(64),
          title: 'Bài kiểm tra',
          author: 'TikPlay',
          cover: '',
          size: 1024,
          mtimeMs: Date.now() - 60 * 60 * 1000,
        },
      ],
    },
  };

  await page.route('**/api/cache*', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          ...status,
          removedFiles: 2,
          freedBytes: 1234,
        }),
      });
      return;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify(status),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Quản lý dung lượng' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Dung lượng cache' }),
  ).toBeVisible();
  await expect(page.getByText('Bài có thể bị dọn tiếp theo')).toBeVisible();
  await expect(page.getByText('Bài kiểm tra')).toBeVisible();
  await page.getByLabel('Giới hạn cache (GB)').fill('2.5');
  await page.getByRole('button', { name: 'Lưu giới hạn' }).click();
  await page.getByRole('button', { name: 'Dọn ngay' }).click();
  await expect(page.getByText(/đã giải phóng/i)).toBeVisible();
});

test('opens the storage manager from the mobile playlist drawer', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Playlist', exact: true }).click();
  await page.getByRole('button', { name: 'Quản lý dung lượng' }).click();
  await expect(
    page.getByRole('dialog', { name: 'Dung lượng cache' }),
  ).toBeVisible();
});
