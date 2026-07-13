# TikPlay Midnight Studio — Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.
> Steps use checkbox (`- [ ]`) syntax for tracking per-subagent implementation plan.

**Goal:** Upgrade TikPlay to a premium single-user music hub with cross-device sync, playlist management, EQ, speed control, mini player, and drag-and-drop.

**Architecture:** Next.js 14 App Router + SQLite (better-sqlite3) replaces localStorage. Web Audio API replaces `<audio>` for EQ/speed. dnd-kit for drag-and-drop. CSS custom properties for "Midnight Studio" palette.

**Tech Stack:** Next.js 14, React 18, TypeScript, better-sqlite3, Web Audio API, dnd-kit, Media Session API

---

### Task 1: SQLite Database + Sync API Routes

**Files:**
- Create: `lib/db/index.ts` — database singleton + init
- Create: `lib/db/schema.ts` — table creation SQL
- Create: `lib/db/queries.ts` — all query functions
- Modify: `app/layout.tsx` — remove font links (use next/font)
- Modify: `package.json` — add `better-sqlite3`, `@types/better-sqlite3`, `dnd-kit/core`, `dnd-kit/sortable`, `dnd-kit/utilities`

- [ ] **Step 1: Install dependencies**

```bash
npm install better-sqlite3 @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
npm install -D @types/better-sqlite3
```

- [ ] **Step 2: Create lib/db/schema.ts**

```typescript
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  url TEXT UNIQUE NOT NULL,
  audio_key TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL DEFAULT '',
  cover TEXT DEFAULT '',
  duration REAL NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_tracks (
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (playlist_id, track_id)
);

CREATE TABLE IF NOT EXISTS favorites (
  track_id INTEGER PRIMARY KEY REFERENCES tracks(id) ON DELETE CASCADE,
  added_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS auto_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  playlist_id INTEGER NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  match_mode TEXT NOT NULL DEFAULT 'contains'
);

-- Seed default playlists
INSERT OR IGNORE INTO playlists (id, name, sort_order, created_at) VALUES
  (1, '📋 All Tracks', 0, unixepoch()),
  (2, '❤️ Yêu thích', 1, unixepoch());
`;
```

- [ ] **Step 3: Create lib/db/index.ts**

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { SCHEMA_SQL } from './schema';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'tikplay.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    db.exec(SCHEMA_SQL);
  }
  return db;
}
```

- [ ] **Step 4: Create lib/db/queries.ts** with all typed query functions:

```typescript
import type { Track, Playlist, PlaylistTrack, AutoRule, DbTrack } from '../types';
import { getDb } from './index';

// TRACKS
export function getAllTracks(): DbTrack[] {
  return getDb().prepare('SELECT * FROM tracks ORDER BY added_at DESC').all() as DbTrack[];
}

export function getTrack(id: number): DbTrack | undefined {
  return getDb().prepare('SELECT * FROM tracks WHERE id = ?').get(id) as DbTrack | undefined;
}

export function getTrackByUrl(url: string): DbTrack | undefined {
  return getDb().prepare('SELECT * FROM tracks WHERE url = ?').get(url) as DbTrack | undefined;
}

export function upsertTrack(t: Omit<DbTrack, 'id'>): DbTrack {
  const existing = getTrackByUrl(t.url);
  if (existing) {
    // Only update metadata
    getDb().prepare(`
      UPDATE tracks SET title=?, author=?, cover=?, duration=? WHERE url=?
    `).run(t.title, t.author, t.cover, t.duration, t.url);
    return getTrackByUrl(t.url)!;
  }
  const info = getDb().prepare(`
    INSERT INTO tracks (url, audio_key, title, author, cover, duration, added_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(t.url, t.audio_key, t.title, t.author, t.cover, t.duration, t.added_at);
  return getTrack(info.lastInsertRowid as number)!;
}

export function deleteTrack(id: number): void {
  getDb().prepare('DELETE FROM tracks WHERE id = ?').run(id);
}

