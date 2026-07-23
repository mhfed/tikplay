import { expect, test } from '@playwright/test';

const adminToken = process.env.ADMIN_TOKEN;
const adminHeaders = adminToken
  ? { Authorization: `Bearer ${adminToken}` }
  : undefined;

for (const method of ['post', 'patch', 'delete'] as const) {
  test(`rejects anonymous global track ${method.toUpperCase()}`, async ({
    request,
  }) => {
    const response = await request[method]('/api/tracks', { data: {} });
    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      code: 'UNAUTHORIZED',
    });
  });
}

test('keeps the global track catalog public', async ({ request }) => {
  const response = await request.get('/api/tracks?ids=');
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    tracks: [],
  });
});

test('rejects anonymous YouTube cookie reads and writes', async ({
  request,
}) => {
  const readResponse = await request.get('/api/admin/youtube-cookies');
  const writeResponse = await request.post('/api/admin/youtube-cookies', {
    data: { cookiesText: '' },
  });
  expect(readResponse.status()).toBe(401);
  expect(writeResponse.status()).toBe(401);
});

test('rejects invalid authorized track mutations safely', async ({
  request,
}) => {
  test.skip(
    !adminHeaders,
    'ADMIN_TOKEN is required for authorized API coverage',
  );
  const response = await request.delete('/api/tracks', {
    headers: adminHeaders,
    data: { id: '../data/tikplay.json' },
  });
  expect(response.status()).toBe(400);
  await expect(response.json()).resolves.toMatchObject({
    ok: false,
    code: 'INVALID_TRACK_ID',
  });
});

test('rejects invalid cookie payload without echoing secrets', async ({
  request,
}) => {
  test.skip(
    !adminHeaders,
    'ADMIN_TOKEN is required for authorized API coverage',
  );
  const secret = 'not-a-youtube-cookie-secret';
  const response = await request.post('/api/admin/youtube-cookies', {
    headers: adminHeaders,
    data: { cookiesText: secret, fileName: '../cookies.txt' },
  });
  const responseText = await response.text();
  expect(response.status()).toBe(400);
  expect(responseText).not.toContain(secret);
});

test('operational bearer requests do not require a browser Origin', async ({
  request,
}) => {
  test.skip(
    !adminHeaders,
    'ADMIN_TOKEN is required for authorized API coverage',
  );
  const response = await request.post('/api/tracks/health', {
    headers: adminHeaders,
    data: { action: 'delete-missing', mode: 'dry-run', trackIds: [] },
  });
  expect(response.ok()).toBe(true);
  await expect(response.json()).resolves.toMatchObject({
    ok: true,
    mode: 'dry-run',
    matched: 0,
    removed: 0,
  });
});
