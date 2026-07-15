# Player architecture (quick reference)

Tech stack: Next.js 16 App Router + React 19 + TypeScript, functional components/hooks, custom context store (no Redux/Zustand), no keyboard-shortcut library.

## Where things live

- **`hooks/useAppStore.tsx`** — global playback state via React context (`AppStoreProvider` / `useAppStore()`).
  - `isPlaying` state, `togglePlay()`, `setPlaying(bool)` (explicit setter for Media Session handlers)
  - `next()`, `prev()`, `volume`, `setVolume(v)` (0–3, values above 1 are a gain boost)
  - `shuffle`, `setShuffle(bool)`, `repeat`, `cycleRepeat()`
- **`hooks/useAudioEngine.ts`** — the actual `<audio>` element + Web Audio graph (EQ filters, gain, limiter). Instantiated locally inside `PlayerPanel` via `useAudioEngine()`, not in the global store.
  - `audioRef`, `play()`, `pause()`, `toggle()` (toggles off `audio.paused`, independent of store `isPlaying`)
  - `seek(time)`, `setVolume(v)`, `setSpeed(s)`, `toggleMute(volume, setVolume)` (remembers last volume in a ref)
  - `currentTime`, `duration`, `isReady`
- **`components/PlayerPanel.tsx`** — the component where store + engine are wired together. This is the natural place to hook new playback behavior (e.g. keyboard shortcuts) since it has both `engine` and the store actions in scope.
  - Play/pause button: `togglePlay` — Prev/Next: `prev`/`next` — Shuffle/Repeat: `setShuffle`/`cycleRepeat`
  - Seek `<input type="range">` → `engine.seek(...)` — Volume `<input type="range">` (0–3) → `setVolume(...)`, mute button → `engine.toggleMute(volume, setVolume)`
  - Media Session (lock-screen) handlers already exist here (lines ~116–142) — good reference for calling engine/store actions outside a click handler.
  - Global `keydown` shortcut handler lives here too (space=play/pause, arrows=seek/volume, etc. — see inline comment for the full list).
- **`components/MiniPlayer.tsx`** — secondary mobile play/pause + next, just calls the same store actions, no own audio logic.
- **`components/Player.tsx`** — dead code, prop-driven, not imported/wired anywhere. Don't build against it.

## Gotchas

- Global keyboard handlers must skip when `e.target` is an `INPUT`/`TEXTAREA`/`SELECT`/`contentEditable`/`BUTTON`/`A` element, so typing and native button-activation (native Space/Enter click) aren't hijacked. `preventDefault()` on a keydown Space suppresses the browser's native synthetic click for a focused button, so skipping BUTTON/A avoids fighting dialogs (Cancel/Save) and other icon buttons.
- Changing `currentTrack.audioUrl` implicitly pauses the `<audio>` element, so the play/pause sync effect in `PlayerPanel` watches both `currentTrack?.audioUrl` and `isPlaying` together (see the comment above that effect).
- Media Session handlers use explicit `play()`/`pause()`, not `toggle()`, because the OS can pause the element without the store knowing (e.g. lock screen); a toggle from there could invert intent.