// PLAYLISTS
export function getAllPlaylists(): Playlist[] {
  const playlists = getDb().prepare('SELECT * FROM playlists ORDER BY sort_order, id').all() as Playlist[];
  const stmt = getDb().prepare('SELECT COUNT(*) as count FROM playlist_tracks WHERE playlist_id = ?');
  return playlists.map(p => ({
    ...p,
    trackCount: (stmt.get(p.id) as { count: number }).count,
  }));
}

export function createPlaylist(name: string): Playlist {
  const info = getDb().prepare(`
    INSERT INTO playlists (name, sort_order, created_at)
    VALUES (?, ?, ?)
  `).run(name, 999, Date.now());
  return getDb().prepare('SELECT * FROM playlists WHERE id = ?').get(info.lastInsertRowid) as Playlist;
}

export function deletePlaylist(id: number): void {
  getDb().prepare('DELETE FROM playlists WHERE id = ?').run(id);
}

export function renamePlaylist(id: number, name: string): void {
  getDb().prepare('UPDATE playlists SET name = ? WHERE id = ?').run(name, id);
}

export function reorderPlaylists(ids: number[]): void {
  const stmt = getDb().prepare('UPDATE playlists SET sort_order = ? WHERE id = ?');
  const tx = getDb().transaction(() => {
    ids.forEach((id, i) => stmt.run(i, id));
  });
  tx();
}

// PLAYLIST TRACKS
export function getPlaylistTracks(playlistId: number): DbTrack[] {
  return getDb().prepare(`
    SELECT t.* FROM tracks t
    JOIN playlist_tracks pt ON pt.track_id = t.id
    WHERE pt.playlist_id = ?
    ORDER BY pt.position
  `).all(playlistId) as DbTrack[];
}

export function addTrackToPlaylist(playlistId: number, trackId: number): void {
  getDb().prepare(`
    INSERT OR IGNORE INTO playlist_tracks (playlist_id, track_id, position, added_at)
    VALUES (?, ?, (SELECT COALESCE(MAX(position), -1) + 1 FROM playlist_tracks WHERE playlist_id = ?), ?)
  `).run(playlistId, trackId, playlistId, Date.now());
}

export function removeTrackFromPlaylist(playlistId: number, trackId: number): void {
  getDb().prepare('DELETE FROM playlist_tracks WHERE playlist_id = ? AND track_id = ?').run(playlistId, trackId);
}

export function reorderPlaylistTracks(playlistId: number, trackIds: number[]): void {
  const stmt = getDb().prepare('UPDATE playlist_tracks SET position = ? WHERE playlist_id = ? AND track_id = ?');
  const tx = getDb().transaction(() => {
    trackIds.forEach((pos, i) => stmt.run(i, playlistId, pos));
  });
  tx();
}

// FAVORITES
export function getFavoriteIds(): Set<number> {
  const rows = getDb().prepare('SELECT track_id FROM favorites').all() as { track_id: number }[];
  return new Set(rows.map(r => r.track_id));
}

export function toggleFavorite(trackId: number): boolean {
  const existing = getDb().prepare('SELECT 1 FROM favorites WHERE track_id = ?').get(trackId);
  if (existing) {
    getDb().prepare('DELETE FROM favorites WHERE track_id = ?').run(trackId);
    return false;
  } else {
    getDb().prepare('INSERT INTO favorites (track_id, added_at) VALUES (?, ?)').run(trackId, Date.now());
    return true;
  }
}

export function getFavoriteTracks(): DbTrack[] {
  return getDb().prepare(`
    SELECT t.* FROM tracks t JOIN favorites f ON f.track_id = t.id ORDER BY f.added_at DESC
  `).all() as DbTrack[];
}

// AUTO RULES
export function getAutoRules(): AutoRule[] {
  return getDb().prepare('SELECT * FROM auto_rules ORDER BY id').all() as AutoRule[];
}

