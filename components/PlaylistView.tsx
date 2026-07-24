'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { categoryName } from '../lib/categories';
import { MEDIA_SOURCE_LABELS } from '../lib/media/source';
import { CloseIcon, PlayIcon, SettingsIcon } from './icons';
import SearchBar from './SearchBar';
import TrackList from './TrackList';
import UrlInput from './UrlInput';

const PlaylistManageDialog = dynamic(() => import('./PlaylistManageDialog'), {
  ssr: false,
});

export default function PlaylistView() {
  const {
    playlists,
    currentPlaylistId,
    selectedCategory,
    selectedSource,
    tracks,
    query,
    setQuery,
    addTrackFromUrl,
    playAll,
    selectCategory,
    selectSource,
    loading,
    pageLoading,
    hasMoreTracks,
    totalTracks,
    loadMoreTracks,
    error,
    trackSort,
    setTrackSort,
  } = useAppStore();
  const [showPlaylistManager, setShowPlaylistManager] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const target = loadMoreRef.current;
    if (!target || !hasMoreTracks) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !pageLoading) {
          void loadMoreTracks();
        }
      },
      { rootMargin: '600px 0px' },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMoreTracks, loadMoreTracks, pageLoading]);

  const currentPlaylist =
    currentPlaylistId === -1
      ? { name: 'Yêu thích' }
      : playlists.find((p) => p.id === currentPlaylistId) || {
          name: 'Tất cả bài hát',
        };

  const categoryLabel = selectedCategory
    ? categoryName(selectedCategory)
    : null;
  const sourceLabel = selectedSource
    ? MEDIA_SOURCE_LABELS[selectedSource]
    : null;
  const playlistTitle =
    currentPlaylistId === 1 ? 'Tất cả bài hát' : currentPlaylist.name;

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-[var(--header-h)] shrink-0 items-center gap-4 border-b border-line-soft px-6 py-3 max-[1024px]:min-h-[calc(var(--header-h)+env(safe-area-inset-top))] max-[1024px]:flex-wrap max-[1024px]:pt-[calc(12px+env(safe-area-inset-top))] max-[640px]:h-auto max-[640px]:gap-2.5 max-[640px]:px-4 max-[640px]:pb-3 max-[640px]:pt-[calc(10px+env(safe-area-inset-top))]">
        <div className="flex min-w-0 flex-col gap-0.5 max-[640px]:flex-[1_1_0]">
          <h1 className="truncate font-display text-xl font-extrabold max-[640px]:text-[17px]">
            {sourceLabel ??
              (categoryLabel ? `Nhạc ${categoryLabel}` : playlistTitle)}
          </h1>
          <p className="truncate font-mono text-[11px] text-muted">
            {sourceLabel
              ? `${totalTracks} bài từ ${sourceLabel}`
              : categoryLabel
                ? `${totalTracks} bài hát`
                : currentPlaylistId === 1
                  ? 'Nhạc đã tải về của bạn'
                  : currentPlaylistId === -1
                    ? 'Những bài bạn đã thích'
                    : `${totalTracks} bài hát`}
          </p>
        </div>
        {tracks.length > 0 && (
          <button
            type="button"
            className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-full border-0 bg-linear-to-br from-accent to-tertiary px-4 py-[7px] text-[13px] font-bold text-[#00201e] shadow-[0_0_20px_var(--accent-glow)] transition-[filter,transform] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.97] max-[640px]:px-3 max-[640px]:py-1.5 max-[640px]:text-xs"
            onClick={playAll}
          >
            <PlayIcon size={14} /> Phát tất cả
          </button>
        )}
        {currentPlaylistId > 1 && 'id' in currentPlaylist && (
          <button
            type="button"
            className="grid size-8 shrink-0 place-items-center rounded-control border border-line bg-surface text-muted transition-colors hover:text-accent"
            onClick={() => setShowPlaylistManager(true)}
            aria-label="Quản lý danh sách phát"
            title="Quản lý danh sách"
          >
            <SettingsIcon size={16} />
          </button>
        )}
        <UrlInput
          onAdd={addTrackFromUrl}
          loading={loading}
          error={error}
          compact
        />
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-6 pt-4 max-[1024px]:pb-[calc(var(--player-bar-h-mobile)+36px)] max-[640px]:px-4 max-[640px]:pb-[calc(var(--mini-h)+40px)] max-[640px]:pt-3">
        <div className="mb-4 flex w-full min-w-0 items-center gap-2 max-[640px]:mb-3 max-[640px]:flex-wrap">
          <SearchBar value={query} onChange={setQuery} />
          <select
            className="shrink-0 rounded-control border border-line bg-surface px-3 py-1.5 text-xs font-semibold text-ink outline-none focus:border-accent"
            value={trackSort}
            onChange={(event) =>
              setTrackSort(
                event.target.value as Parameters<typeof setTrackSort>[0],
              )
            }
            aria-label="Sắp xếp bài hát"
          >
            {currentPlaylistId > 1 && (
              <option value="playlist">Tùy chỉnh</option>
            )}
            <option value="added_desc">Mới thêm</option>
            <option value="added_asc">Cũ nhất</option>
            <option value="title">Tên bài hát</option>
            <option value="author">Nghệ sĩ</option>
            <option value="duration">Thời lượng</option>
            <option value="source">Nguồn</option>
            <option value="category">Thể loại</option>
          </select>
          {selectedCategory && (
            <button
              type="button"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-accent bg-accent-muted px-3 py-1.5 text-xs font-semibold text-accent transition-[background,transform] duration-[var(--motion-fast)] ease-spring hover:-translate-y-px hover:bg-[rgba(0,221,214,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&_svg]:opacity-70"
              onClick={() => selectCategory(null)}
            >
              {categoryLabel}
              <CloseIcon size={12} />
            </button>
          )}
          {selectedSource && sourceLabel && (
            <button
              type="button"
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border border-accent bg-accent-muted px-3 py-1.5 text-xs font-semibold text-accent transition-[background,transform] duration-[var(--motion-fast)] ease-spring hover:-translate-y-px hover:bg-[rgba(0,221,214,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent [&_svg]:opacity-70"
              onClick={() => selectSource(null)}
            >
              {sourceLabel}
              <CloseIcon size={12} />
            </button>
          )}
        </div>
        <TrackList />
        <div
          ref={loadMoreRef}
          className="flex min-h-12 items-center justify-center"
        >
          {hasMoreTracks && (
            <button
              type="button"
              className="rounded-control border border-line bg-surface px-4 py-2 text-xs font-semibold text-muted transition-colors hover:border-accent hover:text-accent disabled:cursor-wait disabled:opacity-60"
              onClick={() => void loadMoreTracks()}
              disabled={pageLoading}
            >
              {pageLoading
                ? 'Đang tải thêm…'
                : `Tải thêm (${tracks.length}/${totalTracks})`}
            </button>
          )}
        </div>
      </div>
      {showPlaylistManager &&
        currentPlaylistId > 1 &&
        'id' in currentPlaylist && (
          <PlaylistManageDialog
            playlist={currentPlaylist}
            onClose={() => setShowPlaylistManager(false)}
          />
        )}
    </div>
  );
}
