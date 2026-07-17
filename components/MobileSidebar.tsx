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
    currentPlaylistId,
    selectedCategory,
    view,
    selectPlaylist,
    selectCategory,
  } = useAppStore();
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
          <h2 className="mobile-sidebar__title">Danh sách phát</h2>
          <button
            type="button"
            className="mobile-sidebar__close"
            onClick={onClose}
            aria-label="Đóng"
            title="Đóng"
          >
            <CloseIcon size={20} />
          </button>
        </div>

        <div className="mobile-sidebar__section">Thư viện</div>
        <ul className="mobile-sidebar__list">
          <li>
            <button
              type="button"
              className={`mobile-sidebar__item${view === 'library' && currentPlaylistId === 1 ? ' is-active' : ''}`}
              onClick={() => handleSelect(1)}
            >
              <ListMusicIcon size={18} />
              Tất cả bài hát
            </button>
          </li>
          <li>
            <button
              type="button"
              className={`mobile-sidebar__item${view === 'library' && currentPlaylistId === -1 ? ' is-active' : ''}`}
              onClick={() => handleSelect(-1)}
            >
              <HeartIcon size={18} />
              Yêu thích
            </button>
          </li>
        </ul>

        <div className="mobile-sidebar__section">Danh sách phát</div>
        <ul className="mobile-sidebar__list">
          {playlists
            .filter((p) => p.id !== 1)
            .map((p) => (
              <li key={p.id}>
                <button
                  type="button"
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

        {categories.length > 0 && (
          <>
            <div className="mobile-sidebar__section">Thể loại</div>
            <ul className="mobile-sidebar__list">
              {categories
                .filter((c) => c.count && c.count > 0)
                .map((c) => (
                  <li key={c.slug}>
                    <button
                      type="button"
                      className={`mobile-sidebar__item${selectedCategory === c.slug ? ' is-active' : ''}`}
                      onClick={() => {
                        selectCategory(c.slug);
                        onClose();
                      }}
                    >
                      <TagIcon size={18} />
                      {c.name}
                      {c.count != null && (
                        <span className="mobile-sidebar__count">{c.count}</span>
                      )}
                    </button>
                  </li>
                ))}
            </ul>
          </>
        )}

        <div className="mobile-sidebar__footer">
          <button
            type="button"
            className="mobile-sidebar__action"
            onClick={() => setShowAddPlaylist(true)}
          >
            <PlusIcon size={16} /> Tạo danh sách
          </button>
          <button
            type="button"
            className="mobile-sidebar__action"
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
