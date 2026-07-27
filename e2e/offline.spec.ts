import { test, expect } from '@playwright/test';

test.describe('Offline Listening E2E', () => {
  test('should trigger download', async ({ page }) => {
    page.on('console', (msg) => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', (err) => console.log('PAGE_ERROR:', err.message));

    await page.goto('/library');

    // Wait for the track list to be rendered (title text is visible)
    await page.waitForSelector('text=Mashup 2in1', { timeout: 15000 });

    // Find a track row that contains author text "hduong_461" — Track ID 1
    const trackRow = page.locator('.group', { hasText: 'hduong_461' }).first();
    await trackRow.hover();

    // The download button is inside a group that becomes visible on hover
    const downloadBtn = trackRow.locator(
      'button[title="Tải xuống để nghe offline"]',
    );
    await expect(downloadBtn).toBeVisible({ timeout: 10000 });

    // Click the download button
    await downloadBtn.click();

    // Wait a few seconds for download to progress or finish
    await page.waitForTimeout(5000);

    // Check if error or success indicators appeared
    const errorBadge = page.locator('.text-red-400');
    const successBadge = page.locator('.text-emerald-400');
    const errCount = await errorBadge.count();
    const succCount = await successBadge.count();
    console.log('Error count:', errCount, 'Success count:', succCount);

    if (errCount > 0) {
      const errTitle = await errorBadge.first().getAttribute('title');
      console.log('ERROR BADGE TITLE:', errTitle);
    }
  });
});
