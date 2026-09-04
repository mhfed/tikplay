# Cache storage manager — implementation plan

**Goal:** Add a safe cache-storage manager that shows disk/cache usage, saves a
GB limit, previews eviction order, and removes only disposable cache debris.

**Architecture:** Keep filesystem ownership in `FileCacheStore`; it returns a
read-only storage snapshot, a shared eviction plan, and a safe-cleanup result.
The JSON DB persists only the user-selected cache limit, while the API joins
filesystem entries to library metadata and the dialog renders that API contract.
The existing media processor supplies the persisted limit to each eviction run,
so a saved setting affects the running server without re-creating global state.

**Tech stack:** Next.js 16 App Router, React 19, TypeScript 7, JSON persistence,
Biome, Playwright.

**REQUIRED SUB-SKILL: implement**

## File structure

| File | Change | Single responsibility |
| --- | --- | --- |
| `lib/cache/config.ts` | Create | Resolve valid cache limits from DB settings and environment/default values. |
| `lib/cache/index.ts` | Modify | Inspect cache files, share eviction ordering, and safely remove disposable cache files. |
| `lib/db/index.ts` | Modify | Persist optional `settings.cacheMaxGb` while normalising older JSON DBs. |
| `lib/db/queries.ts` | Modify | Read and validate/save the cache-limit setting. |
| `lib/media/processor.ts` | Modify | Pass the effective persisted cache limit into every maintenance run. |
| `app/api/cache/route.ts` | Create | Serve cache status and validate/persist limit updates. |
| `app/api/cache/cleanup/route.ts` | Create | Run safe cleanup and return refreshed cache status. |
| `lib/cache/status.ts` | Create | Share cache context/status composition between cache routes. |
| `components/CacheStorageDialog.tsx` | Create | Fetch/render status, save a limit, and run safe cleanup. |
| `components/Sidebar.tsx` | Modify | Open the dialog from desktop navigation. |
| `components/MobileSidebar.tsx` | Modify | Open the same dialog from mobile navigation. |
| `e2e/cache-eviction.spec.ts` | Modify | Test filesystem-level status, plan ordering, safe cleanup, and configured-limit eviction. |
| `e2e/cache-storage.spec.ts` | Create | Test API validation/persistence and dialog interactions with deterministic mocked status responses. |

## Task 1 — Persistent cache-limit configuration

- [ ] **Write the red tests first** in `e2e/cache-storage.spec.ts`, importing
  `resolveCacheMaxGb` from `../lib/cache/config`:

  ```ts
  test('prefers a valid saved cache limit and falls back to the environment default', () => {
    expect(resolveCacheMaxGb(2.5, 5)).toBe(2.5);
    expect(resolveCacheMaxGb(undefined, 5)).toBe(5);
    expect(resolveCacheMaxGb(0, 5)).toBe(5);
    expect(resolveCacheMaxGb(Number.NaN, 5)).toBe(5);
  });
  ```

  Run `npx playwright test e2e/cache-storage.spec.ts --grep "prefers a valid"`
  and confirm it fails because the module/function does not exist.

- [ ] **Implement the minimal configuration contract.** Create
  `lib/cache/config.ts` with exported constants and a pure resolver:

  ```ts
  export const DEFAULT_CACHE_MAX_GB = 5;
  export const DEFAULT_MIN_FREE_MB = 256;

  export function resolveCacheMaxGb(
    savedMaxGb: number | undefined,
    environmentMaxGb = Number(process.env.CACHE_MAX_GB),
  ): number {
    if (Number.isFinite(savedMaxGb) && savedMaxGb! > 0) return savedMaxGb!;
    if (Number.isFinite(environmentMaxGb) && environmentMaxGb > 0) {
      return environmentMaxGb;
    }
    return DEFAULT_CACHE_MAX_GB;
  }
  ```

- [ ] Extend `DbSettingsRow` in `lib/db/index.ts` with
  `cacheMaxGb?: number`. In `normalizeDbData`, preserve only finite positive
  values; a malformed historical value must become `undefined` rather than
  making the application fail.

