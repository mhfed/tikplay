# AGENTS.md — craw-music

## Project Shape

- Next.js 16 App Router is both UI and API; there is no separate backend service.
- The app extracts TikTok audio with `yt-dlp` + ffmpeg, writes audio/cover/meta to disk cache, and stores library data in JSON.
- Persistence is `data/tikplay.json` through `lib/db/index.ts`; ignore stale SQLite wording in comments such as `lib/db/schema.ts`.
- Main UI entry is `app/page.tsx` -> `components/AppShell.tsx`; API routes live under `app/api/**/route.ts`.

## Commands

- Install/run: `npm install`, then `npm run dev`.
- Lint/format: `npm run lint` runs Biome, `npm run format` writes Biome formatting. Do not use ESLint or Prettier.
- Typecheck: `npx tsc --noEmit` is required; `npm run build` does not enforce TS errors because `next.config.mjs` sets `typescript.ignoreBuildErrors: true` for TS7 native compiler compatibility.
- Build/start standalone: `npm run build`, then `npm run start`.
- E2E: `npm run test:e2e`; focused runs use Playwright directly, e.g. `npx playwright test e2e/global-playback.spec.ts`.

## Runtime Prereqs

- Local TikTok processing needs `ffmpeg` and `yt-dlp` with `curl_cffi`; without `curl_cffi`, TikTok commonly fails with `Requested format is not available`.
- Useful env vars: `CACHE_DIR` defaults to `./cache`, `DB_PATH` defaults to `./data/tikplay.json`, `YTDLP_PATH` defaults to `yt-dlp`.
- Docker/Fly mount persistent storage at `/app/cache`; Fly config also puts `DB_PATH=/app/cache/tikplay.json` so the JSON DB survives restarts.

## Architecture Gotchas

- Playback is global and persistent: `PlaybackProvider` is mounted in `app/layout.tsx`; route-level state in `hooks/useAppStore.tsx` delegates playback to `hooks/usePlayback.tsx`.
- `hooks/useAudioEngine.ts` should only be instantiated by `PlaybackProvider`; route components must not create their own audio element/engine.
- Read `docs/player-architecture.md` before changing playback, keyboard shortcuts, Media Session, queue, seek, volume, speed, or EQ behavior.
- `components/Player.tsx` is dead code and not wired into the app; do not build features against it.
- `app/page.tsx` is `dynamic = 'force-dynamic'` because it reads the JSON DB and shared URL params; do not remove this unless replacing the data flow.
- API data shape differs from disk shape: `DbTrack` uses snake_case fields, frontend `Track` uses camelCase; convert with `toTrack()` in `lib/types.ts`.

## Style And Files

- Biome is configured for single quotes and space indentation; run `npm run format` after edits.
- Use the `@/*` alias for root imports when matching nearby code.
- Client components start with `'use client'`.
- Avoid exploring generated/heavy/non-source paths unless specifically needed: `.next/`, `.venv/`, `cache/`, `data/`, `test-results/`, `.playwright-mcp/`, `worktrees/`, `public/stitch-art/`, `stitch_toktune_music_hub/`, and `docs/superpowers/`.

## Verification Notes

- For most code changes, run `npm run lint` and `npx tsc --noEmit`; add focused Playwright coverage when behavior touches UI or playback.
- Playwright config starts `npm run start`, so run `npm run build` first when no existing dev/start server is available.
- Full TikTok E2E can be slow and network-dependent because it hits real TikTok through yt-dlp.
