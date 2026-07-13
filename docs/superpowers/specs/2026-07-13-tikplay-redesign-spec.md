# TikPlay Midnight Studio — Design Spec

> **Goal:** Upgrade TikPlay from a basic TikTok player to a premium personal music hub with cross-device sync, EQ, speed control, mini player, playlist management, and drag-and-drop — while eliminating the "AI-generated" aesthetic.

**Single-user, no auth, one SQLite database shared across devices.**

---

## Color Palette: "Midnight Studio"

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg` | `#0b0b0c` | Near-black, slightly warm |
| `--bg-elevated` | `#111114` | Elevated surfaces (cards, sidebars) |
| `--surface` | `#151518` | Default surface |
| `--surface-2` | `#1f1f24` | Hover/selected surface |
| `--surface-3` | `#2a2a30` | Borders, subtle dividers |
| `--text` | `#f0ebe5` | Warm off-white |
| `--muted` | `#8e8a84` | Muted warm grey |
| `--muted-2` | `#63605a` | Secondary muted |
| `--accent` | `#d46a4a` | Burnt copper — primary action |
| `--accent-hover` | `#e07a5a` | Accent hover/glow |
| `--gold` | `#c9a06a` | Warm gold — badges, highlights |
| `--teal` | `#4a8a8a` | Teal — info, secondary accent |
| `--wine` | `#8a3a5a` | Deep wine — depth/decoration |

No glassmorphism, no neon gradients, no purple-blue AI gradient.

---

## Layout

```
Desktop: Sidebar(240px) | Main(flex) | Player(minmax 340px)
Tablet:  Sidebar→BottomTabs | Main | Player(collapsed)
Mobile:  Single column, player as mini bar, sheet for content
```

- Sticky right panel for Player + EQ + Speed (the app's "soul")
- Left sidebar nav for playlist switching
- Header with global search

---

## Database (SQLite via better-sqlite3)

```sql
tables: tracks, playlists, playlist_tracks, favorites, auto_rules
```

No user_id — single-user app.

---

## Frontend Components (new/refactored)

- `Sidebar` — NavRail with playlist tree, create/edit, collapse
- `PlaylistView` — View for one playlist + "Play All"
- `TrackRow` — Drag handle, title, author, ❤️ fav, × remove
- `TrackList` — Sortable container (dnd-kit)
- `PlayerPanel` — Redesigned vinyl + controls
- `Equalizer` — 10-band Web Audio API + presets
- `SpeedControl` — 0.5x–2x slider
- `MiniPlayer` — Floating bottom bar + Media Session API
- `SearchBar` — Server-side search
- `AddPlaylistDialog`, `AutoRuleDialog` — Modals
- `MobileLayout` — Bottom tabs replacing old sheet
