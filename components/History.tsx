'use client';

import type { Track } from '../lib/types';

interface HistoryProps {
  tracks: Track[];
  currentTrackUrl: string | null;
  onPlay: (track: Track) => void;
}

/** Read-only, click-to-play list of previously played tracks. */
export default function History({ tracks, currentTrackUrl, onPlay }: HistoryProps) {
  return (
    <div className="panel">
      <div className="panel__header">
        <h2 className="panel__title">History</h2>
      </div>

      {tracks.length === 0 ? (
        <p className="panel__empty">No history yet.</p>
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
                {active && <span className="track-item__badge">▶</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
