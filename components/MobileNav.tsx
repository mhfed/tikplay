'use client';

import Link from 'next/link';
import { HomeIcon, ListMusicIcon, MusicIcon, PlaylistsIcon } from './icons';

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
    <nav className="mobile-nav" aria-label="Điều hướng chính">
      <Link
        href="/"
        className={`mobile-nav__tab${activeTab === 'home' ? ' is-active' : ''}`}
        onClick={() => onChange('home')}
        aria-current={activeTab === 'home' ? 'page' : undefined}
      >
        <span className="mobile-nav__icon">
          <HomeIcon size={20} />
        </span>
        <span>Trang chủ</span>
      </Link>
      <Link
        href="/library"
        className={`mobile-nav__tab${activeTab === 'tracks' ? ' is-active' : ''}`}
        onClick={() => onChange('tracks')}
        aria-current={activeTab === 'tracks' ? 'page' : undefined}
      >
        <span className="mobile-nav__icon">
          <ListMusicIcon size={20} />
        </span>
        <span>Thư viện</span>
      </Link>
      <button
        type="button"
        className={`mobile-nav__tab${activeTab === 'player' ? ' is-active' : ''}`}
        onClick={() => onChange('player')}
        disabled={!hasTrack}
        aria-pressed={activeTab === 'player'}
      >
        <span className="mobile-nav__icon">
          <MusicIcon size={20} />
        </span>
        <span>Trình phát</span>
      </button>
      <button
        type="button"
        className={`mobile-nav__tab${activeTab === 'playlists' ? ' is-active' : ''}`}
        onClick={() => onChange('playlists')}
        aria-pressed={activeTab === 'playlists'}
      >
        <span className="mobile-nav__icon">
          <PlaylistsIcon size={20} />
        </span>
        <span>Playlist</span>
      </button>
    </nav>
  );
}
