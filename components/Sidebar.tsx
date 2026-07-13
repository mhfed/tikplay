'use client';

import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { MusicIcon, ListMusicIcon, ClockIcon, PlusIcon } from './icons';
import AddPlaylistDialog from './AddPlaylistDialog';
import AutoRuleDialog from './AutoRuleDialog';

export default function Sidebar() {
  const {
    playlists,
    currentPlaylistId,
    selectPlaylist,
  } = useAppStore();
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showAutoRules, setShowAutoRules] = useState(false);

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <MusicIcon size={18} />
        </div>
        <span className="sidebar__name">TikPlay</span>
      </div>

      <div className="sidebar__section">Library</div>
      <ul className="sidebar__list">
        <li>
          <button
            className={`sidebar__item${currentPlaylistId === 1 ? ' is-active' : ''}`}
            onClick={() => selectPlaylist(1)}
          >
            <span className="sidebar__item-icon"><ListMusicIcon size={16} /></span>
            All Tracks
          </button>
        </li>
        <li>
          <button
            className={`sidebar__item${currentPlaylistId === -1 ? ' is-active' : ''}`}
            onClick={() => selectPlaylist(-1)}
          >
            <span className="sidebar__item-icon"><HeartIcon /></span>
            Favorites
          </button>
        </li>
      </ul>

      <div className="sidebar__section">Playlists</div>
      <ul className="sidebar__list">
        {playlists
          .filter((p) => p.id !== 1)
          .map((p) => (
            <li key={p.id}>
              <button
                className={`sidebar__item${currentPlaylistId === p.id ? ' is-active' : ''}`}
                onClick={() => selectPlaylist(p.id)}
              >
                <span className="sidebar__item-icon"><ClockIcon size={16} /></span>
                {p.name}
                {p.trackCount != null && (
                  <span className="sidebar__item-count">{p.trackCount}</span>
                )}
              </button>
            </li>
          ))}
      </ul>

      <div className="sidebar__footer">
        <button className="sidebar__action" onClick={() => setShowAddPlaylist(true)}>
          <PlusIcon size={14} /> New Playlist
        </button>
        <button className="sidebar__action" onClick={() => setShowAutoRules(true)}>
          <SettingsIcon /> Auto Rules
        </button>
      </div>

      {showAddPlaylist && <AddPlaylistDialog onClose={() => setShowAddPlaylist(false)} />}
      {showAutoRules && <AutoRuleDialog onClose={() => setShowAutoRules(false)} />}
    </aside>
  );
}

function HeartIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}
