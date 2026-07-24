# Multi-platform import plan — Instagram, Facebook, SoundCloud

## 1. Goal

Extend TikPlay's import pipeline so users can paste **Instagram**, **Facebook**, or **SoundCloud** links (in addition to the existing TikTok/YouTube support) and get audio extracted, cached, and added to the library through the same flow as today.

**Explicitly out of scope:**
- Spotify (DRM-protected, cannot be downloaded directly via `yt-dlp`).
- Cookie/auth expansion — Instagram and Facebook support is limited to **public content only**; no per-platform cookie manager is being built in this phase (mirrors the current YouTube-only cookie mechanism, which stays untouched).
- Copyright report flow changes — [`app/api/copyright-reports/route.ts`](app/api/copyright-reports/route.ts:1) already validates `sourceUrl` through the shared [`validateMediaUrl()`](lib/media/source.ts:81), so extending the source union automatically covers new platforms with zero route changes.

## 2. Current architecture (why this is low-risk)

The `MediaSource` union in [`lib/media/source.ts`](lib/media/source.ts:3) is the single source of truth that cascades through the whole stack:

```
UrlInput → validateMediaUrl() → MediaProcessor.process() → yt-dlp/ffmpeg
                                        │
                                        ▼
                            FileCacheStore (sha256 key, source-agnostic)
                                        │
                                        ▼
                     upsertTrack() → DbTrackRow.source (JSON db)
                                        │
                                        ▼
        getAllSources() / getTracksBySource() ← MEDIA_SOURCE_LABELS
                                        │
                                        ▼
                    Sidebar / MobileSidebar / PlaylistView (UI)
```

Because `getAllSources()` in [`lib/db/queries.ts`](lib/db/queries.ts:398) derives the source list from `Object.keys(MEDIA_SOURCE_LABELS)`, and `DbTrack`/`Track`/`MusicSource` in [`lib/types.ts`](lib/types.ts:4) just reference the `MediaSource` type, **most of the backend requires zero structural changes** — only `lib/media/source.ts` and `lib/media/processor.ts` need real logic additions. The rest of the work is UI polish (icons/labels) and fixing one broken hardcoded ternary.

## 3. Backend changes

### 3.1 `lib/media/source.ts` — extend the core abstraction
- Extend the union: `export type MediaSource = 'tiktok' | 'youtube' | 'instagram' | 'facebook' | 'soundcloud';`
- Add host-detection sets:
  - `INSTAGRAM_HOSTS`: `instagram.com`, `www.instagram.com` (+ `.endsWith('.instagram.com')` fallback, matching existing pattern)
  - `FACEBOOK_HOSTS`: `facebook.com`, `www.facebook.com`, `m.facebook.com`, `fb.watch`
  - `SOUNDCLOUD_HOSTS`: `soundcloud.com`, `www.soundcloud.com`, `on.soundcloud.com` (short links)
- Add `MEDIA_SOURCE_LABELS` entries: `instagram: 'Instagram'`, `facebook: 'Facebook'`, `soundcloud: 'SoundCloud'`.
- Add `normalizeInstagramUrl()`, `normalizeFacebookUrl()`, `normalizeSoundCloudUrl()` following the existing pattern in [`normalizeTikTokUrl()`](lib/media/source.ts:33) / [`normalizeYouTubeUrl()`](lib/media/source.ts:54):
  - Instagram: canonicalize `/reel/:id/`, `/p/:id/`, `/tv/:id/` — strip query params/tracking (`igshid`, `utm_*`), force `www.instagram.com` host.
  - Facebook: canonicalize `/watch/?v=:id`, `/reel/:id/`, `/share/*` short links, and `fb.watch/:id` short links — strip tracking params.
  - SoundCloud: strip query params (`si=` share tokens), keep `soundcloud.com/:user/:track` path as-is; resolve `on.soundcloud.com` short links by keeping the URL unchanged (yt-dlp follows redirects itself, no need to pre-resolve).
- Extend `validateMediaUrl()`'s dispatch chain with three new `else if` branches mirroring the existing TikTok/YouTube blocks, and update the final error message to list all supported platforms.

### 3.2 `lib/media/processor.ts` — generalize per-source assumptions
Two TikTok-specific hardcodes need to become source-aware:

