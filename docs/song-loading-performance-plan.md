# Song loading performance plan

## 1. Goal

Make playback feel immediate without downloading the library or adjacent songs aggressively. Optimize the entire path from page load and track selection to the first audible frame, while preserving the single persistent audio engine and reliable seeking/recovery.

This plan deliberately separates metadata loading, artwork loading, and audio streaming because they have different cache, priority, and memory requirements.

## 2. Current flow

1. `app/page.tsx` reads and serializes every track for the selected library into the initial React payload.
2. `AppStoreProvider` keeps the complete track objects in client state. Playlist/category/source changes fetch and replace complete arrays.
3. `TrackList` mounts every `TrackRow`; each row mounts a lazy image, but the DOM and React work still scale linearly with the library.
4. Selecting a track updates global playback state. `PlaybackProvider` assigns the track URL to one persistent `HTMLAudioElement` configured with `preload="metadata"`, then calls `play()`.
5. `/api/audio/[key]` supports byte ranges correctly, but returns `Cache-Control: private, no-store` for both full and partial responses.
6. `/api/cover/[key]` reads the entire cover into memory and also returns `private, no-store`.
7. The service worker bypasses all `/api/` requests and therefore cannot compensate for the disabled HTTP cache.
8. Session restoration fetches the complete `/api/tracks` collection just to resolve the saved current track and queue IDs.

## 3. Main bottlenecks

### P0 — media caching is disabled

Audio and cover URLs are content-addressed by a SHA-256 key, so their bytes are immutable. Returning `no-store` forces repeated validation/download work across navigation, replay, recovery, and future visits. This contradicts the service-worker comment that describes an immutable HTTP cache.

### P0 — unbounded metadata and UI work

The initial server payload, API response size, client memory, filtering/sorting, provider updates, React reconciliation, DOM nodes, and image requests all grow with the full library. This is the likely source of “loads too much” even before audio starts.

### P0 — no playback latency telemetry

There is no measurement for click-to-audio, metadata readiness, stalls, range request behavior, cache hits, or wasted transfers. Optimization cannot be safely validated without these signals.

### P1 — no request ownership or cancellation for audio intent

Changing tracks updates the element source, which usually cancels the old media fetch in the browser, but the application does not explicitly model loading generations, timeout/error states, or stale readiness events. Rapid next/previous actions can waste work and create ambiguous UI state.

### P1 — session restore reloads the whole catalog

Restoration calls `/api/tracks` and reconstructs the queue from the complete response. It should fetch only the saved IDs, with a bounded maximum queue size.

### P1 — mutation flows refetch several full resources

Import and deletion can reload tracks, playlists, categories, and sources. This increases latency and causes avoidable rerenders. Most mutations already return enough information for local patches or can return a compact aggregate delta.

### P2 — no controlled next-track warmup

There is no intentional preload policy. The current track starts cold, while a naive fix could overcorrect by downloading many songs. Warmup must be constrained by user intent, connection quality, visibility, and a byte/time budget.

## 4. Performance budgets

Collect p50 and p95 separately for desktop, mobile, cached, and cold paths.

| Metric                                             | Target                                                                |
| -------------------------------------------------- | --------------------------------------------------------------------- |
| Track click to `playing`, warm local cache         | p95 < 150 ms                                                          |
| Track click to `playing`, cold local server        | p95 < 500 ms                                                          |
| Track click to `playing`, typical deployed network | p95 < 1,000 ms                                                        |
| Next-track gap when warmup is eligible             | p95 < 200 ms                                                          |
| Initial track metadata payload                     | <= 50 items and <= 75 KB compressed                                   |
| Mounted track rows                                 | <= visible rows + 10-row overscan                                     |
| Speculative audio                                  | At most one next candidate                                            |
| Speculative transfer budget                        | Initial range only; target <= 512 KB                                  |
| Wasted audio after rapid track change              | < 256 KB per abandoned selection where browser reporting is available |
| Playback stall ratio                               | < 0.5% of listening time on stable broadband                          |
| Main-thread long tasks while opening library       | No task > 100 ms; p95 interaction < 200 ms                            |

