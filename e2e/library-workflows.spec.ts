import { expect, test } from '@playwright/test';

test.describe.configure({ mode: 'serial' });

test('sorts the library and opens track metadata controls', async ({
  page,
  request,
}) => {
  const timestamp = Date.now();
  const title = `E2E Library Track ${timestamp}`;
  const created = await request.post('/api/tracks', {
    data: {
      url: `https://example.com/test-track-${timestamp}`,
      audioKey: `e2e-${timestamp}`,
      title,
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

    const row = page.locator('[data-track-row]').filter({ hasText: title });
    await expect(row).toHaveCount(1);
    await row.getByRole('button', { name: 'Tùy chọn bài hát' }).click();

    await expect(
      page.getByRole('heading', { name: 'Chỉnh sửa bài hát' }),
    ).toBeVisible();
    await expect(page.getByLabel('Tên bài hát')).toHaveValue(title);
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

test('virtualizes large libraries while preserving sortable playlist rows', async ({
  page,
  request,
}) => {
  test.setTimeout(120_000);
  const timestamp = Date.now();
  const trackIds: number[] = [];
  let playlistId: number | null = null;

  try {
    for (let index = 0; index < 81; index += 1) {
      const created = await request.post('/api/tracks', {
        data: {
          url: `https://example.com/virtual-track-${timestamp}-${index}`,
          audioKey: `e2e-virtual-${timestamp}-${index}`,
          title: `E2E Virtual Track ${timestamp} ${String(index).padStart(2, '0')}`,
          author: 'E2E Virtual Artist',
          cover: '',
          duration: 30,
        },
      });
      expect(created.ok()).toBe(true);
      const { track } = (await created.json()) as { track: { id: number } };
      trackIds.push(track.id);
    }

    const createdPlaylist = await request.post('/api/playlists', {
      data: { name: `E2E Virtual Playlist ${timestamp}` },
    });
    expect(createdPlaylist.ok()).toBe(true);
    const { playlist } = (await createdPlaylist.json()) as {
      playlist: { id: number };
    };
    playlistId = playlist.id;

    for (const trackId of trackIds) {
      const added = await request.post(`/api/playlists/${playlistId}/tracks`, {
        data: { trackId },
      });
      expect(added.ok()).toBe(true);
    }

    await page.goto('/library');
    const loadMore = page.getByRole('button', { name: /Tải thêm/ });
    if (await loadMore.isVisible()) await loadMore.click();
    const virtualList = page.locator('ul[data-virtualized="true"]');
    await expect(virtualList).toBeVisible();

    const mountedRows = virtualList.locator('[data-track-row]');
    await expect(mountedRows).not.toHaveCount(trackIds.length);
    expect(await mountedRows.count()).toBeLessThan(50);
    const firstWindowText = await mountedRows.first().textContent();

    await virtualList.evaluate((list) => {
      const scroller = list.parentElement;
      if (scroller) scroller.scrollTop = scroller.scrollHeight;
    });
    await expect
      .poll(async () => mountedRows.first().textContent())
      .not.toBe(firstWindowText);
    expect(await mountedRows.count()).toBeLessThan(50);

    await page.goto(`/library/${playlistId}`);
    const playlistRows = page.locator('[data-track-row]');
    await expect(page.locator('ul[data-virtualized="true"]')).toHaveCount(0);
    await expect(playlistRows).toHaveCount(trackIds.length);
    await expect(playlistRows.first().locator('[role="button"]')).toBeVisible();
  } finally {
    if (playlistId !== null) {
      await request.delete('/api/playlists', { data: { id: playlistId } });
    }
    for (const id of trackIds) {
      await request.delete('/api/tracks', { data: { id } });
    }
  }
});
