import { test, expect } from '@playwright/test';

test.describe('Check Environment', () => {
  test('Check if OPFS is supported', async ({ page }) => {
    await page.goto('/');

    await page.waitForTimeout(2000);

    const spanText = await page.locator('span', { hasText: 'Lưu trữ' }).count();
    console.log('Lưu trữ count:', spanText);
    if (spanText > 0) {
      console.log(
        'Lưu trữ text:',
        await page.locator('span', { hasText: 'Lưu trữ' }).first().innerText(),
      );
    }
  });
});