export function createAutoRule(playlistId: number, keyword: string, matchMode: string): AutoRule {
  const info = getDb().prepare(`
    INSERT INTO auto_rules (playlist_id, keyword, match_mode) VALUES (?, ?, ?)
  `).run(playlistId, keyword, matchMode);
  return getDb().prepare('SELECT * FROM auto_rules WHERE id = ?').get(info.lastInsertRowid) as AutoRule;
}

export function deleteAutoRule(id: number): void {
  getDb().prepare('DELETE FROM auto_rules WHERE id = ?').run(id);
}

export function applyAutoRules(title: string, author: string): number[] {
  const rules = getAutoRules();
  const text = `${title} ${author}`.toLowerCase();
  const targetPlaylistIds: Set<number> = new Set();
  for (const rule of rules) {
    let match = false;
    if (rule.match_mode === 'contains') match = text.includes(rule.keyword.toLowerCase());
    else if (rule.match_mode === 'starts_with') match = text.startsWith(rule.keyword.toLowerCase());
    targetPlaylistIds.add(rule.playlist_id);
  }
  return Array.from(targetPlaylistIds);
}
```

- [ ] **Step 5: Create API route — GET/POST/DELETE /api/tracks**

Create `app/api/tracks/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getAllTracks, upsertTrack, deleteTrack, applyAutoRules, addTrackToPlaylist } from '@/lib/db/queries';

