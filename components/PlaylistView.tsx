'use client';

import { useAppStore } from '../hooks/useAppStore';
import UrlInput from './UrlInput';
import TrackList from './TrackList';
import SearchBar from './SearchBar';
import { PlayIcon } from './icons';

export default function PlaylistView() {
  const {
    playlists,
    currentPlaylistId,
    tracks,
    query,
    setQuery,
    addTrackFromUrl,
    playAll,
    loading,
    error,
  } = useAppStore();

  const currentPlaylist = currentPlaylistId === -1
    ? { name: 'Favorites' }
    : playlists.find((p) => p.id === currentPlaylistId) || { name: 'All Tracks' };

  return (
    <div className="main">
      <div className="main__header">
        <div className="main__heading">
          <h1 className="main__title">{currentPlaylist.name}</h1>
          <p className="main__subtitle">
            {currentPlaylistId === 1
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
        <SearchBar value={query} onChange={setQuery} />
      </div>
      <div className="main__body">
        <UrlInput
          onAdd={addTrackFromUrl}
          loading={loading}
          error={error}
        />
        <TrackList />
      </div>
    </div>
  );
}
