# TikPlay product roadmap

Updated: 2026-07-21

## Product direction

Develop TikPlay as a personal music library and player for audio collected from
short-form video and YouTube. The near-term roadmap strengthens library
management, playback continuity, importing, discovery, and offline use without
introducing accounts or distributed infrastructure.

The current single-process JSON database and local disk cache remain suitable
for a private instance. Multi-user features are deferred until there is a
concrete need for PostgreSQL, object storage, authorization, and durable jobs.

## Current foundation

- TikTok and YouTube URL processing through yt-dlp and ffmpeg.
- Searchable library with favorites, categories, sources, and recent tracks.
- Manual and rule-driven playlists with track reordering.
- Persistent global player with queue, shuffle, repeat, speed, EQ, trimming,
  Media Session support, keyboard shortcuts, and timestamp sharing.
- Installable PWA shell, copyright reporting, and administrative moderation.

## Phase 1: Library workflows

Status: Completed (2026-07-21)

- [x] Add tracks to manual playlists from the track action menu.
- [x] Rename and delete playlists from the playlist UI.
- [x] Expose playlist ordering where it is useful in navigation.
- [x] Sort tracks by date, title, artist, duration, source, and category.
- [x] Allow users to edit track title, artist, cover, and category.
- [x] Validate mutations and show actionable errors.

Done when the main library and playlist workflows require no API-only actions,
mutations survive reloads, and focused UI tests cover the critical paths.

## Phase 2: Playback continuity

Status: Completed (2026-07-21)

- [x] Persist current track, queue, queue index, shuffle, repeat, volume, speed,
  and EQ settings locally.
- [x] Restore the last playback position after a full reload without autoplay.
- [x] Throttle timeline persistence to avoid excessive browser writes.
- [x] Safely discard restored tracks that no longer exist in the library.

Done when reloading restores the listening context while respecting browser
autoplay rules and preserving the single global audio engine architecture.

## Phase 3: Import and library health

Status: Completed (2026-07-21)

- [x] Accept multiple URLs and report progress independently for each item.
- [x] Support retry and cancellation for pending imports.
- [x] Detect existing source URLs and duplicate media before processing.
- [x] Add a library health API and UI for missing audio or artwork.
- [x] Repair recoverable cache entries and clean unreferenced files.

Done when large imports can be managed without losing successful items and
users can identify and repair broken library entries.

## Phase 4: Listening intelligence

Status: Planned

- [ ] Persist play count, last-played time, and listening history in the DB.
- [ ] Record a play only after a meaningful listening threshold.
- [ ] Add smart collections for most played, recently played, unfinished, and
  long-unplayed tracks.
- [ ] Expand automatic playlist rules with multiple predicates and previews.

Done when derived collections are deterministic, playback events are not
double-counted, and history remains bounded.

## Phase 5: Offline audio

Status: Planned

- [ ] Add explicit offline download and removal controls for tracks/playlists.
- [ ] Cache audio separately from the application shell.
- [ ] Add download progress, failure, and unavailable states.
- [ ] Provide a storage manager with usage and per-item removal.
- [ ] Reconcile offline entries when tracks are deleted or media changes.

Done when selected audio remains playable without a network connection and
users retain explicit control over browser storage.

## Deferred: Multi-user platform

Accounts, public playlists, collaboration, and cross-device synchronization are
not part of the current implementation roadmap. They require a migration from
the process-cached JSON database and local files to user-scoped database rows,
object storage, authorization, and a durable media-processing queue.

## Engineering work carried with each phase

- Run Biome formatting and lint checks plus `npx tsc --noEmit`.
- Add focused Playwright coverage for user-visible behavior.
- Preserve `PlaybackProvider` as the sole owner of the audio engine.
- Avoid widening public mutation APIs without validation and authorization.
- Update this document as tasks are completed or scope changes.
