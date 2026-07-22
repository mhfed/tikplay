import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000';

export default defineConfig({
  testDir: './e2e',
  timeout: 150_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL,
    headless: true,
    storageState: {
      cookies: [],
      origins: [
        {
          origin: baseURL,
          localStorage: [
            { name: 'tikplay:terms:2026-07-21', value: 'accepted' },
          ],
        },
      ],
    },
    launchOptions: {
      // Let media play without a user gesture so the player can be exercised.
      args: ['--autoplay-policy=no-user-gesture-required'],
    },
  },
  webServer: {
    command: 'npm run start',
    url: baseURL,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
