'use client';

import type { Track, RepeatMode } from '../lib/types';

interface PlaylistProps {
  tracks: Track[];
  currentTrackUrl: string | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  onPlay: (track: Track) => void;
  onRemove: (track: Track) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

const REPEAT_LABEL: Record<RepeatMode, string> = {
  off: 'Repeat',
  all: 'Repeat all',
  one: 'Repeat one',
};

/** The active playlist with per-track controls plus shuffle / repeat toggles. */
export default function Playlist({
  tracks,
  currentTrackUrl,
  isPlaying,
  shuffle,
  repeat,
  onPlay,
  onRemove,
  onToggleShuffle,
  onCycleRepeat,
}: PlaylistProps) {
  return (
    <div className="panel">
      <div className="panel__header">
        <h2 className="panel__title">Playlist</h2>
        <div className="panel__tools">
          <button
            className={`chip${shuffle ? ' chip--on' : ''}`}
            onClick={onToggleShuffle}
            aria-pressed={shuffle}
            title="Shuffle"
          >
            🔀 Shuffle
          </button>
          <button
            className={`chip${repeat !== 'off' ? ' chip--on' : ''}`}
            onClick={onCycleRepeat}
            title="Cycle repeat mode"
          >
            {repeat === 'one' ? '🔂' : '🔁'} {REPEAT_LABEL[repeat]}
          </button>
        </div>
      </div>

      {tracks.length === 0 ? (
        <p className="panel__empty">Your playlist is empty.</p>
      ) : (
        <ul className="track-list">
          {tracks.map((track) => {
            const active = track.url === currentTrackUrl;
            return (
              <li key={track.url} className={`track-item${active ? ' track-item--active' : ''}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="track-item__cover" src={track.cover} alt="" />
                <button className="track-item__meta" onClick={() => onPlay(track)} title="Play">
                  <span className="track-item__title">{track.title}</span>
                  <span className="track-item__author">{track.author}</span>
                </button>
                {active && isPlaying && <span className="track-item__badge">▶</span>}
                <button
                  className="track-item__remove"
                  onClick={() => onRemove(track)}
                  aria-label="Remove from playlist"
                  title="Remove"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