- **Format selection** ([`run()`](lib/media/processor.ts:101)): currently
  ```ts
  source === 'tiktok' ? 'download/bestaudio*/best' : 'bestaudio*/best'
  ```
  New sources should use `'bestaudio*/best'` (same as YouTube) — no change needed to the ternary logic itself, just confirm behavior via testing since it already defaults non-TikTok sources correctly.

- **Cover art download** ([`downloadCover()`](lib/media/processor.ts:165)): currently hardcodes a TikTok CDN `Referer` header. Needs to become a small per-source header map (e.g., `Referer: https://www.instagram.com/` for IG-hosted thumbnails, `https://www.facebook.com/` for FB, omit/generic UA for SoundCloud's CDN) so thumbnail hotlink protection doesn't silently break cover downloads for the new sources. Fall back to the existing generic UA-only header set if a source has no special requirement.

- **Error messaging** ([`formatYtDlpError()`](lib/media/processor.ts:227)): currently has YouTube-specific bot-detection copy suggesting cookie refresh. Add a generic fallback message for IG/FB "login required" / "private content" errors (e.g., "Nội dung riêng tư hoặc yêu cầu đăng nhập — hiện chỉ hỗ trợ nội dung công khai") since no cookie fallback exists for these sources — this sets correct user expectations per the public-content-only decision.

- **`getCookiesPath()`** ([lib/media/processor.ts:281](lib/media/processor.ts:281)): **no changes** — stays YouTube-only by design.

### 3.3 No changes needed (confirm via testing only)
- [`app/api/process/route.ts`](app/api/process/route.ts:1) — already fully generic over `MediaSource`.
- [`app/api/sources/route.ts`](app/api/sources/route.ts:1) — validates against `MEDIA_SOURCE_LABELS` keys already.
- [`app/api/copyright-reports/route.ts`](app/api/copyright-reports/route.ts:1) — shared validation, automatically covers new sources.
- [`lib/db/queries.ts`](lib/db/queries.ts:398) `getAllSources()` / `getTracksBySource()` — generic over the type union.
- [`lib/cache/index.ts`](lib/cache/index.ts:74) `FileCacheStore` — keyed by sha256 hash, source-agnostic.
- [`lib/types.ts`](lib/types.ts:4) — type union propagates automatically.

## 4. Frontend changes

### 4.1 Fix broken source-label logic
[`components/PlaylistView.tsx`](components/PlaylistView.tsx:42) hardcodes a binary ternary:
```ts
const sourceLabel = selectedSource
  ? selectedSource === 'youtube' ? 'YouTube' : 'TikTok'
  : null;
```
This mislabels Instagram/Facebook/SoundCloud as "TikTok". Replace with a `MEDIA_SOURCE_LABELS[selectedSource]` lookup imported from `lib/media/source.ts`.

### 4.2 Add distinct icons per platform
[`components/icons.tsx`](components/icons.tsx:233) currently has no brand/platform icons — the sidebar uses one generic `<MusicIcon>` for every source (see [`components/Sidebar.tsx`](components/Sidebar.tsx:163)). Add new icon components (`InstagramIcon`, `FacebookIcon`, `SoundCloudIcon`, and ideally `TikTokIcon`/`YouTubeIcon` too for consistency) following the existing `stroke(size)` helper pattern, or as simple filled brand-mark SVGs. Build a small lookup map (e.g., `SOURCE_ICONS: Record<MediaSource, ComponentType<IconProps>>`) colocated with `MEDIA_SOURCE_LABELS` or in a new `lib/media/sourceIcons.tsx` (client-safe) so both `Sidebar.tsx` and `MobileSidebar.tsx` can reuse it.

### 4.3 Wire icons into source lists
- [`components/Sidebar.tsx`](components/Sidebar.tsx:163) — replace `<MusicIcon size={16} />` in the "Nguồn" list with `SOURCE_ICONS[s.slug]`.
- [`components/MobileSidebar.tsx`](components/MobileSidebar.tsx:1) — same pattern, mirror whatever the source-list markup looks like there.

### 4.4 Update copy/placeholders mentioning only TikTok/YouTube
Files with hardcoded TikTok/YouTube references found via search, needing generalized copy (e.g., "Dán link TikTok, YouTube, Instagram, Facebook hoặc SoundCloud..." or a more generic "Dán link nhạc/video..."):
- [`components/UrlInput.tsx`](components/UrlInput.tsx:1) — placeholder text + aria-labels.
- [`components/Home.tsx`](components/Home.tsx:1)
- [`components/PlayerPanel.tsx`](components/PlayerPanel.tsx:1)
- [`components/TrackList.tsx`](components/TrackList.tsx:1)
- [`components/TermsDialog.tsx`](components/TermsDialog.tsx:1) — verify if legal copy needs to mention new source platforms.
- [`components/Cover.tsx`](components/Cover.tsx:1) — comment-only reference, low priority.

`components/Player.tsx` is dead code (per [`docs/player-architecture.md`](docs/player-architecture.md:1)) — skip it.

## 5. Explicit scope exclusions (confirmed with stakeholder)

| Area | Decision |
|---|---|
| Spotify | Excluded — DRM prevents direct download; SoundCloud chosen instead |
| Instagram/Facebook auth | Public content only — no cookie manager expansion |
| Copyright report flow | No changes — shared validation already covers new sources |
| Icons/labels | Required — distinct per-platform icon + label, not generic MusicIcon |

## 6. Delivery phases

1. **Core validation layer** — extend `MediaSource` union, host sets, normalize functions, and `validateMediaUrl()` dispatch in `lib/media/source.ts`. Add unit coverage for URL normalization edge cases per platform (share links, short links, tracking params).
2. **Processor generalization** — per-source cover-art headers, generalized error messaging in `lib/media/processor.ts`. Manually verify each platform's public-content download end-to-end locally (`yt-dlp` extractor support check first — confirm `yt-dlp --list-extractors` includes stable `instagram`, `facebook`, `soundcloud` extractors on the pinned version).
3. **Instagram support** — end-to-end test with a public reel/post URL through `/api/process`.
4. **Facebook support** — end-to-end test with a public video/reel URL.
5. **SoundCloud support** — end-to-end test with a public track URL.
6. **UI polish** — fix `PlaylistView.tsx` ternary, add platform icons to `icons.tsx`, wire into `Sidebar.tsx`/`MobileSidebar.tsx`, update placeholder copy across components listed in §4.4.
7. **Testing & verification** — `npm run lint`, `npx tsc --noEmit`, extend/add Playwright coverage (see §7), manual smoke test of the "Nguồn" sidebar filter with all 5 sources populated.

## 7. Testing notes

- [`e2e/tiktok-player.spec.ts`](e2e/tiktok-player.spec.ts:1) uses CSS selectors (`.url-input__field`, `.btn--primary`, `.player--active`, `.player__title`, `.url-input__error`) that look like they predate the current Tailwind-utility-class-based `UrlInput.tsx`/`PlayerPanel.tsx` markup. **Verify this test still passes before using it as a template** — if it's already stale, fix it alongside adding new-platform coverage rather than copying broken patterns forward.
- New platform e2e tests should follow whatever selector strategy is actually valid today (check `data-testid` attributes or current class names in the live components first).
- Given `/api/process` hits real external services via `yt-dlp`, keep new-platform e2e tests tagged/separated similarly to how TikTok e2e is likely already isolated from the default fast test run (confirm via `playwright.config.ts` project setup).

## 8. Risks / open questions to validate during implementation

- **yt-dlp extractor stability**: Instagram and Facebook extractors are historically more fragile against anti-scraping changes than TikTok/YouTube's. Public-content-only scope reduces exposure but doesn't eliminate breakage risk — monitor `yt-dlp` upstream issues for these extractors.
- **SoundCloud client_id rotation**: `yt-dlp`'s SoundCloud extractor depends on a public API `client_id` that SoundCloud rotates periodically; yt-dlp self-updates handle this in most cases, but worth a note in `README.md`'s environment/runtime section if it becomes a recurring failure mode.
- **Rate limiting**: existing `/api/process` rate limit (10 req/10min/IP) applies uniformly across all sources — no per-source tuning planned, but worth confirming this is still adequate once multiple platforms increase overall import volume.
