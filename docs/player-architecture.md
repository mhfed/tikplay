# Player architecture (quick reference)

Tech stack: Next.js 16 App Router + React 19 + TypeScript, functional components/hooks, custom context store (no Redux/Zustand), no keyboard-shortcut library.

## Where things live

- **`hooks/usePlayback.tsx`** — persistent playback runtime mounted once by the root layout. It owns the current track, queue/index, play state, shuffle/repeat, volume/speed/EQ, and the single audio engine used across every route.
  - `usePlayback()` exposes playback state/actions without high-frequency timeline updates.
  - `useGlobalAudioEngine()` exposes the engine snapshot to `PlayerPanel` only.
- **`hooks/useAppStore.tsx`** — route-level library state via React context (`AppStoreProvider` / `useAppStore()`). Playlist/search/favorite state remounts with a route; playback fields and actions delegate to `usePlayback()` and remain global.
- **`hooks/useAudioEngine.ts`** — the single media element + Web Audio graph (EQ filters, gain, limiter). Instantiated only by `PlaybackProvider`, never by route components.
  - `audioRef`, `play()`, `pause()`, `toggle()` (toggles off `audio.paused`, independent of store `isPlaying`)
  - `seek(time)`, `setVolume(v)`, `setSpeed(s)`, `toggleMute(volume, setVolume)` (remembers last volume in a ref)
  - `currentTime`, `duration`, `isReady`
- **`components/PlayerPanel.tsx`** — route-level player UI consuming the persistent engine. It can unmount/remount during navigation without interrupting playback.
  - Play/pause button: `togglePlay` — Prev/Next: `prev`/`next` — Shuffle/Repeat: `setShuffle`/`cycleRepeat`
  - Seek `<input type="range">` → `engine.seek(...)` — Volume `<input type="range">` (0–3) → `setVolume(...)`, mute button → `engine.toggleMute(volume, setVolume)`
  - Media Session (lock-screen) handlers already exist here (lines ~116–142) — good reference for calling engine/store actions outside a click handler.
  - Global `keydown` shortcut handler lives here too (space=play/pause, arrows=seek/volume, etc. — see inline comment for the full list).
- **`components/MiniPlayer.tsx`** — secondary mobile play/pause + next, just calls the same store actions, no own audio logic.
- **`components/Player.tsx`** — dead code, prop-driven, not imported/wired anywhere. Don't build against it.

## Gotchas

- Global keyboard handlers must skip when `e.target` is an `INPUT`/`TEXTAREA`/`SELECT`/`contentEditable`/`BUTTON`/`A` element, so typing and native button-activation (native Space/Enter click) aren't hijacked. `preventDefault()` on a keydown Space suppresses the browser's native synthetic click for a focused button, so skipping BUTTON/A avoids fighting dialogs (Cancel/Save) and other icon buttons.
- Changing `currentTrack.audioUrl` is synchronized to the media deck inside `PlaybackProvider`; route components must not create or directly own an audio engine.
- Media Session handlers use explicit `play()`/`pause()`, not `toggle()`, because the OS can pause the element without the store knowing (e.g. lock screen); a toggle from there could invert intent.