The final thresholds should be calibrated against an initial production baseline, but the bounded payload and speculative-load limits are hard constraints.

## 5. Target architecture

### 5.1 Paginated metadata, stable queue descriptors

Add cursor pagination to track-list APIs:

- `GET /api/tracks?cursor=<opaque>&limit=50&q=...&sort=...`
- Response: `{ tracks, nextCursor, total, revision }`.
- Enforce `limit <= 100` server-side.
- Return compact list records. Keep fields required only by editing/detail views out of the list response where practical.
- For playlists, favorites, categories, and sources, use the same page contract instead of separate unbounded response shapes.

Do not define playback queue as only the currently rendered page. Introduce a lightweight queue descriptor:

```ts
type QueueSource = {
  kind: 'library' | 'playlist' | 'favorites' | 'category' | 'source' | 'search';
  key?: string | number;
  sort: TrackSort;
  revision: string;
};
```

The client keeps loaded pages plus the ordered IDs it knows. When playback approaches the end of loaded IDs, it fetches the next metadata page. This preserves sequential play without downloading the whole catalog up front.

For the JSON database, cursor pagination can initially be implemented after in-process sorting. This does not reduce server CPU yet, but it immediately reduces wire payload, hydration, browser memory, and rendering work. A later storage migration can optimize server query complexity independently.

### 5.2 Virtualized track rendering

Virtualize the library list so only the viewport plus small overscan is mounted.

Requirements:

- Fixed or measured row height with stable keys.
- Overscan around 8–12 rows.
- Preserve keyboard accessibility and active-track focus.
- Integrate drag-and-drop only for loaded playlist ranges. If arbitrary full-playlist reordering is required, use a dedicated reorder mode rather than disabling virtualization globally.
- Infinite loading should begin near the end of the loaded range, not when every row is mounted.
- Memoize rows and pass stable callbacks so timeline/player changes do not rerender the catalog.

Prefer a small, proven virtualization package already compatible with React 19. If adding a dependency is undesirable, a fixed-height window can be implemented locally, but accessibility and dynamic mobile sizing must be tested carefully.

### 5.3 Immutable media caching

Audio and cover keys identify immutable content. Return:

```http
Cache-Control: public, max-age=31536000, immutable
ETag: "<content-key>"
Accept-Ranges: bytes
```

For audio range responses, preserve `206`, `Content-Range`, and exact `Content-Length`. Respond to `If-None-Match` where it is useful for full resources. Do not put authentication-dependent media under public immutable caching; if legal blocking must take effect immediately, use one of these explicit policies:

1. Keep content-addressed media publicly cacheable and accept that already cached bytes cannot be revoked instantly.
2. Add a mutable authorization/version layer to URLs and rotate the URL when access changes.
3. Use shorter browser/CDN TTLs as a legal-policy compromise.

This decision must be made deliberately. `no-store` should not remain as an accidental default.

Stream covers rather than reading the complete file into a buffer. Add `X-Content-Type-Options: nosniff` to media responses. Avoid service-worker audio caching initially: browser HTTP range caching is simpler and less error-prone. The service worker should continue bypassing audio until a range-aware cache implementation is justified by measurements.

### 5.4 Explicit playback loading state machine

Extend the audio engine snapshot with:

```ts
type LoadState =
  | { status: 'idle' }
  | { status: 'loading'; generation: number; startedAt: number }
  | { status: 'ready'; generation: number }
  | { status: 'playing'; generation: number }
  | { status: 'stalled'; generation: number; since: number }
  | { status: 'error'; generation: number; code?: number };
```

Use media events consistently:

- `loadstart`: loading
- `loadedmetadata`: metadata available, not necessarily playable
- `canplay`: ready
- `playing`: first audible playback and startup metric completion
- `waiting`/`stalled`: buffering
- `error`: terminal or retryable error
- `abort`/`emptied`: expected during source replacement

Every event handler must validate the active generation. On track change:

1. Increment generation and invalidate all pending play requests.
2. Pause the element.
3. Set the new source once.
4. Keep `preload="metadata"` as the idle default.
5. Call `play()` only for the active generation and direct user intent.
6. Surface a lightweight spinner only after roughly 120–150 ms to prevent flicker.
7. Show a retry action after a bounded timeout/error rather than spinning indefinitely.

