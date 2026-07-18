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
  const tabClass =
    'flex flex-1 cursor-pointer flex-col items-center justify-center gap-[3px] rounded-control border-0 bg-transparent px-1 py-1.5 text-[11px] font-semibold text-muted transition-[color,background,transform,opacity] duration-[var(--motion-fast)] ease-out-app hover:text-accent disabled:cursor-not-allowed disabled:opacity-30';
  const activeClass = ' -translate-y-px bg-accent-muted text-accent';
  const iconClass =
    'mb-0.5 flex scale-110 items-center justify-center transition-transform duration-[var(--motion-base)] ease-spring group-aria-current-page:-translate-y-px group-aria-current-page:scale-[1.16] group-aria-pressed:-translate-y-px group-aria-pressed:scale-[1.16]';

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 hidden h-[var(--bottom-stack)] isolate gap-1 border-t border-line-soft bg-[rgba(14,14,16,0.94)] px-2 pt-1 pb-[calc(4px+env(safe-area-inset-bottom))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur-[20px] max-[1024px]:flex"
      aria-label="Điều hướng chính"
    >
      <Link
        href="/"
        className={`group ${tabClass}${activeTab === 'home' ? activeClass : ''}`}
        onClick={() => onChange('home')}
        aria-current={activeTab === 'home' ? 'page' : undefined}
      >
        <span className={iconClass}>
          <HomeIcon size={20} />
        </span>
        <span>Trang chủ</span>
      </Link>
      <Link
        href="/library"
        className={`group ${tabClass}${activeTab === 'tracks' ? activeClass : ''}`}
        onClick={() => onChange('tracks')}
        aria-current={activeTab === 'tracks' ? 'page' : undefined}
      >
        <span className={iconClass}>
          <ListMusicIcon size={20} />
        </span>
        <span>Thư viện</span>
      </Link>
      <button
        type="button"
        className={`group ${tabClass}${activeTab === 'player' ? activeClass : ''}`}
        onClick={() => onChange('player')}
        disabled={!hasTrack}
        aria-pressed={activeTab === 'player'}
      >
        <span className={iconClass}>
          <MusicIcon size={20} />
        </span>
        <span>Trình phát</span>
      </button>
      <button
        type="button"
        className={`group ${tabClass}${activeTab === 'playlists' ? activeClass : ''}`}
        onClick={() => onChange('playlists')}
        aria-pressed={activeTab === 'playlists'}
      >
        <span className={iconClass}>
          <PlaylistsIcon size={20} />
        </span>
        <span>Playlist</span>
      </button>
    </nav>
  );
}
