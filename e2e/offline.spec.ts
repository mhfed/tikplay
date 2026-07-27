import { test, expect } from '@playwright/test';

test.describe('Offline Listening UI', () => {
  test('should display offline indicator and manager dialog', async ({ page }) => {
    // Navigate to homepage
    await page.goto('/');

    // Check if the offline indicator is present in the UI
    // By default it should show "Lưu trữ (0)" when network is online
    const indicatorButton = page.getByRole('button', { name: /Lưu trữ \(0\)/ });
    await expect(indicatorButton).toBeVisible({ timeout: 15000 });
    
    // Click the offline indicator to open the manager dialog
    await indicatorButton.first().click();
    
    // Check if the manager dialog opens
    const dialogTitle = page.getByRole('heading', { name: 'Quản lý nhạc Offline' });
    await expect(dialogTitle).toBeVisible();
    
    // Assert empty state is visible
    const emptyState = page.locator('text=Chưa có bài hát nào được tải.');
    await expect(emptyState).toBeVisible();
    
    // Close the dialog
    await page.getByRole('button', { name: /Đóng|Thoát/ }).first().click();
  });
});