Do not fetch an audio blob through application JavaScript and assign an object URL. That breaks efficient browser range streaming, duplicates memory, complicates cancellation, and makes large tracks expensive.

### 5.5 Intent-aware warmup

Warm at most one probable next track. Use a detached secondary `HTMLAudioElement` only for metadata/initial range warmup; never connect it to the Web Audio graph.

Eligibility:

- Current track is playing and stable.
- Queue next candidate is deterministic; disable for shuffle unless a candidate has already been chosen.
- Document is visible.
- `navigator.connection.saveData !== true`.
- Effective connection is not `slow-2g` or `2g`.
- Battery/memory pressure signals, where available, do not advise against it.
- Current track has at least 20–30 seconds buffered or playback is within the final 20 seconds.

Policy:

- Start with `preload="metadata"` only.
- Measure whether browser HTTP caching makes the next selection faster.
- Promote to a bounded initial-range warmup only if metadata warmup is insufficient and it can be implemented without downloading the complete song.
- Cancel/remove the warmup source on queue change, manual selection, page hide, or data-saver transition.
- Never preload the entire queue.

A dual-deck gapless player is out of scope for phase one. It doubles media-element complexity and Web Audio routing. Consider it only after the cache/pagination work meets budgets and measured transition gaps still require it.

### 5.6 Compact restore and mutation paths

Add a batch endpoint such as `GET /api/tracks/by-ids?ids=1,2,3`, with validation, stable input order, and a hard maximum (for example 100 IDs). Persist only a bounded queue window around the current track rather than every queue ID.

For mutations:

- Patch track/favorite/playlist state locally from the mutation response.
- Return changed category/source counts as compact deltas if needed.
- Revalidate only the affected page when local reconciliation is unsafe.
- Add `AbortController` ownership to playlist/search/category/source metadata requests so stale responses cannot overwrite the newest selection.
- Debounce server-side search; keep instant local filtering only within already loaded pages and label its semantics clearly.

## 6. Delivery phases

### Phase 0 — baseline instrumentation

Files likely involved: `hooks/useAudioEngine.ts`, `hooks/usePlayback.tsx`, `app/api/audio/[key]/route.ts`, and a small telemetry utility.

- Add development performance marks for `track-select`, `loadstart`, `loadedmetadata`, `canplay`, and `playing`.
- Record startup duration, stall count/duration, error code, track-change generation, connection type, and whether navigation entry suggests a cache transfer.
- Add `Server-Timing` for audio route file lookup and response setup.
- In development, log range start/end and response bytes behind an environment flag. Never log user source URLs.
- Capture baseline with libraries of 50, 500, and 5,000 synthetic metadata records.

Exit criterion: baseline report exists and metrics are reproducible.

### Phase 1 — highest-return, low-risk fixes

- Replace accidental `no-store` media headers with the chosen immutable/legal cache policy.
- Stream covers and add immutable validators.
- Add loading generations and an explicit engine load state.
- Add metadata request cancellation.
- Replace complete-catalog session restoration with bounded batch lookup.
- Stop broad post-mutation refetches where mutation responses can patch state.

Exit criterion: repeat playback is served from browser cache where allowed; rapid next/previous never reports stale readiness; no full-catalog restore fetch.

### Phase 2 — bounded catalog loading

- Implement cursor pagination across library scopes.
- Seed only the first page into the server-rendered initial data.
- Add queue descriptors and on-demand page extension.
- Virtualize `TrackList` and memoize rows.
- Ensure active/current tracks not present in the visible page are still available to the player through the global playback store.

Exit criterion: initial payload and mounted rows remain within budget at 5,000 tracks; sequential playback crosses page boundaries correctly.

### Phase 3 — conservative next-track warmup

- Add one-candidate metadata warmup.
- Gate it using connection/data-saver/visibility rules.
- Compare transition p95 and transferred bytes against phase 2.
- Enable bounded initial-range warmup only if measurements justify it.

