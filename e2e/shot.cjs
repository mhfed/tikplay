const { chromium } = require('@playwright/test');

const URL =
  'https://www.tiktok.com/@longvumrcapcut01/video/7651599963360693512';

(async () => {
  const browser = await chromium.launch();

  // Desktop — active + playing
  const page = await browser.newPage({
    viewport: { width: 1280, height: 920 },
  });
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await page.fill('.url-input__field', URL);
  await page.click('.btn--primary');
  await page.waitForSelector('.np--active', { timeout: 150000 });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: 'e2e/shot-desktop-active.png',
    fullPage: true,
  });
  await page.click('.btn--play');
  await page.waitForTimeout(1300);
  await page.screenshot({
    path: 'e2e/shot-desktop-playing.png',
    fullPage: true,
  });
  await page.close();

  // Mobile
  const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await m.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  await m.waitForTimeout(600);
  await m.screenshot({ path: 'e2e/shot-mobile.png', fullPage: true });
  await m.close();

  await browser.close();
  console.log('screenshots done');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
