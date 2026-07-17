'use client';

import { useAppStore } from '../hooks/useAppStore';
import { categoryName } from '../lib/categories';
import { CloseIcon, PlayIcon } from './icons';
import SearchBar from './SearchBar';
import TrackList from './TrackList';
import UrlInput from './UrlInput';

export default function PlaylistView() {
  const {
    playlists,
    currentPlaylistId,
    selectedCategory,
    tracks,
    query,
    setQuery,
    addTrackFromUrl,
    playAll,
    selectCategory,
    loading,
    error,
  } = useAppStore();

  const currentPlaylist =
    currentPlaylistId === -1
      ? { name: 'Yêu thích' }
      : playlists.find((p) => p.id === currentPlaylistId) || {
          name: 'Tất cả bài hát',
        };

  const categoryLabel = selectedCategory
    ? categoryName(selectedCategory)
    : null;
  const playlistTitle =
    currentPlaylistId === 1 ? 'Tất cả bài hát' : currentPlaylist.name;

  return (
    <div className="main">
      <div className="main__header">
        <div className="main__heading">
          <h1 className="main__title">
            {categoryLabel ? `Nhạc ${categoryLabel}` : playlistTitle}
          </h1>
          <p className="main__subtitle">
            {categoryLabel
              ? `${tracks.length} bài hát`
              : currentPlaylistId === 1
                ? 'Nhạc đã tải về của bạn'
                : currentPlaylistId === -1
                  ? 'Những bài bạn đã thích'
                  : `${tracks.length} bài hát`}
          </p>
        </div>
        {tracks.length > 0 && (
          <button type="button" className="main__play-all" onClick={playAll}>
            <PlayIcon size={14} /> Phát tất cả
          </button>
        )}
        <UrlInput
          onAdd={addTrackFromUrl}
          loading={loading}
          error={error}
          compact
        />
      </div>
      <div className="main__body">
        <div className="main__list-toolbar">
          <SearchBar value={query} onChange={setQuery} />
          {selectedCategory && (
            <button
              type="button"
              className="main__filter-chip is-active"
              onClick={() => selectCategory(null)}
            >
              {categoryLabel}
              <CloseIcon size={12} />
            </button>
          )}
        </div>
        <TrackList />
      </div>
    </div>
  );
}