- [ ] Add these explicit query functions to `lib/db/queries.ts`:

  ```ts
  export function getCacheSettings(): {
    cacheMaxGb: number;
    savedCacheMaxGb: number | null;
  }

  export function setCacheMaxGb(cacheMaxGb: number): {
    cacheMaxGb: number;
    savedCacheMaxGb: number;
  }
  ```

  `setCacheMaxGb` must reject non-finite or `<= 0` input with
  `throw new Error('Giới hạn cache phải lớn hơn 0 GB')`, update only
  `db.settings.cacheMaxGb`, call `saveDb()`, and return the effective setting.
  `getCacheSettings` must use `resolveCacheMaxGb` so environment-only
  deployments retain today’s behavior.

- [ ] Re-run the red test and format only these files:

  ```bash
  npx playwright test e2e/cache-storage.spec.ts --grep "prefers a valid"
  npx biome format --write lib/cache/config.ts lib/db/index.ts lib/db/queries.ts e2e/cache-storage.spec.ts
  npx biome check lib/cache/config.ts lib/db/index.ts lib/db/queries.ts e2e/cache-storage.spec.ts
  ```

  Expected: the focused test passes and Biome reports no diagnostics.

- [ ] Commit with `git add lib/cache/config.ts lib/db/index.ts lib/db/queries.ts e2e/cache-storage.spec.ts && git commit -m "feat: persist cache storage limit"`.

## Task 2 — Cache status, shared eviction plan, and safe cleanup

