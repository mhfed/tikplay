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
  const {
    playlists,
    categories,
    sources,
    selectedCategory,
    selectedSource,
    selectCategory,
    selectSource,
  } = useAppStore();
  const pathname = usePathname();
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showAutoRules, setShowAutoRules] = useState(false);

  const isActive = (href: string) => pathname === href;
  const itemClass =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-3 py-[9px] text-left text-sm font-medium text-muted transition-[background,color,transform] duration-[var(--motion-fast)] ease-out-app hover:translate-x-0.5 hover:bg-surface hover:text-ink-secondary';
  const activeItemClass = ' bg-accent-muted font-semibold text-accent';
  const sectionClass =
    'px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-[0.8px] text-muted-2';
  const listClass = 'min-h-0 flex-1 list-none overflow-y-auto px-2';
  const iconClass =
    'inline-flex w-5 shrink-0 items-center justify-center text-base';
  const actionClass =
    'flex w-full cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-3 py-2 text-left text-[13px] font-semibold text-muted transition-[background,color,transform] duration-[var(--motion-fast)] ease-out-app hover:translate-x-0.5 hover:bg-surface hover:text-ink-secondary';

  return (
    <aside className="flex w-[var(--sidebar-w)] shrink-0 flex-col overflow-hidden border-r border-line-soft bg-[var(--glass-bg)] backdrop-blur-[20px] max-[1024px]:hidden">
      <div className="flex shrink-0 items-center gap-2.5 px-4 pb-4 pt-5">
        <div className="grid size-9 place-items-center rounded-compact bg-linear-to-br from-accent to-tertiary text-lg text-[#00201e] shadow-[0_0_16px_var(--accent-glow)]">
          <MusicIcon size={18} />
        </div>
        <div className="flex min-w-0 flex-col gap-px">
          <Link href="/" className="flex min-w-0 flex-col">
            <span className="font-display text-xl font-extrabold text-ink [text-shadow:0_0_12px_var(--accent-glow)]">
              TikPlay
            </span>
            <span className="truncate font-mono text-[10px] tracking-[0.04em] text-muted-2">
              Nhạc từ TikTok & YouTube
            </span>
          </Link>
        </div>
      </div>

      <div className={sectionClass}>Thư viện</div>
      <ul className={listClass}>
        <li>
          <Link
            href="/"
            className={`${itemClass}${isActive('/') ? activeItemClass : ''}`}
          >
            <span className={iconClass}>
              <HomeIcon size={16} />
            </span>
            Trang chủ
          </Link>
        </li>
        <li>
          <Link
            href="/library"
            className={`${itemClass}${isActive('/library') ? activeItemClass : ''}`}
          >
            <span className={iconClass}>
              <ListMusicIcon size={16} />
            </span>
            Tất cả bài hát
          </Link>
        </li>
        <li>
          <Link
            href="/library/favorites"
            className={`${itemClass}${isActive('/library/favorites') ? activeItemClass : ''}`}
          >
            <span className={iconClass}>
              <HeartIcon size={16} />
            </span>
            Yêu thích
          </Link>
        </li>
      </ul>

      <div className={sectionClass}>Danh sách phát</div>
      <ul className={listClass}>
        {playlists
          .filter((p) => p.id !== 1)
          .map((p) => (
            <li key={p.id}>
              <Link
                href={`/library/${p.id}`}
                className={`${itemClass}${isActive(`/library/${p.id}`) ? activeItemClass : ''}`}
              >
                <span className={iconClass}>
                  <ClockIcon size={16} />
                </span>
                {p.name}
                {p.trackCount != null && (
                  <span className="ml-auto text-xs text-muted-2 tabular-nums">
                    {p.trackCount}
                  </span>
                )}
              </Link>
            </li>
          ))}
      </ul>

      {categories.length > 0 && (
        <>
          <div className={sectionClass}>Thể loại</div>
          <ul className={listClass}>
            {categories
              .filter((c) => c.count && c.count > 0)
              .map((c) => (
                <li key={c.slug}>
                  <button
                    type="button"
                    className={`${itemClass}${selectedCategory === c.slug ? activeItemClass : ''}`}
                    onClick={() => selectCategory(c.slug)}
                  >
                    <span className={iconClass}>
                      <TagIcon size={16} />
                    </span>
                    {c.name}
                    {c.count != null && (
                      <span className="ml-auto text-xs text-muted-2 tabular-nums">
                        {c.count}
                      </span>
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      {sources.some((s) => s.count > 0) && (
        <>
          <div className={sectionClass}>Nguồn</div>
          <ul className={listClass}>
            {sources
              .filter((s) => s.count > 0)
              .map((s) => (
                <li key={s.slug}>
                  <button
                    type="button"
                    className={`${itemClass}${selectedSource === s.slug ? activeItemClass : ''}`}
                    onClick={() => selectSource(s.slug)}
                  >
                    <span className={iconClass}>
                      <MusicIcon size={16} />
                    </span>
                    {s.name}
                    <span className="ml-auto text-xs text-muted-2 tabular-nums">
                      {s.count}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </>
      )}

      <div className="flex shrink-0 flex-col gap-1 border-t border-line-soft p-3">
        <button
          type="button"
          className={actionClass}
          onClick={() => setShowAddPlaylist(true)}
        >
          <PlusIcon size={14} /> Tạo danh sách
        </button>
        <button
          type="button"
          className={actionClass}
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
