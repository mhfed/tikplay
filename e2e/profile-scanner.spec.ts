import { expect, test } from '@playwright/test';

test.describe('Profile Scanner Feature', () => {
  test('should open ProfileInputDialog from button, input TikTok profile URL and show the scanner dialog', async ({
    page,
  }) => {
    // Go to homepage
    await page.goto('http://localhost:3000/');

    // Find and click the "Tải từ Profile" button (can be in Sidebar or next to UrlInput)
    const openButton = page
      .locator('button:has-text("Tải từ Profile")')
      .first();
    await openButton.waitFor({ state: 'visible' });
    await openButton.click();

    // Verify ProfileInputDialog is shown
    const dialogTitle = page.locator('text=Tải nhạc từ Profile');
    await expect(dialogTitle).toBeVisible();

    // Verify clicking outside does NOT close ProfileInputDialog
    await page.mouse.click(10, 10);
    await expect(dialogTitle).toBeVisible();

    // Fill the profile URL
    const input = page.locator(
      'input[placeholder*="https://www.tiktok.com/@lyric_music"]',
    );
    await input.fill('https://www.tiktok.com/@leonalewis');

    // Click submit ("Quét Profile")
    const scanButton = page.locator('button:has-text("Quét Profile")');
    await scanButton.click();

    // The ProfileScannerDialog should appear and show loading or scanner title
    const scannerTitle = page.locator('text=Quét Profile TikTok');
    await expect(scannerTitle).toBeVisible();

    // Verify clicking outside does NOT close ProfileScannerDialog
    await page.mouse.click(10, 10);
    await expect(scannerTitle).toBeVisible();

    // Find and click close/cancel button to dismiss dialog
    const cancelButton = page.locator('button', { hasText: 'Hủy' }).first();
    await cancelButton.click();
    await expect(scannerTitle).toBeHidden();
  });
});
