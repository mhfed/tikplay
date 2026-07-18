'use client';

import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import AddPlaylistDialog from './AddPlaylistDialog';
import AutoRuleDialog from './AutoRuleDialog';
import {
  ClockIcon,
  CloseIcon,
  HeartIcon,
  ListMusicIcon,
  PlusIcon,
  SettingsIcon,
  TagIcon,
} from './icons';

interface MobileSidebarProps {
  visible: boolean;
  onClose: () => void;
}

export default function MobileSidebar({
  visible,
  onClose,
}: MobileSidebarProps) {
  const {
    playlists,
    categories,
    sources,
    currentPlaylistId,
    selectedCategory,
    selectedSource,
    view,
    selectPlaylist,
    selectCategory,
    selectSource,
  } = useAppStore();
  const [showAddPlaylist, setShowAddPlaylist] = useState(false);
  const [showAutoRules, setShowAutoRules] = useState(false);

  const handleSelect = (id: number) => {
    selectPlaylist(id);
    onClose();
  };
  const sectionClass =
    'px-4 pb-1 pt-3 text-[11px] font-bold uppercase tracking-[0.8px] text-muted-2';
  const listClass = 'list-none px-2';
  const itemClass =
    'flex w-full cursor-pointer items-center gap-3 rounded-control border-0 bg-transparent px-3 py-3 text-left text-[15px] font-medium text-muted transition-[background,color] duration-[120ms] hover:bg-surface hover:text-ink-secondary';
  const activeItemClass = ' bg-accent-muted font-semibold text-accent';
  const actionClass =
    'flex w-full cursor-pointer items-center gap-2.5 rounded-control border-0 bg-transparent px-3 py-3 text-left text-sm font-semibold text-muted transition-[background,color] duration-[120ms] hover:bg-surface hover:text-ink-secondary';

  return (
    <>
      <button
        type="button"
        className={`fixed inset-x-0 top-0 bottom-[var(--bottom-stack)] z-[44] hidden bg-black/50 transition-[opacity,visibility] duration-[var(--motion-base)] ease-out-app max-[1024px]:block${visible ? ' visible opacity-100' : ' invisible opacity-0'}`}
        onClick={onClose}
        aria-label="Đóng danh sách phát"
      />
      <aside
        className={`fixed top-0 bottom-[var(--bottom-stack)] left-0 z-[48] hidden w-full flex-col overflow-y-auto bg-[rgba(14,14,16,0.97)] opacity-[0.92] shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] backdrop-blur-[20px] transition-[transform,opacity] duration-[var(--motion-base)] ease-out-app max-[1024px]:flex${visible ? ' translate-x-0 opacity-100' : ' -translate-x-full'}`}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line-soft px-4 pb-3 pt-[calc(16px+env(safe-area-inset-top))]">
          <h2 className="font-display text-lg font-extrabold text-ink">
            Danh sách phát
          </h2>
          <button
            type="button"
            className="flex cursor-pointer items-center border-0 bg-transparent p-1 text-muted hover:text-ink"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className={sectionClass}>Thư viện</div>
        <ul className={listClass}>
          <li>
            <button
              type="button"
              className={`${itemClass}${view === 'library' && currentPlaylistId === 1 && !selectedCategory && !selectedSource ? activeItemClass : ''}`}
              onClick={() => handleSelect(1)}
            >
              <ListMusicIcon size={18} />
              Tất cả bài hát
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`${itemClass}${view === 'library' && currentPlaylistId === -1 ? activeItemClass : ''}`}
              onClick={() => handleSelect(-1)}
            >
              <HeartIcon size={18} />
              Yêu thích
            </button>
          </li>
        </ul>

        <div className={sectionClass}>Danh sách phát</div>
        <ul className={listClass}>
          {playlists
            .filter((p) => p.id !== 1)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  className={`${itemClass}${view === 'library' && currentPlaylistId === p.id ? activeItemClass : ''}`}
                  onClick={() => handleSelect(p.id)}
                >
                  <ClockIcon size={18} />
                  {p.name}
                  {p.trackCount != null && (
                    <span className="ml-auto text-xs text-muted-2">
                      {p.trackCount}
                    </span>
                  )}
                </button>
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
                      onClick={() => {
                        selectCategory(c.slug);
                        onClose();
                      }}
                    >
                      <TagIcon size={18} />
                      {c.name}
                      {c.count != null && (
                        <span className="ml-auto text-xs text-muted-2">
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
                      onClick={() => {
                        selectSource(s.slug);
                        onClose();
                      }}
                    >
                      <ListMusicIcon size={18} />
                      {s.name}
                      <span className="ml-auto text-xs text-muted-2">
                        {s.count}
                      </span>
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        <div className="mt-auto flex shrink-0 flex-col gap-1 border-t border-line-soft p-3">
          <button
            type="button"
            className={actionClass}
            onClick={() => setShowAddPlaylist(true)}
          >
            <PlusIcon size={16} /> Tạo danh sách
          </button>
          <button
            type="button"
            className={actionClass}
            onClick={() => setShowAutoRules(true)}
          >
            <SettingsIcon size={16} /> Quy tắc tự động
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
