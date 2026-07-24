import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { cacheKey, validateMediaUrl } from '../lib/media/source';

test('publishes legal pages without requiring prior acceptance', async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  await page.goto('/terms');
  await expect(
    page.getByRole('heading', { name: 'Điều khoản sử dụng' }),
  ).toBeVisible();
  await expect(page.getByRole('alertdialog')).toBeHidden();

  await page.goto('/copyright');
  await expect(
    page.getByRole('heading', { name: 'Chính sách bản quyền' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi báo cáo' })).toBeVisible();

  await context.close();
});

test('stores, moderates, purges and blocks reported media', async ({
  request,
}) => {
  const adminToken = process.env.ADMIN_TOKEN;
  const cacheDir = process.env.CACHE_DIR;
  expect(adminToken).toBeTruthy();
  expect(cacheDir).toBeTruthy();

  const sourceUrl = `https://youtu.be/copyright-test-${Date.now()}`;
  const validation = validateMediaUrl(sourceUrl);
  expect(validation.valid).toBe(true);
  const audioKey = cacheKey(validation.normalized!);

  const reportResponse = await request.post('/api/copyright-reports', {
    data: {
      sourceUrl,
      reporterName: 'Rights Owner',
      reporterEmail: 'rights@example.com',
      rightsBasis: 'rights-owner',
      details: 'I own the rights to this test content and request its removal.',
      declaration: true,
    },
  });
  expect(reportResponse.status()).toBe(201);
  const created = (await reportResponse.json()) as { reportId: number };

  const unauthorized = await request.get('/api/admin/copyright-reports');
  expect(unauthorized.status()).toBe(401);

  mkdirSync(cacheDir!, { recursive: true });
  for (const extension of ['m4a', 'json', 'jpg']) {
    writeFileSync(join(cacheDir!, `${audioKey}.${extension}`), 'test');
  }

  const moderation = await request.patch('/api/admin/copyright-reports', {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: {
      id: created.reportId,
      action: 'takedown',
      note: 'Verified in automated test',
    },
  });
  expect(moderation.ok()).toBe(true);

  for (const extension of ['m4a', 'json', 'jpg']) {
    expect(existsSync(join(cacheDir!, `${audioKey}.${extension}`))).toBe(false);
  }

  const retry = await request.post('/api/process', {
    data: { url: sourceUrl },
  });
  expect(retry.status()).toBe(451);
});
