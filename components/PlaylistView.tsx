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
      ? { name: 'Favorites' }
      : playlists.find((p) => p.id === currentPlaylistId) || {
          name: 'All Tracks',
        };

  const categoryLabel = selectedCategory ? categoryName(selectedCategory) : null;

  return (
    <div className="main">
      <div className="main__header">
        <div className="main__heading">
          <h1 className="main__title">
            {categoryLabel ? `${categoryLabel} Music` : currentPlaylist.name}
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
          <button className="main__play-all" onClick={playAll}>
            <PlayIcon size={14} /> Play All
          </button>
        )}
        <div className="main__filters">
          {selectedCategory && (
            <button
              className="main__filter-chip is-active"
              onClick={() => selectCategory(null)}
            >
              {categoryLabel}
              <CloseIcon size={12} />
            </button>
          )}
          <SearchBar value={query} onChange={setQuery} />
        </div>
      </div>
      <div className="main__body">
        <UrlInput onAdd={addTrackFromUrl} loading={loading} error={error} />
        <TrackList />
      </div>
    </div>
  );
}
