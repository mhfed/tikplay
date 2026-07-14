'use client';

import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import AddPlaylistDialog from './AddPlaylistDialog';
import AutoRuleDialog from './AutoRuleDialog';
import { ClockIcon, CloseIcon, ListMusicIcon, PlusIcon } from './icons';

interface MobileSidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function MobileSidebar({
  visible,
  onClose,
}: MobileSidebarProps) {
  const { playlists, currentPlaylistId, view, selectPlaylist } = useAppStore();
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showAutoRules, setShowAutoRules] = useState(false);

  const handleSelect = (id: number) => {
    selectPlaylist(id);
    onClose();
  };

  return (
    <>
      <div
        className={`mobile-sidebar-backdrop${visible ? ' is-visible' : ''}`}
        onClick={onClose}
      />
      <aside className={`mobile-sidebar${visible ? ' is-visible' : ''}`}>
        <div className="mobile-sidebar__header">
          <h2 className="mobile-sidebar__title">Playlists</h2>
          <button
            className="mobile-sidebar__close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="mobile-sidebar__section">Library</div>
        <ul className="mobile-sidebar__list">
          <li>
            <button
              className={`mobile-sidebar__item${view === 'library' && currentPlaylistId === 1 ? ' is-active' : ''}`}
              onClick={() => handleSelect(1)}
            >
              <ListMusicIcon size={18} />
              All Tracks
            </button>
          </li>
          <li>
            <button
              className={`mobile-sidebar__item${view === 'library' && currentPlaylistId === -1 ? ' is-active' : ''}`}
              onClick={() => handleSelect(-1)}
            >
              <HeartIcon />
              Favorites
            </button>
          </li>
        </ul>

        <div className="mobile-sidebar__section">Playlists</div>
        <ul className="mobile-sidebar__list">
          {playlists
            .filter((p) => p.id !== 1)
            .map((p) => (
              <li key={p.id}>
                <button
                  className={`mobile-sidebar__item${view === 'library' && currentPlaylistId === p.id ? ' is-active' : ''}`}
                  onClick={() => handleSelect(p.id)}
                >
                  <ClockIcon size={18} />
                  {p.name}
                  {p.trackCount != null && (
                    <span className="mobile-sidebar__count">
                      {p.trackCount}
                    </span>
                  )}
                </button>
              </li>
            ))}
        </ul>

        <div className="mobile-sidebar__footer">
          <button
            className="mobile-sidebar__action"
            onClick={() => setShowAddPlaylist(true)}
          >
            <PlusIcon size={16} /> New Playlist
          </button>
          <button
            className="mobile-sidebar__action"
            onClick={() => setShowAutoRules(true)}
          >
            <SettingsIcon /> Auto Rules
          </button>
        </div>

        {showAddPlaylist && (
          <AddPlaylistDialog onClose={() => setShowAddPlaylist(false)} />
        )}
        {showAutoRules && (
          <AutoRuleDialog onClose={() => setShowAutoRules(false)} />
        )}
      </aside>
    </>
  );
}

function HeartIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}
