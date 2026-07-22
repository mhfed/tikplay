import { expect, test } from '@playwright/test';

test('sorts the library and opens track metadata controls', async ({
  page,
  request,
}) => {
  const timestamp = Date.now();
  const created = await request.post('/api/tracks', {
    data: {
      url: `https://example.com/test-track-${timestamp}`,
      audioKey: `e2e-${timestamp}`,
      title: 'E2E Library Track',
      author: 'E2E Artist',
      cover: '',
      duration: 30,
    },
  });
  const { track } = (await created.json()) as { track: { id: number } };

  try {
    await page.goto('/library');

    const sort = page.getByLabel('Sắp xếp bài hát');
    await expect(sort).toBeVisible();
    await sort.selectOption('title');
    await expect(sort).toHaveValue('title');

    const trackActions = page.getByRole('button', {
      name: 'Tùy chọn bài hát',
    });
    await expect(trackActions.first()).toBeVisible();
    await trackActions.first().click();

    await expect(
      page.getByRole('heading', { name: 'Chỉnh sửa bài hát' }),
    ).toBeVisible();
    await expect(page.getByLabel('Tên bài hát')).toHaveValue(
      'E2E Library Track',
    );
    await expect(page.getByLabel('Nghệ sĩ')).toBeVisible();
    await expect(page.getByLabel('Ảnh bìa')).toBeVisible();
    await expect(page.getByLabel('Thể loại')).toBeVisible();
  } finally {
    await request.delete('/api/tracks', { data: { id: track.id } });
  }
});

test('opens management controls for a manual playlist', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/playlists', {
    data: { name: 'E2E Playlist' },
  });
  const { playlist } = (await created.json()) as {
    playlist: { id: number; name: string };
  };

  try {
    await page.goto(`/library/${playlist.id}`);
    await page.getByRole('button', { name: 'Quản lý danh sách phát' }).click();

    await expect(
      page.getByRole('heading', { name: 'Quản lý danh sách' }),
    ).toBeVisible();
    await expect(page.getByLabel('Tên danh sách')).toHaveValue(playlist.name);
    await expect(
      page.getByRole('button', { name: 'Đưa danh sách lên' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Đưa danh sách xuống' }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Xóa danh sách' }),
    ).toBeVisible();
  } finally {
    await request.delete('/api/playlists', { data: { id: playlist.id } });
  }
});
