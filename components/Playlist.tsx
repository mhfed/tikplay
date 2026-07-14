'use client';

import type { RepeatMode, Track } from '../lib/types';
import Cover from './Cover';
import { ListMusicIcon, RepeatIcon, RepeatOneIcon, ShuffleIcon } from './icons';

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
  off: 'Tắt lặp',
  all: 'Lặp tất cả',
  one: 'Lặp một bài',
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
        <h2 className="panel__title">
          <ListMusicIcon size={18} className="panel__title-icon" />
          Playlist
        </h2>
        <div className="panel__tools">
          <button
            className={`iconbtn${shuffle ? ' iconbtn--on' : ''}`}
            onClick={onToggleShuffle}
            aria-pressed={shuffle}
            aria-label="Phát ngẫu nhiên"
            title="Phát ngẫu nhiên"
          >
            <ShuffleIcon size={18} />
          </button>
          <button
            className={`iconbtn${repeat !== 'off' ? ' iconbtn--on' : ''}`}
            onClick={onCycleRepeat}
            aria-label={REPEAT_LABEL[repeat]}
            title={REPEAT_LABEL[repeat]}
          >
            {repeat === 'one' ? (
              <RepeatOneIcon size={18} />
            ) : (
              <RepeatIcon size={18} />
            )}
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
              <li
                key={track.url}
                className={`track-item${active ? ' track-item--active' : ''}`}
              >
                <Cover
                  src={track.cover}
                  alt={track.title}
                  subtitle={track.author}
                  className="track-item__cover"
                />
                <button
                  className="track-item__meta"
                  onClick={() => onPlay(track)}
                  title="Play"
                >
                  <span className="track-item__title">{track.title}</span>
                  <span className="track-item__author">{track.author}</span>
                </button>
                {active && isPlaying && (
                  <span className="track-item__badge">▶</span>
                )}
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
