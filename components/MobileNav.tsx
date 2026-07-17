'use client';

import Link from 'next/link';
import { ListMusicIcon, MusicIcon } from './icons';

export type MobileTab = 'home' | 'tracks' | 'player' | 'playlists';

interface MobileNavProps {
  activeTab: MobileTab;
  onChange: (tab: MobileTab) => void;
  hasTrack: boolean;
}

export default function MobileNav({
  activeTab,
  onChange,
  hasTrack,
}: MobileNavProps) {
  return (
    <nav className="mobile-nav">
      <Link
        href="/"
        className={`mobile-nav__tab${activeTab === 'home' ? ' is-active' : ''}`}
        onClick={() => onChange('home')}
      >
        <span className="mobile-nav__icon">
          <HomeIcon />
        </span>
        <span>Home</span>
      </Link>
      <Link
        href="/library"
        className={`mobile-nav__tab${activeTab === 'tracks' ? ' is-active' : ''}`}
        onClick={() => onChange('tracks')}
      >
        <span className="mobile-nav__icon">
          <ListMusicIcon size={20} />
        </span>
        <span>Library</span>
      </Link>
      <button
        className={`mobile-nav__tab${activeTab === 'player' ? ' is-active' : ''}`}
        onClick={() => onChange('player')}
        disabled={!hasTrack}
      >
        <span className="mobile-nav__icon">
          <MusicIcon size={20} />
        </span>
        <span>Player</span>
      </button>
      <button
        className={`mobile-nav__tab${activeTab === 'playlists' ? ' is-active' : ''}`}
        onClick={() => onChange('playlists')}
      >
        <span className="mobile-nav__icon">
          <PlaylistsIcon />
        </span>
        <span>Playlists</span>
      </button>
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg
      width="20"
      height="20"
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

function PlaylistsIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M4 6h16" />
      <path d="M4 10h16" />
      <path d="M4 14h16" />
      <path d="M4 18h16" />
    </svg>
  );
}
