'use client';

import { useCallback, useMemo, useState } from 'react';
import type { Track, RepeatMode } from '../lib/types';
import { useLocalStorage } from '../hooks/useLocalStorage';
import UrlInput from '../components/UrlInput';
import Player from '../components/Player';
import Playlist from '../components/Playlist';
import History from '../components/History';
import SearchBar from '../components/SearchBar';
import './components.css';

const HISTORY_LIMIT = 100;

export default function Page() {
  // Persisted state (anonymous, local to the browser).
  const [playlist, setPlaylist] = useLocalStorage<Track[]>('tiktok-player:playlist', []);
  const [history, setHistory] = useLocalStorage<Track[]>('tiktok-player:history', []);
  const [volume, setVolume] = useLocalStorage<number>('tiktok-player:volume', 0.8);

  // Playback state.
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<RepeatMode>('off');

  // UI state.
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [, setProgress] = useState<{ currentTime: number; duration: number }>({
    currentTime: 0,
    duration: 0,
  });

  const currentTrack =
    currentIndex >= 0 && currentIndex < playlist.length ? playlist[currentIndex] : null;
  const currentTrackUrl = currentTrack?.url ?? null;

  /** POST a TikTok URL to the backend, build a Track, and start playing it. */
  const handleAdd = useCallback(
    async (url: string) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/process', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json || !json.ok) {
          setError((json && json.error) || `Request failed (${res.status})`);
          return;
        }

        const { audioUrl, title, author, cover, duration } = json.data as Track;
        const track: Track = {
          url,
          audioUrl,
          title,
          author,
          cover,
          duration,
          addedAt: Date.now(),
        };

        // Upsert into the playlist.
        const existingIndex = playlist.findIndex((t) => t.url === url);
        const nextPlaylist =
          existingIndex >= 0
            ? playlist.map((t, i) => (i === existingIndex ? track : t))
            : [...playlist, track];
        setPlaylist(nextPlaylist);

        // Push onto history (dedupe by url, most recent first).
        setHistory((prev) => [track, ...prev.filter((t) => t.url !== url)].slice(0, HISTORY_LIMIT));

        setCurrentIndex(existingIndex >= 0 ? existingIndex : nextPlaylist.length - 1);
        setIsPlaying(true);
      } catch {
        setError('Network error — could not reach the server.');
      } finally {
        setLoading(false);
      }
    },
    [playlist, setPlaylist, setHistory],
  );

  /** Play a track, adding it to the playlist first if it isn't there yet. */
  const playFromTrack = useCallback(
    (track: Track) => {
      const idx = playlist.findIndex((t) => t.url === track.url);
      if (idx >= 0) {
        setCurrentIndex(idx);
      } else {
        setPlaylist((prev) => [...prev, track]);
        setCurrentIndex(playlist.length);
      }
      setIsPlaying(true);
    },
    [playlist, setPlaylist],
  );

  const removeTrack = useCallback(
    (track: Track) => {
      const idx = playlist.findIndex((t) => t.url === track.url);
      if (idx < 0) return;
      setPlaylist((prev) => prev.filter((t) => t.url !== track.url));
      if (idx === currentIndex) {
        setCurrentIndex(-1);
        setIsPlaying(false);
      } else if (idx < currentIndex) {
        setCurrentIndex(currentIndex - 1);
      }
    },
    [playlist, currentIndex, setPlaylist],
  );

  const pickRandomIndex = useCallback((): number => {
    if (playlist.length <= 1) return 0;
    let r = currentIndex;
    while (r === currentIndex) r = Math.floor(Math.random() * playlist.length);
    return r;
  }, [playlist.length, currentIndex]);

  const handleNext = useCallback(() => {
    if (playlist.length === 0) return;
    if (shuffle) {
      setCurrentIndex(pickRandomIndex());
      setIsPlaying(true);
      return;
    }
    const next = currentIndex + 1;
    if (next >= playlist.length) {
      if (repeat === 'all') {
        setCurrentIndex(0);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } else {
      setCurrentIndex(next);
      setIsPlaying(true);
    }
  }, [playlist.length, shuffle, currentIndex, repeat, pickRandomIndex]);

  const handlePrev = useCallback(() => {
    if (playlist.length === 0) return;
    if (shuffle) {
      setCurrentIndex(pickRandomIndex());
      setIsPlaying(true);
      return;
    }
    const prev = currentIndex - 1;
    if (prev < 0) {
      setCurrentIndex(repeat === 'all' ? playlist.length - 1 : 0);
    } else {
      setCurrentIndex(prev);
    }
    setIsPlaying(true);
  }, [playlist.length, shuffle, currentIndex, repeat, pickRandomIndex]);

  // Called by the Player when a track finishes (repeat-one is handled in Player).
  const handleEnded = useCallback(() => {
    // Advance according to current mode; 'all' wraps, 'off' stops at the end.
    if (currentIndex + 1 >= playlist.length) {
      if (repeat === 'all') {
        setCurrentIndex(0);
        setIsPlaying(true);
      } else {
        setIsPlaying(false);
      }
    } else {
      setCurrentIndex(currentIndex + 1);
      setIsPlaying(true);
    }
  }, [playlist.length, currentIndex, repeat]);

  const handleToggle = useCallback(() => {
    if (!currentTrack) {
      if (playlist.length > 0) {
        setCurrentIndex(0);
        setIsPlaying(true);
      }
      return;
    }
    setIsPlaying((p) => !p);
  }, [currentTrack, playlist.length]);

  const cycleRepeat = useCallback(() => {
    setRepeat((m) => (m === 'off' ? 'all' : m === 'all' ? 'one' : 'off'));
  }, []);

  // Filter playlist + history by the search query (title or author).
  const match = (t: Track) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return t.title.toLowerCase().includes(q) || t.author.toLowerCase().includes(q);
  };
  const filteredPlaylist = useMemo(() => playlist.filter(match), [playlist, query]);
  const filteredHistory = useMemo(() => history.filter(match), [history, query]);

  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__logo">🎵 TikPlay</h1>
        <p className="app__tagline">Paste a TikTok link and play — no account needed.</p>
      </header>

      <div className="app__topbar">
        <UrlInput onAdd={handleAdd} loading={loading} error={error} />
        <SearchBar value={query} onChange={setQuery} />
      </div>

      <main className="app__grid">
        <Playlist
          tracks={filteredPlaylist}
          currentTrackUrl={currentTrackUrl}
          isPlaying={isPlaying}
          shuffle={shuffle}
          repeat={repeat}
          onPlay={playFromTrack}
          onRemove={removeTrack}
          onToggleShuffle={() => setShuffle((s) => !s)}
          onCycleRepeat={cycleRepeat}
        />
        <History tracks={filteredHistory} currentTrackUrl={currentTrackUrl} onPlay={playFromTrack} />
      </main>

      <Player
        currentTrack={currentTrack}
        isPlaying={isPlaying}
        repeat={repeat}
        onToggle={handleToggle}
        onNext={handleNext}
        onPrev={handlePrev}
        onProgress={(_t, _d) => setProgress({ currentTime: _t, duration: _d })}
        onEnded={handleEnded}
        volume={volume}
        onVolumeChange={setVolume}
      />
    </div>
  );
}