Exit criterion: transition p95 improves without violating speculative byte limits or increasing stall rate.

### Phase 4 — hardening and rollout

- Add feature flags for pagination/virtualization and warmup independently.
- Roll out cache headers first, then paginated UI, then warmup.
- Monitor startup p95, errors, stalls, response bytes, and API latency.
- Keep a fast rollback path that disables warmup without reverting the core cache and pagination improvements.
- Remove old unbounded endpoint usage after one stable release.

## 7. Verification strategy

### Unit tests

- Range parser: standard, open-ended, suffix, malformed, and unsatisfiable ranges.
- Pagination cursors: stable ordering, duplicate prevention, end-of-list behavior, invalid cursors.
- Queue page extension and bounded restored queue.
- Warmup eligibility for data saver, weak connections, shuffle, hidden documents, and queue changes.
- Loading generation ignores stale events.

### API/integration tests

- Audio full request returns `200`, exact length, immutable policy, and range support.
- Valid range returns `206` with exact `Content-Range` and bytes.
- Cover responses stream with correct type, length, validator, and cache policy.
- Batch-by-ID endpoint enforces limits and preserves order.
- Track-list endpoints never exceed the server page limit.

### Playwright tests

- First play reaches `playing` and exposes the correct loading UI.
- Rapidly click A → B → C; only C plays and A/B cannot flip readiness state.
- Next crosses a metadata page boundary.
- Replay and revisit do not cause a full media transfer when caching is enabled.
- Data saver/2G disables warmup (mock connection API where supported).
- Virtualized rows support keyboard navigation and active-track indication.
- Navigation does not recreate the global audio element or interrupt playback.

### Manual profiling

- Chrome DevTools network: verify range requests, transfer size, memory-cache/disk-cache behavior, and request cancellation.
- Performance panel: compare long tasks and React commits at 50/500/5,000 tracks.
- Mobile Safari: lock/unlock, background/foreground, Bluetooth controls, and interrupted AudioContext recovery.
- Throttled Fast 3G and offline transitions.

Required commands after implementation:

```bash
npm run format
npm run lint
npx tsc --noEmit
npm run build
npx playwright test e2e/global-playback.spec.ts e2e/playback-persistence.spec.ts
```

Add focused performance/loading specifications rather than making the network-dependent TikTok import suite a blocker for every iteration.

## 8. Observability and privacy

Use aggregate technical events only:

- `audio_startup_ms`
- `audio_metadata_ms`
- `audio_stall_ms` and `audio_stall_count`
- `audio_error_code`
- `audio_range_bytes`
- `catalog_payload_bytes` and item count
- `mounted_track_rows`
- `warmup_started`, `warmup_used`, `warmup_cancelled`, and approximate bytes

Identify tracks with an internal numeric ID or one-way hash, not the original TikTok/YouTube URL. Sample successful sessions; retain all errors at a bounded rate. Development logging must be removable or disabled in production.

## 9. Risks and explicit non-goals

- **Legal revocation vs immutable caching:** resolve policy before changing production TTLs.
- **Range caching varies by browser/CDN:** verify real behavior; do not assume all partial responses combine into one cache entry.
- **Virtualization and drag/drop conflict:** use a dedicated reorder mode if necessary.
- **JSON DB scalability:** pagination reduces client cost but does not make JSON persistence suitable for unlimited multi-user scale.
- **No blob prefetching:** avoid full-file fetches and object URLs.
- **No queue-wide preload:** it directly conflicts with the lightweight requirement.
- **No second Web Audio engine:** preserve the single global engine architecture.
- **No premature gapless playback:** optimize startup and transitions with caching first.

## 10. Recommended first implementation slice

The first pull request should stay reviewable and deliver immediate value:

1. Add playback performance marks and load-state generations.
2. Add audio/cover cache policy constants with documented legal semantics.
3. Stream cover files and add validators/security headers.
4. Add bounded batch track lookup for session restoration.
5. Add abortable metadata loads.
6. Add tests for range headers, stale playback events, and restore lookup.

The second pull request should implement pagination plus virtualization. The third should add conservative next-track warmup only after before/after telemetry proves that it is needed.