export async function GET() {
  const tracks = getAllTracks();
  return NextResponse.json({ ok: true, tracks });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const track = upsertTrack({
    url: body.url,
    audio_key: body.audioKey,
    title: body.title,
    author: body.author,
    cover: body.cover || '',
    duration: body.duration,
    added_at: Date.now(),
  });
  // Apply auto-rules
  const playlistIds = applyAutoRules(track.title, track.author);
  for (const pid of playlistIds) {
    addTrackToPlaylist(pid, track.id);
  }
  return NextResponse.json({ ok: true, track });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deleteTrack(id);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 6: Create API route — /api/playlists/[id]**

```typescript
// app/api/playlists/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAllPlaylists, createPlaylist, deletePlaylist, renamePlaylist, reorderPlaylists } from '@/lib/db/queries';

export async function GET() {
  return NextResponse.json({ ok: true, playlists: getAllPlaylists() });
}

export async function POST(req: NextRequest) {
  const { name } = await req.json();
  const playlist = createPlaylist(name);
  return NextResponse.json({ ok: true, playlist });
}

export async function PUT(req: NextRequest) {
  const { id, name, ids } = await req.json();
  if (ids) { reorderPlaylists(ids); return NextResponse.json({ ok: true }); }
  if (name) renamePlaylist(id, name);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  deletePlaylist(id);
  return NextResponse.json({ ok: true });
}
```

Create `app/api/playlists/[id]/tracks/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getPlaylistTracks, addTrackToPlaylist, removeTrackFromPlaylist, reorderPlaylistTracks } from '@/lib/db/queries';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const tracks = getPlaylistTracks(Number(params.id));
  return NextResponse.json({ ok: true, tracks });
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { trackId } = await req.json();
  addTrackToPlaylist(Number(params.id), trackId);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const { trackId } = await req.json();
  removeTrackFromPlaylist(Number(params.id), trackId);
  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const { trackIds } = await req.json();
  reorderPlaylistTracks(Number(params.id), trackIds);
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 7: Create API routes — favorites and auto-rules**

Create `app/api/favorites/route.ts` and `app/api/auto-rules/route.ts` following the patterns above.

- [ ] **Step 8: Update lib/types.ts** with new types

```typescript
export interface DbTrack {
  id: number;
  url: string;
  audio_key: string;
  title: string;
  author: string;
  cover: string;
  duration: number;
  added_at: number;
}

export interface Playlist {
  id: number;
  name: string;
  sort_order: number;
  created_at: number;
  trackCount?: number;
}

export interface AutoRule {
  id: number;
  playlist_id: number;
  keyword: string;
  match_mode: 'contains' | 'starts_with';
}
```

- [ ] **Step 9: Commit**

```bash
git add . && git commit -m "feat: add SQLite database and sync API routes

- better-sqlite3 database with WAL mode
- Track, playlist, favorites, auto-rule queries
- CRUD API routes for all entities
- Auto-rule engine for keyword-based playlist assignment

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: Frontend Redesign — CSS Design System

**Files:**
- Modify: `app/globals.css` — new color tokens, fonts via next/font
- Modify: `app/layout.tsx` — use next/font (Outfit, Jakarta Sans, Space Mono)
- Modify: `app/components.css` — full rewrite for new layout

- [ ] **Step 1: Update app/layout.tsx** to use next/font instead of Google Fonts CDN link

```tsx
import { Outfit, Plus_Jakarta_Sans, Space_Mono } from 'next/font/google';

const outfit = Outfit({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const jakarta = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-ui', display: 'swap' });
const mono = Space_Mono({ weight: ['400', '700'], subsets: ['latin'], variable: '--font-mono', display: 'swap' });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi" className={`${outfit.variable} ${jakarta.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Rewrite app/globals.css** — new palette, no TikTok gradient

```css
:root {
  /* Backgrounds */
  --bg: #0b0b0c;
  --bg-elevated: #111114;
  --surface: #151518;
  --surface-2: #1f1f24;
  --surface-3: #2a2a30;

  /* Text */
  --text: #f0ebe5;
  --muted: #8e8a84;
  --muted-2: #63605a;

  /* Borders */
  --border: #2c2c34;
  --border-soft: #1f1f24;

  /* Accents */
  --accent: #d46a4a;
  --accent-hover: #e07a5a;
  --accent-muted: rgba(212, 106, 74, 0.15);
  --gold: #c9a06a;
  --teal: #4a8a8a;
  --wine: #8a3a5a;

  /* Sizing */
  --radius: 14px;
  --radius-sm: 10px;
  --radius-xs: 6px;
  --sidebar-w: 240px;
  --player-w: 360px;
  --shadow: 0 8px 32px rgba(0,0,0,0.5);
  --shadow-sm: 0 4px 16px rgba(0,0,0,0.35);

  --font-display: 'Outfit', ui-sans-serif, system-ui, sans-serif;
  --font-ui: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
  --font-mono: 'Space Mono', ui-monospace, monospace;
}
```

- [ ] **Step 3: Rewrite app/components.css** with new layout system

The entire CSS file. Key layout:

```css
/* Layout */
.app { display: flex; height: 100vh; overflow: hidden; background: var(--bg); }

/* Sidebar */
.sidebar { width: var(--sidebar-w); flex-shrink: 0; display: flex; flex-direction: column; background: var(--bg-elevated); border-right: 1px solid var(--border-soft); padding: 16px; gap: 4px; overflow-y: auto; }
.sidebar__header { padding: 8px 8px 16px; font-family: var(--font-display); font-weight: 800; font-size: 22px; color: var(--text); letter-spacing: 0.3px; }

/* Main content */
.main { flex: 1; min-width: 0; display: flex; flex-direction: column; overflow: hidden; }
.main__header { display: flex; align-items: center; gap: 12px; padding: 20px 24px; border-bottom: 1px solid var(--border-soft); }
.main__body { flex: 1; overflow-y: auto; padding: 20px 24px; }

/* Player panel */
.player-panel { width: var(--player-w); flex-shrink: 0; display: flex; flex-direction: column; padding: 24px; gap: 20px; background: var(--bg-elevated); border-left: 1px solid var(--border-soft); overflow-y: auto; }

/* Track list */
.track-list { list-style: none; display: flex; flex-direction: column; gap: 4px; }
.track-row { display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); background: transparent; border: 1px solid transparent; cursor: default; transition: background 0.12s ease; }
.track-row:hover { background: var(--surface); }
.track-row--active { background: var(--accent-muted); border-color: rgba(212, 106, 74, 0.2); }
.track-row__drag { cursor: grab; color: var(--muted-2); padding: 4px; display: flex; touch-action: none; }
.track-row__cover { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; flex-shrink: 0; }
.track-row__info { flex: 1; min-width: 0; }
.track-row__title { font-size: 14px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-row__author { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.track-row__fav { border: none; background: transparent; color: var(--muted-2); cursor: pointer; padding: 4px; font-size: 16px; line-height: 1; }
.track-row__fav.is-fav { color: var(--wine); }
.track-row__remove { border: none; background: transparent; color: var(--muted-2); cursor: pointer; padding: 4px; font-size: 18px; line-height: 1; opacity: 0; transition: opacity 0.12s; }
.track-row:hover .track-row__remove { opacity: 1; }
.track-row__remove:hover { color: var(--accent); }
```

And continue with all the player, vinyl, EQ, mini player, sidebar styles. (Full CSS content inline.)

- [ ] **Step 4: Commit CSS changes**

```bash
git add . && git commit -m "feat: redesign design system — Midnight Studio palette

- Replace TikTok cyan/magenta with warm copper-gold palette
- next/font instead of Google Fonts CDN
- New layout system: sidebar | main | player panel
- Track row component styles with drag handle + fav

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Core Frontend — Sidebar + PlaylistView + TrackRow

**Files:**
- Create: `hooks/useApi.ts` — generic fetch hook
- Create: `hooks/useAppStore.ts` — React context/store for app state (playlists, tracks, favorites)
- Create: `components/Sidebar.tsx`
- Create: `components/PlaylistView.tsx`
- Create: `components/TrackRow.tsx`
- Create: `components/TrackList.tsx`
- Modify: `app/page.tsx` — full rewrite using new layout

- [ ] **Step 1: Create hooks/useApi.ts**

```typescript
// Simple fetch wrapper for typed API calls
const BASE = '';

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  return res.json();
}
```

- [ ] **Step 2: Create the app context/store** (`hooks/useAppStore.ts`)

A React context + reducer/provider that holds: tracks, playlists, favorites, currentPlaylistId, currentTrackId. Provides actions: loadTracks, loadPlaylists, addTrack, toggleFav, removeTrack, reorder, etc.

- [ ] **Step 3: Create Sidebar component** (`components/Sidebar.tsx`)

NavRail with playlist list, active state, add/delete playlist buttons.

- [ ] **Step 4: Create TrackRow component** (`components/TrackRow.tsx`)

Single track line with drag handle (from dnd-kit), cover, title, author, fav button, remove button. Handles click-to-play, drag-to-reorder state.

- [ ] **Step 5: Create TrackList with dnd-kit** (`components/TrackList.tsx`)

Droppable sortable container. Uses `@dnd-kit/sortable` (useSortable, SortableContext, verticalListSortingStrategy).

- [ ] **Step 6: Create PlaylistView component** (`components/PlaylistView.tsx`)

Header (playlist name + "▶ Play All" button) + TrackList.

- [ ] **Step 7: Rewrite app/page.tsx**

```tsx
'use client';
import Sidebar from '../components/Sidebar';
import PlaylistView from '../components/PlaylistView';
import PlayerPanel from '../components/PlayerPanel';
import MiniPlayer from '../components/MiniPlayer';
import UrlInput from '../components/UrlInput';
import SearchBar from '../components/SearchBar';
import './components.css';
```

With layout: sidebar | main (header + playlist view) | player panel.

- [ ] **Step 8: Commit**

---

### Task 4: Player Panel Redesign + Web Audio API (EQ + Speed)

**Files:**
- Create: `hooks/useAudioEngine.ts` — Web Audio API manager
- Create: `components/PlayerPanel.tsx`
- Create: `components/Equalizer.tsx`
- Create: `components/SpeedControl.tsx`
- Modify: `components/Cover.tsx` — minor style updates
- Delete: `components/Player.tsx` (replaced by PlayerPanel)

- [ ] **Step 1: Create the Audio Engine hook** (`hooks/useAudioEngine.ts`)

```typescript
// Manages AudioContext, AudioBufferSourceNode, BiquadFilterNodes (10-band EQ),
// GainNode (volume), and playback rate.
//
// Key functions:
// - loadTrack(audioUrl: string) => fetches audio, decodes, creates source
// - play(), pause(), toggle()
// - setVolume(v: number), setSpeed(speed: number)
// - setBand(index: number, gain: number) — adjusts biquad filter
// - seek(time: number)
// - getCurrentTime(), getDuration()
// - onTimeUpdate(cb), onEnded(cb)
// - applyPreset(name: string)
//
// 10 EQ bands: 32, 64, 125, 250, 500, 1000, 2000, 4000, 8000, 16000 Hz
// Filters: BiquadFilterNode with type 'peaking', Q=1.414
```

The actual implementation with full Web Audio API wiring.

- [ ] **Step 2: Create Equalizer component** (`components/Equalizer.tsx`)

10 vertical sliders with frequency labels. Presets dropdown. Collapsible panel.

- [ ] **Step 3: Create SpeedControl component** (`components/SpeedControl.tsx`)

Slider 0.5x–2.0x with text display. Quick presets: 0.75x, 1.0x, 1.25x, 1.5x.

- [ ] **Step 4: Create PlayerPanel component** (`components/PlayerPanel.tsx`)

The redesigned now-playing area: vinyl disc (refined), transport, seek, volume, EQ, speed.

- [ ] **Step 5: Commit**

---

### Task 5: Mini Player + Media Session API

**Files:**
- Create: `components/MiniPlayer.tsx`
- Modify: `app/page.tsx` — add MiniPlayer below content

- [ ] **Step 1: Create MiniPlayer component**

A fixed-position bar at the bottom of the viewport that appears when the user scrolls away from the player panel. Shows cover thumbnail, track title (marquee scroll if truncated), play/pause, next.

- [ ] **Step 2: Wire up Media Session API**

```typescript
// In useAudioEngine or PlayerPanel, when track changes:
navigator.mediaSession.metadata = new MediaMetadata({
  title: track.title,
  artist: track.author,
  artwork: [{ src: track.cover, sizes: '512x512', type: 'image/jpeg' }],
});

navigator.mediaSession.setActionHandler('play', play);
navigator.mediaSession.setActionHandler('pause', pause);
navigator.mediaSession.setActionHandler('previoustrack', prev);
navigator.mediaSession.setActionHandler('nexttrack', next);
```

- [ ] **Step 3: Commit**

---

### Task 6: Auto-Rule UI + Add URL Flow Update

**Files:**
- Create: `components/AutoRuleDialog.tsx`
- Create: `components/AddPlaylistDialog.tsx`
- Modify: `components/UrlInput.tsx` — update flow to save to DB via API

- [ ] **Step 1: Create AutoRuleDialog**

Modal with table of rules (playlist → keyword → mode), add/delete.

- [ ] **Step 2: Create AddPlaylistDialog**

Simple modal with text input for playlist name.

- [ ] **Step 3: Update UrlInput.tsx**

After processing URL, POST to `/api/tracks` to persist to DB, then refresh playlist view.

- [ ] **Step 4: Commit**

---

### Task 7: Mobile Adaptation

**Files:**
- Modify: `app/components.css` — mobile media queries
- Modify: `app/page.tsx` — responsive layout
- Delete: `components/MobileLibrary.tsx` (replaced by responsive layout)

- [ ] **Step 1: Add media queries**

Below 1024px: sidebar collapses to bottom tabs, player panel stacks below main.
Below 640px: single column, mini player at bottom.

- [ ] **Step 2: Commit**

---

### Task 8: Final Polish + Verify

- [ ] **Step 1: Run build**
```bash
npm run build
```

- [ ] **Step 2: Fix any TypeScript or Next.js build errors**

- [ ] **Step 3: Test flow:** paste URL → play → EQ → speed → fav → reorder → mobile

- [ ] **Step 4: Final commit**
