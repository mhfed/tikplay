# CLAUDE.md — craw-music

Web phát nhạc từ URL TikTok: dán link → yt-dlp + ffmpeg extract audio → cache trên đĩa → phát trên player.
Next.js App Router làm **cả frontend lẫn API** (không có backend riêng).

## Tech stack (KIỂM CHỨNG từ package.json — dùng đúng version này)

- **Next.js 16** (App Router) + **React 19** + **TypeScript 7** (native compiler / `tsgo`)
- **Biome 2.5** cho lint + format — KHÔNG dùng ESLint/Prettier
- Store: **React Context tự viết** (`hooks/useAppStore.tsx`) — KHÔNG có Redux/Zustand
- Persistence: **file JSON `data/tikplay.json`** — KHÔNG phải SQLite (dù comment/`lib/db/schema.ts` còn ghi "SQLite"; đó là mô tả cũ)
- Test: **Playwright** e2e. Không có unit test.
- Deploy: Docker `output: standalone` → Fly.io (volume mount `/app/cache`)

## Lệnh thường dùng

```bash
npm run dev        # next dev
npm run lint       # biome check
npm run format     # biome format --write
npm run test:e2e   # playwright test
npx tsc --noEmit   # ⚠️ CÁCH DUY NHẤT để typecheck (xem gotcha bên dưới)
npm run build      # next build (standalone) — KHÔNG bắt lỗi type
```

## Gotchas quan trọng (đọc trước khi sửa code)

1. **Typecheck bằng `npx tsc --noEmit`, KHÔNG dựa vào `npm run build`.**
   `next.config.mjs` đặt `typescript.ignoreBuildErrors: true` vì TS7 native compiler
   chưa tương thích typecheck lúc build của Next. Build "pass" ≠ code type-safe.

2. **DB là JSON file**, đọc/ghi qua `lib/db/index.ts` (`data/tikplay.json`).
   Bỏ qua tên "SQLite" trong comment — không có SQL, không có driver.

3. **yt-dlp cần `curl_cffi`** (impersonation), nếu không TikTok báo
   `Requested format is not available`. Xem README để setup local.

4. **Kiến trúc player** (audio engine, store, keyboard shortcut, Media Session):
   đọc `docs/player-architecture.md` TRƯỚC khi đụng vào playback.
   Lưu ý: file đó ghi "Next 14/React 18" là SAI — thực tế là Next 16/React 19.

## Convention code

- Biome: **single quotes**, **space indent**. Chạy `npm run format` sau khi sửa.
- Import alias: `@/*` → root. VD `import { Track } from '@/lib/types'`.
- Kiểu dữ liệu tập trung ở `lib/types.ts`. `DbTrack` (snake_case, on-disk) vs
  `Track` (camelCase, frontend) — convert bằng `toTrack()`.
- Component client bắt đầu bằng `'use client'`.

## Bản đồ code

```
app/            # pages (page.tsx, layout.tsx) + API routes
  api/          # process (extract), audio/[key] (stream), tracks, playlists, favorites, auto-rules
components/     # UI React (AppShell, PlayerPanel, MiniPlayer, TrackList, Sidebar, ...)
hooks/          # useAppStore (context store), useAudioEngine (<audio> + Web Audio), useLocalStorage
lib/
  tiktok/validate.ts   # validate URL, cacheKey = sha256(url)
  cache/index.ts       # FileCacheStore (TTL + LRU)
  media/processor.ts   # yt-dlp + ffmpeg, debounce request trùng
  db/index.ts          # đọc/ghi data/tikplay.json
  types.ts             # tất cả interface
```

## ⛔ KHÔNG đọc/khám phá các thư mục sau (tốn token, không phải source)

- `stitch_toktune_music_hub/` (5MB HTML mockup thiết kế) — chỉ tham khảo khi user yêu cầu rõ
- `public/stitch-art/` (2.7MB ảnh)
- `.venv/`, `cache/`, `data/`, `.next/`, `test-results/`, `.playwright-mcp/`, `worktrees/`
- `docs/superpowers/` (plan/spec cũ)
- `components/Player.tsx` — **dead code**, không được wire vào đâu. Đừng build dựa trên file này.
