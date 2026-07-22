import { expect, test } from '@playwright/test';

test('requires copyright terms acceptance on first visit', async ({
  browser,
}) => {
  const context = await browser.newContext({
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  await page.goto('/');

  const dialog = page.getByRole('alertdialog', {
    name: 'Điều khoản sử dụng và bản quyền',
  });
  const acceptButton = page.getByRole('button', {
    name: 'Đồng ý và tiếp tục',
  });

  await expect(dialog).toBeVisible();
  await expect(acceptButton).toBeDisabled();
  await page.getByRole('checkbox').check();
  await acceptButton.click();
  await expect(dialog).toBeHidden();

  await page.reload();
  await expect(dialog).toBeHidden();

  await context.close();
});

test('keeps the terms dialog within a mobile viewport', async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    storageState: { cookies: [], origins: [] },
  });
  const page = await context.newPage();

  await page.goto('/');

  const dialog = page.getByRole('alertdialog', {
    name: 'Điều khoản sử dụng và bản quyền',
  });
  await expect(dialog).toBeVisible();

  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(390);
  expect(box!.y + box!.height).toBeLessThanOrEqual(844);
  await expect(
    page.getByRole('button', { name: 'Đồng ý và tiếp tục' }),
  ).toBeVisible();

  await context.close();
});