- [ ] **Write the red filesystem tests first** in `e2e/cache-eviction.spec.ts`.
  Use a temporary directory and 64-character hexadecimal keys so tests model
  real cache filenames without risking an unrelated file:

  ```ts
  test('reports cached bytes and plans oldest referenced tracks after orphaned files', async () => {
    const orphanKey = 'a'.repeat(64);
    const olderTrackKey = 'b'.repeat(64);
    const newerTrackKey = 'c'.repeat(64);
    // write each .m4a, age orphan + olderTrack, then call getStorageStatus.
    expect(status.cacheBytes).toBeGreaterThan(0);
    expect(status.evictionPlan.map((entry) => entry.key)).toEqual([
      orphanKey,
      olderTrackKey,
      newerTrackKey,
    ]);
  });

  test('safe cleanup never deletes referenced media or unrelated JSON', async () => {
    const referencedKey = 'd'.repeat(64);
    const orphanKey = 'e'.repeat(64);
    await writeFile(join(dir, `${referencedKey}.m4a`), Buffer.alloc(40));
    await writeFile(join(dir, `${orphanKey}.m4a`), Buffer.alloc(40));
    await writeFile(join(dir, 'tikplay.json'), '{"tracks":[]}');
    // create an old `.part` and old `preview/*.m4a`, then cleanup.
    const result = await cache.cleanupSafe({ referencedKeys: new Set([referencedKey]) });
    await expect(access(join(dir, `${referencedKey}.m4a`))).resolves.toBeUndefined();
    await expect(access(join(dir, 'tikplay.json'))).resolves.toBeUndefined();
    await expect(access(join(dir, `${orphanKey}.m4a`))).rejects.toThrow();
    expect(result.freedBytes).toBeGreaterThan(0);
  });
  ```

  Add one red test showing `evictOld({ maxGb: tinyLimit, ... })` respects its
  per-call override rather than only the constructor setting. Run
  `npx playwright test e2e/cache-eviction.spec.ts` and confirm new cases fail
  due to missing APIs/options.

- [ ] **Implement the minimum cache contracts** in `lib/cache/index.ts`:

  ```ts
  export interface CacheEvictionOptions {
    protectedKeys?: ReadonlySet<string>;
    referencedKeys?: ReadonlySet<string>;
    maxGb?: number;
  }

  export interface CacheStorageEntry {
    key: string;
    size: number;
    mtimeMs: number;
    referenced: boolean;
  }

  export interface CacheStorageStatus {
    cacheBytes: number;
    limitBytes: number;
    freeBytes: number | null;
    minFreeBytes: number;
    isOverLimit: boolean;
    isLowDisk: boolean;
    safeCleanupBytes: number;
    safeCleanupFiles: number;
    evictionPlan: CacheStorageEntry[];
  }

  export interface CacheCleanupResult {
    removedFiles: number;
    freedBytes: number;
  }
  ```

  Add `getStorageStatus(options)` and `cleanupSafe(options)` to
  `FileCacheStore`; add both to `CacheStore` only if existing callers should
  depend on them. Use one internal entry collector and one sort expression:

  ```ts
  entries.sort(
    (a, b) => Number(a.referenced) - Number(b.referenced) || a.mtimeMs - b.mtimeMs,
  );
  ```

  `evictOld` must use that same collector/sort path so UI preview and actual
  eviction agree. Apply `options.maxGb` only when it is finite and `> 0`; use
  `resolveCacheMaxGb`/the existing default otherwise. Retain the existing
  protected-key guarantee.

- [ ] Implement recursive byte accounting for cache-owned files, but only
  classify a root media key as cache-owned when it matches `/^[a-f0-9]{64}$/`.
  Do not treat arbitrary root `.json` files as metadata. This explicitly
  protects Fly deployments where `DB_PATH=/app/cache/tikplay.json`.

- [ ] `cleanupSafe` must remove only:

  ```ts
  // root: stale .part/.tmp/.ytdl (older than STALE_TEMP_TTL_MS)
  // preview/: files older than PREVIEW_TTL_MS
  // orphaned 64-hex .m4a files and their .json/.jpg/.png/.webp/.gif sidecars
  ```

  It must calculate bytes before unlinking, tolerate missing/concurrently
  removed files, and never call `deleteTrack` or any database function.

- [ ] Update `lib/media/processor.ts` inside `prepareCache`:

  ```ts
  const { cacheMaxGb } = getCacheSettings();
  const evictedKeys = await this.cache.evictOld({
    protectedKeys,
    referencedKeys,
    maxGb: cacheMaxGb,
  });
  ```

  Keep the existing `deleteTracksByAudioKeys(evictedKeys)` behavior only for
  pressure-triggered eviction, never for `cleanupSafe`.

- [ ] Run and verify green:

  ```bash
  npx playwright test e2e/cache-eviction.spec.ts
  npx biome format --write lib/cache/index.ts lib/media/processor.ts e2e/cache-eviction.spec.ts
  npx biome check lib/cache/index.ts lib/media/processor.ts e2e/cache-eviction.spec.ts
  ```

- [ ] Commit with `git add lib/cache/index.ts lib/media/processor.ts e2e/cache-eviction.spec.ts && git commit -m "feat: inspect and safely clean cache storage"`.

## Task 3 — Cache API contract

- [ ] **Write red API tests first** in `e2e/cache-storage.spec.ts`:

  ```ts
  test('rejects an invalid cache limit without changing the active setting', async ({ request }) => {
    const response = await request.put('/api/cache', { data: { cacheMaxGb: 0 } });
    expect(response.status()).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      ok: false,
      error: 'Giới hạn cache phải lớn hơn 0 GB',
    });
  });

  test('saves a limit and exposes storage status', async ({ request }) => {
    const update = await request.put('/api/cache', { data: { cacheMaxGb: 2.5 } });
    expect(update.ok()).toBe(true);
    const status = await request.get('/api/cache?protectedTrackIds=1,invalid,2');
    await expect(status.json()).resolves.toMatchObject({
      ok: true,
      cacheMaxGb: 2.5,
      status: { cacheBytes: expect.any(Number), evictionCandidates: expect.any(Array) },
    });
  });
  ```

  Ensure this test records and restores any prior saved cache limit in a
  `try/finally`, so the shared Playwright server remains deterministic. Run the
  focused grep and confirm `/api/cache` is initially 404.

- [ ] Create `app/api/cache/route.ts` with these exact routes:

  - `GET`: parse only positive integer `protectedTrackIds` from a comma
    separated query parameter; read `getDb()` and `getCacheSettings()`; call
    `FileCacheStore.getStorageStatus({ referencedKeys, protectedKeys, maxGb })`;
    join **referenced** plan entries to `DbTrackRow` data; return:

    ```ts
    {
      ok: true,
      cacheMaxGb: number,
      savedCacheMaxGb: number | null,
      status: {
        cacheBytes: number,
        limitBytes: number,
        remainingBytes: number,
        freeBytes: number | null,
        minFreeBytes: number,
        isOverLimit: boolean,
        isLowDisk: boolean,
        safeCleanupBytes: number,
        safeCleanupFiles: number,
        orphanedEntries: number,
        evictionCandidates: Array<{
          trackId: number,
          audioKey: string,
          title: string,
          author: string,
          cover: string,
          size: number,
          mtimeMs: number,
        }>,
      },
    }
    ```

  - `PUT`: safely parse JSON, call `setCacheMaxGb`, then return `GET`’s fresh
    status. Use status 400 for missing, string, infinite, zero, or negative
    values; do not leak a stack trace.
  - `POST /api/cache/cleanup`: call `cleanupSafe({ referencedKeys })`, return
    `{ ok: true, removedFiles, freedBytes, ...freshStatus }`; it must not
    accept a path or a list of files from the browser.

- [ ] Convert filesystem errors into `freeBytes: null`/safe zero totals where
  possible. Unexpected route failures return a Vietnamese 500 message; no
  cleanup response may claim files were removed if unlink failed.

- [ ] Run green and format:

  ```bash
  npx playwright test e2e/cache-storage.spec.ts --grep "cache limit|storage status"
  npx biome format --write app/api/cache/route.ts app/api/cache/cleanup/route.ts lib/cache/status.ts e2e/cache-storage.spec.ts
  npx biome check app/api/cache/route.ts app/api/cache/cleanup/route.ts lib/cache/status.ts e2e/cache-storage.spec.ts
  ```

- [ ] Commit with `git add app/api/cache/route.ts e2e/cache-storage.spec.ts && git commit -m "feat: expose cache storage controls"`.

## Task 4 — Responsive cache-storage dialog and navigation

- [ ] **Write the red UI test first** in `e2e/cache-storage.spec.ts`. Route
  `GET /api/cache`, `PUT /api/cache`, and `POST /api/cache/cleanup` to a deterministic
  status fixture that includes one candidate and safe-cleanup totals. Then test
  actual user actions:

  ```ts
  test('opens the storage manager, saves a limit, and cleans only safe cache data', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Quản lý dung lượng' }).click();
    await expect(page.getByRole('dialog', { name: 'Dung lượng cache' })).toBeVisible();
    await expect(page.getByText('Bài có thể bị dọn tiếp theo')).toBeVisible();
    await expect(page.getByText('Bài kiểm tra')).toBeVisible();
    await page.getByLabel('Giới hạn cache (GB)').fill('2.5');
    await page.getByRole('button', { name: 'Lưu giới hạn' }).click();
    await page.getByRole('button', { name: 'Dọn ngay' }).click();
    await expect(page.getByText(/đã giải phóng/i)).toBeVisible();
  });
  ```

  Add a mobile viewport variant that opens the same labeled button from the
  playlist drawer. Run it and confirm it fails before the dialog exists.

- [ ] Add `HardDriveIcon` in `components/icons.tsx`, matching the existing
  outlined SVG helper. In both `components/Sidebar.tsx` and
  `components/MobileSidebar.tsx`, dynamically import `CacheStorageDialog`, add
  a `showCacheStorage` state, and render a **Quản lý dung lượng** action. The
  mobile action must remain inside its drawer and not change the current view.

- [ ] Create `components/CacheStorageDialog.tsx` as a client component using
  the existing `DialogOverlay`. Set:

  ```tsx
  <section
    role="dialog"
    aria-modal="true"
    aria-label="Dung lượng cache"
    className="... max-h-[min(760px,calc(100dvh-2rem))] ..."
  >
  ```

  Fetch status on mount using current/queue IDs from the established playback
  contexts. Implement one `refresh()` helper, `saveLimit()`, and `cleanNow()`;
  each updates state only while mounted and displays an accessible
  `aria-live="polite"` status message.

- [ ] Render the agreed UI states:

  - loading skeleton/text before GET completes;
  - overview cards for cache used, cache remaining, and disk free;
  - a labeled progress bar with `aria-valuemin="0"`, `aria-valuemax` equal to
    limit bytes, and `aria-valuenow` equal to cache bytes;
  - a warning icon + explicit text for over-limit/low-disk status;
  - a decimal `<input type="number" min="0.1" step="0.1">` labeled
    **Giới hạn cache (GB)**, inline validation, and **Lưu giới hạn**;
  - candidate rows with `Cover` fallback, title/author, size, and relative age;
  - an explicit sentence that candidates are only auto-evicted under space
    pressure, plus an empty state;
  - **Dọn ngay** that is disabled during cleanup and plainly says it removes
    only file rác/tải dở/cache mồ côi, never library tracks.

  Use local pure `formatBytes` and `formatRelativeAge` functions or a small
  exported helper in the same component. Do not poll. Refresh after successful
  PUT/POST. Error responses must remain visible and preserve the previous
  status rather than blanking the dialog.

- [ ] Run green:

  ```bash
  npx playwright test e2e/cache-storage.spec.ts
  npx biome format --write components/CacheStorageDialog.tsx components/Sidebar.tsx components/MobileSidebar.tsx e2e/cache-storage.spec.ts
  npx biome check components/CacheStorageDialog.tsx components/Sidebar.tsx components/MobileSidebar.tsx e2e/cache-storage.spec.ts
  ```

- [ ] Commit with `git add components/CacheStorageDialog.tsx components/icons.tsx components/Sidebar.tsx components/MobileSidebar.tsx e2e/cache-storage.spec.ts && git commit -m "feat: add cache storage manager dialog"`.

## Task 5 — End-to-end regression verification

- [ ] Re-run the full focused change surface, in this order:

  ```bash
  npx playwright test e2e/cache-eviction.spec.ts e2e/cache-storage.spec.ts e2e/library-health.spec.ts
  npx biome check lib/cache/config.ts lib/cache/index.ts lib/db/index.ts lib/db/queries.ts lib/media/processor.ts app/api/cache/route.ts app/api/cache/cleanup/route.ts lib/cache/status.ts components/CacheStorageDialog.tsx components/Sidebar.tsx components/MobileSidebar.tsx e2e/cache-eviction.spec.ts e2e/cache-storage.spec.ts
  npx tsc --noEmit
  ```

  Expected: all focused Playwright tests pass, scoped Biome has no diagnostics,
  and TypeScript emits no errors. If the full project lint has pre-existing
  unrelated failures, report them separately rather than reformatting unrelated
  files.

- [ ] Run `npm run build` if the local environment can access the Google font
  fetches required by Next’s build; otherwise record the network limitation and
  retain the successful typecheck/focused test evidence.

- [ ] Inspect `git diff --check`, `git status --short`, and the diff for only
  the files above. Make a final commit if verification required a small fix;
  otherwise leave the task’s four commits intact.

## Spec coverage matrix

| Spec requirement | Task(s) |
| --- | --- |
| Desktop and mobile sidebar entry; shared responsive modal; server-cache wording | 4 |
| Cache used includes media, artwork, metadata, previews, partial files | 2, 4 |
| Limit progress, remaining budget, disk free, accessible warning | 2, 3, 4 |
| Persist valid positive decimal GB; environment/default fallback | 1, 3 |
| Invalid/non-finite/zero/negative values do not change setting | 1, 3, 4 |
| New lower limit does not immediately delete library tracks; later maintenance enforces it | 1, 2 |
| Preview reflects shared LRU order, explains pressure-only eviction | 2, 3, 4 |
| Preview joins cover/title/author/size/age and has empty state | 3, 4 |
| Current and queued tracks are excluded from preview | 3, 4 |
| “Dọn ngay” removes stale partials, expired previews, and orphan cache/sidecars only | 2, 3, 4 |
| “Dọn ngay” never deletes library DB/media/current/queue data; no confirmation | 2, 3, 4 |
| Cleanup disabled/progress/result then data refresh | 3, 4 |
| Filesystem/API errors remain safe and readable | 2, 3, 4 |
| Existing eviction guarantees and health route remain intact | 2, 5 |
| Focused tests, Biome, TypeScript, build attempt | 1–5 |
