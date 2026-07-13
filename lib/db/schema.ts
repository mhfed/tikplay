// Schema is now embedded in lib/db/index.ts as the DEFAULT_DATA structure.
// This file kept for reference only.
//
// Data shape:
// - tracks[]: { id, url, audio_key, title, author, cover, duration, added_at }
// - playlists[]: { id, name, sort_order, created_at }
// - playlistTracks[]: { playlist_id, track_id, position, added_at }
// - favorites[]: number[] (track IDs)
// - autoRules[]: { id, playlist_id, keyword, match_mode }
