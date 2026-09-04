# Cache storage manager

**Date:** 2026-09-04
**Status:** agreed design, ready for implementation

## Goal

Give the user a clear, safe way to understand and manage the server-side media
cache used by TikPlay. They can see usage and free space, set a persistent
cache limit, inspect the eviction order, and immediately remove only safe
cache debris.

## User-facing behaviour

### Entry point

- Add **Quản lý dung lượng** to the action area of both the desktop and mobile
  sidebars.
- It opens one responsive modal, shared by both layouts, titled **Dung lượng
  cache**.
- The modal explicitly describes this as the downloaded-media cache on the
  machine running TikPlay, so it is not confused with browser offline files.

### Storage overview

The modal shows:

- Total cache currently in use, including audio, artwork, metadata, previews,
  and partial downloads.
- Current cache limit, with a progress bar and a `used / limit` label.
- Remaining room before the cache limit and free space on the underlying disk.
- A warning state when the cache is above its limit or the disk is below the
  configured free-space reserve.

Values are formatted in human-readable MB/GB and retain an accessible textual
equivalent; color is never the only warning signal.

### Cache limit

- The modal contains a numeric GB input and an explicit **Lưu giới hạn**
  button.
- A valid positive decimal limit is persisted in the JSON database and takes
  effect for subsequent automatic cache maintenance in the current server
  process.
- Until the user saves a value, the existing `CACHE_MAX_GB` environment value
  (or its existing default) remains the effective limit.
- Saving a lower limit does not delete library tracks immediately. The modal
  refreshes its warning and eviction preview; normal maintenance before/after
  later downloads enforces the new limit.
- Invalid, zero, negative, or non-finite input is rejected inline and does not
  change the active setting.

### Eviction preview

- Display a compact list headed **Bài có thể bị dọn tiếp theo**.
- It contains cached library tracks in the same safe eviction order used by
  automatic maintenance: oldest cached item first, while prioritising orphan
  cache entries before library tracks internally.
- Each listed track shows cover fallback, title, creator when available, cache
  size, and how long ago its cache file was used/updated.
- The currently playing track and queued tracks are excluded when the client
  supplies them. The modal explains that these items are only a preview:
  eviction occurs when capacity or disk-free-space pressure requires it.
- If no cached library track is eligible, show a clear empty state.

### “Dọn ngay” (confirmed safety contract)

Clicking **Dọn ngay** removes only data that is safe to delete:

- stale partial-download files (`.part`, `.tmp`, `.ytdl`),
- expired preview files,
- cache media and sidecars not referenced by any library track.

It must never delete a database track, a cached file belonging to a library
track, the current track, or queued tracks. No confirmation dialog is needed
because the operation is non-destructive to the user library. While running,
the button is disabled and announces progress. On completion, show the number
of files removed and bytes reclaimed, then refresh all values and the preview.

## Technical design

### Persistent settings

- Extend the JSON database settings shape with an optional `cacheMaxGb` value
  and migration-safe normalisation for older databases.
- Add queries that return the effective cache configuration and safely save a
  validated user-selected cache limit.
- Preserve existing environment defaults for deployments that do not use the
  UI setting.

### Cache service

- Extend `lib/cache/index.ts` with read-only status and eviction-planning
  helpers. They calculate recursive cache bytes, filesystem free bytes, the
  effective limit, and removable safe-debris bytes without changing files.
- Make automatic eviction read the effective persisted limit rather than only
  the constructor-time environment value, while retaining the existing
  `CACHE_MIN_FREE_MB` reserve.
- Share the ordering logic between the preview and eviction implementation so
  the UI does not promise a different order from actual maintenance.
- Keep all file-system errors fail-safe: an unavailable cache directory or
  filesystem statistic becomes a reported unavailable value rather than a
  failed page or an unsafe cleanup.

### API

Add a focused cache API rather than overloading the health-check route:

- `GET /api/cache`: returns cache/disk statistics, effective limit, safe
  cleanup estimate, health warning state, and eviction preview. It accepts the
  current and queued track IDs/keys so they can be protected in the preview.
- `PUT /api/cache`: validates and persists `{ cacheMaxGb }`, then returns the
  refreshed status.
- `POST /api/cache/cleanup`: runs the safe cleanup contract and returns
  `{ removedFiles, freedBytes }` plus refreshed status.

All mutating routes validate JSON input, return a useful 4xx response for
invalid data, and never accept arbitrary filesystem paths from the browser.

### UI composition

- Add `CacheStorageDialog` with loading, error, empty, warning, saving, and
  cleaning states.
- Reuse the existing `DialogOverlay` visual language and add a storage icon in
  both sidebars through dynamic imports.
- Fetch fresh status when opening and after saving/cleaning. Avoid polling.
- Format byte values and relative times through small testable helpers rather
  than duplicating logic in JSX.

## Acceptance criteria

1. A user can open the cache manager from desktop and mobile navigation.
2. It accurately shows cache bytes, disk-free bytes, effective GB limit, and
   remaining cache budget when the filesystem supplies those values.
3. Changing and saving a valid GB limit survives a server restart and affects
   the next automatic cache-maintenance run.
4. The preview follows the automatic eviction ordering and excludes tracks
   protected by current playback or the queue.
5. **Dọn ngay** never removes a library track or its cache data; it only
   removes stale partials, expired previews, and orphaned cache files.
6. After cleanup, the UI reports reclaimed bytes/files and refreshes values.
7. Invalid input and filesystem/API failures produce readable errors without
   breaking the modal.
8. Existing cache eviction guarantees and health-check behaviour remain
   intact.

## Verification

- Add focused cache-service tests for statistics, effective-setting precedence,
  planned eviction order, and safe cleanup boundaries.
- Add API tests for status, validation, persistence, and safe cleanup result.
- Add focused Playwright coverage for opening the modal, saving a limit,
  displaying the candidate list, and running **Dọn ngay** without deleting a
  library track.
- Run Biome on touched files, `npx tsc --noEmit`, focused tests, and the
  project verification suite permitted by the local environment.

## Out of scope

- Deleting library tracks manually from this dialog.
- Forcing eviction of saved tracks when a user lowers the limit.
- Managing browser offline/OPFS files, which remains in the separate offline
  manager.
- Changing the existing minimum-free-disk environment setting.
