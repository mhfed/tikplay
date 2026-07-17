'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import AddPlaylistDialog from './AddPlaylistDialog';
import AutoRuleDialog from './AutoRuleDialog';
import { ClockIcon, ListMusicIcon, MusicIcon, PlusIcon } from './icons';

export default function Sidebar() {
  const { playlists, categories, selectedCategory, selectCategory } =
    useAppStore();
  const pathname = usePathname();
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showAutoRules, setShowAutoRules] = useState(false);

  const isActive = (href: string) => pathname === href;

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__logo">
          <MusicIcon size={18} />
        </div>
        <div className="sidebar__brand-text">
          <Link href="/" className="sidebar__brand-link">
            <span className="sidebar__name">TikPlay</span>
            <span className="sidebar__tagline">Vibe with TikTok</span>
          </Link>
        </div>
      </div>

      <div className="sidebar__section">Library</div>
      <ul className="sidebar__list">
        <li>
          <Link
            href="/"
            className={`sidebar__item${isActive('/') ? ' is-active' : ''}`}
          >
            <span className="sidebar__item-icon">
              <HomeIcon />
            </span>
            Home
          </Link>
        </li>
        <li>
          <Link
            href="/library"
            className={`sidebar__item${isActive('/library') ? ' is-active' : ''}`}
          >
            <span className="sidebar__item-icon">
              <ListMusicIcon size={16} />
            </span>
            All Tracks
          </Link>
        </li>
        <li>
          <Link
            href="/library/favorites"
            className={`sidebar__item${isActive('/library/favorites') ? ' is-active' : ''}`}
          >
            <span className="sidebar__item-icon">
              <HeartIcon />
            </span>
            Favorites
          </Link>
        </li>
      </ul>

      <div className="sidebar__section">Playlists</div>
      <ul className="sidebar__list">
        {playlists
          .filter((p) => p.id !== 1)
          .map((p) => (
            <li key={p.id}>
              <Link
                href={`/library/${p.id}`}
                className={`sidebar__item${isActive(`/library/${p.id}`) ? ' is-active' : ''}`}
              >
                <span className="sidebar__item-icon">
                  <ClockIcon size={16} />
                </span>
                {p.name}
                {p.trackCount != null && (
                  <span className="sidebar__item-count">{p.trackCount}</span>
                )}
              </Link>
            </li>
          ))}
      </ul>

      {categories.length > 0 && (
        <>
          <div className="sidebar__section">Categories</div>
          <ul className="sidebar__list">
            {categories
              .filter((c) => c.count && c.count > 0)
              .map((c) => (
                <li key={c.slug}>
                  <button
                    className={`sidebar__item${selectedCategory === c.slug ? ' is-active' : ''}`}
                    onClick={() => selectCategory(c.slug)}
                  >
                    <span className="sidebar__item-icon">
                      <TagIcon />
                    </span>
                    {c.name}
                    {c.count != null && (
                      <span className="sidebar__item-count">{c.count}</span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      <div className="sidebar__footer">
        <button
          className="sidebar__action"
          onClick={() => setShowAddPlaylist(true)}
        >
          <PlusIcon size={14} /> New Playlist
        </button>
        <button
          className="sidebar__action"
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
  );
}

function TagIcon() {
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
      <path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z" />
      <path d="M7 7h.01" />
    </svg>
  );
}

function HomeIcon() {
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
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10v9.5a1 1 0 0 0 1 1H9a1 1 0 0 0 1-1V16a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v3.5a1 1 0 0 0 1 1h2.5a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

function HeartIcon() {
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
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="14"
      height="14"
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
