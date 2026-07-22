import { expect, test } from '@playwright/test';

test('returns health status for an empty library', async ({ request }) => {
  const response = await request.get('/api/tracks/health');
  const body = (await response.json()) as {
    ok: boolean;
    totalTracks: number;
    missing: unknown[];
    unreferencedKeys: unknown[];
  };
  expect(response.ok()).toBe(true);
  expect(body.ok).toBe(true);
  expect(Number.isFinite(body.totalTracks)).toBe(true);
  expect(Array.isArray(body.missing)).toBe(true);
  expect(Array.isArray(body.unreferencedKeys)).toBe(true);
});

test('cleanup-cache accepts the action', async ({ request }) => {
  const response = await request.post('/api/tracks/health', {
    data: { action: 'cleanup-cache' },
  });
  const body = (await response.json()) as {
    ok: boolean;
    removed: number;
  };
  expect(response.ok()).toBe(true);
  expect(body.ok).toBe(true);
  expect(Number.isFinite(body.removed)).toBe(true);
});

test('delete-missing is validated', async ({ request }) => {
  const response = await request.post('/api/tracks/health', {
    data: { action: 'delete-missing', trackIds: [] },
  });
  const body = (await response.json()) as { ok: boolean; removed: number };
  expect(response.ok()).toBe(true);
  expect(body.ok).toBe(true);
  expect(body.removed).toBe(0);
});
