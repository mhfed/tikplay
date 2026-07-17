'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import AddPlaylistDialog from './AddPlaylistDialog';
import AutoRuleDialog from './AutoRuleDialog';
import {
  ClockIcon,
  HeartIcon,
  HomeIcon,
  ListMusicIcon,
  MusicIcon,
  PlusIcon,
  SettingsIcon,
  TagIcon,
} from './icons';

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
            <span className="sidebar__tagline">Nhạc từ TikTok</span>
          </Link>
        </div>
      </div>

      <div className="sidebar__section">Thư viện</div>
      <ul className="sidebar__list">
        <li>
          <Link
            href="/"
            className={`sidebar__item${isActive('/') ? ' is-active' : ''}`}
          >
            <span className="sidebar__item-icon">
              <HomeIcon size={16} />
            </span>
            Trang chủ
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
            Tất cả bài hát
          </Link>
        </li>
        <li>
          <Link
            href="/library/favorites"
            className={`sidebar__item${isActive('/library/favorites') ? ' is-active' : ''}`}
          >
            <span className="sidebar__item-icon">
              <HeartIcon size={16} />
            </span>
            Yêu thích
          </Link>
        </li>
      </ul>

      <div className="sidebar__section">Danh sách phát</div>
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
          <div className="sidebar__section">Thể loại</div>
          <ul className="sidebar__list">
            {categories
              .filter((c) => c.count && c.count > 0)
              .map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    className={`sidebar__item${selectedCategory === c.slug ? ' is-active' : ''}`}
                    onClick={() => selectCategory(c.slug)}
                  >
                    <span className="sidebar__item-icon">
                      <TagIcon size={16} />
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
          type="button"
          className="sidebar__action"
          onClick={() => setShowAddPlaylist(true)}
        >
          <PlusIcon size={14} /> Tạo danh sách
        </button>
        <button
          type="button"
          className="sidebar__action"
          onClick={() => setShowAutoRules(true)}
        >
          <SettingsIcon size={14} /> Quy tắc tự động
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
