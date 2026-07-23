import { expect, test } from '@playwright/test';

const adminToken = process.env.ADMIN_TOKEN;
const adminHeaders = adminToken
  ? { Authorization: `Bearer ${adminToken}` }
  : undefined;

test('rejects anonymous health diagnostics', async ({ request }) => {
  const response = await request.get('/api/tracks/health');
  const body = (await response.json()) as { ok: boolean; code?: string };
  expect(response.status()).toBe(401);
  expect(body).toMatchObject({ ok: false, code: 'UNAUTHORIZED' });
});

test('rejects anonymous health cleanup', async ({ request }) => {
  const response = await request.post('/api/tracks/health', {
    data: { action: 'cleanup-cache', mode: 'dry-run' },
  });
  expect(response.status()).toBe(401);
});

test('authorized health diagnostics remain available', async ({ request }) => {
  test.skip(
    !adminHeaders,
    'ADMIN_TOKEN is required for authorized API coverage',
  );
  const response = await request.get('/api/tracks/health', {
    headers: adminHeaders,
  });
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

test('authorized cleanup supports non-destructive dry-run', async ({
  request,
}) => {
  test.skip(
    !adminHeaders,
    'ADMIN_TOKEN is required for authorized API coverage',
  );
  const response = await request.post('/api/tracks/health', {
    headers: adminHeaders,
    data: { action: 'cleanup-cache', mode: 'dry-run' },
  });
  const body = (await response.json()) as {
    ok: boolean;
    mode: string;
    matched: number;
    removed: number;
  };
  expect(response.ok()).toBe(true);
  expect(body).toMatchObject({ ok: true, mode: 'dry-run', removed: 0 });
  expect(Number.isFinite(body.matched)).toBe(true);
});

test('authorized health mutation rejects unsafe input', async ({ request }) => {
  test.skip(
    !adminHeaders,
    'ADMIN_TOKEN is required for authorized API coverage',
  );
  const response = await request.post('/api/tracks/health', {
    headers: adminHeaders,
    data: {
      action: 'delete-missing',
      mode: 'commit',
      trackIds: [0, '../data/tikplay.json'],
    },
  });
  const body = (await response.json()) as { ok: boolean; code?: string };
  expect(response.status()).toBe(400);
  expect(body).toMatchObject({ ok: false, code: 'INVALID_TRACK_IDS' });
});

test('rejects cross-origin browser health mutations', async ({ request }) => {
  test.skip(!adminToken, 'ADMIN_TOKEN is required for authorized API coverage');
  if (!adminToken) return;
  const response = await request.post('/api/tracks/health', {
    headers: {
      'x-admin-token': adminToken,
      Origin: 'https://attacker.example',
    },
    data: { action: 'cleanup-cache', mode: 'dry-run' },
  });
  const body = (await response.json()) as { ok: boolean; code?: string };
  expect(response.status()).toBe(403);
  expect(body).toMatchObject({ ok: false, code: 'INVALID_ORIGIN' });
});
