'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import type { Track } from '../lib/types';
import { CloseIcon, RefreshCwIcon, SpinnerIcon } from './icons';
import TrackRow from './TrackRow';

const SortableTrackList = dynamic(() => import('./SortableTrackList'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-20 items-center justify-center text-muted">
      <SpinnerIcon size={18} />
      <span className="ml-2 text-xs">Đang bật sắp xếp…</span>
    </div>
  ),
});
const TrackActionsDialog = dynamic(() => import('./TrackActionsDialog'), {
  ssr: false,
});

const VIRTUALIZE_AFTER = 80;
const ESTIMATED_ROW_HEIGHT = 57;
const OVERSCAN_ROWS = 8;

export default function TrackList() {
  const {
    tracks,
    importJobs,
    currentTrack,
    isPlaying,
    favorites,
    currentPlaylistId,
    playTrack,
    togglePlay,
    toggleFavorite,
    removeTrack,
    reorderTracks,
    trackSort,
    retryImport,
    cancelImport,
    dismissImport,
  } = useAppStore();
  const [actionTrack, setActionTrack] = useState<Track | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [virtualViewport, setVirtualViewport] = useState({
    scrollTop: 0,
    height: 0,
    rowStride: ESTIMATED_ROW_HEIGHT,
    rowGap: 0,
  });

  const showJobs = importJobs.length > 0;
  const isDraggable = currentPlaylistId > 1 && trackSort === 'playlist';
  const isVirtualized =
    tracks.length > VIRTUALIZE_AFTER && !isDraggable && !showJobs;

  const handlePlay = useCallback(
    (track: Track) => {
      if (currentTrack?.id === track.id) togglePlay();
      else playTrack(track);
    },
    [currentTrack?.id, playTrack, togglePlay],
  );

  const handleFavorite = useCallback(
    (trackId: number) => toggleFavorite(trackId),
    [toggleFavorite],
  );

  const handleActions = useCallback(
    (track: Track) => setActionTrack(track),
    [],
  );

  const confirmRemoveTrack = useCallback(
    (track: Track) => {
      if (
        window.confirm(
          `Xóa “${track.title}” khỏi thư viện? Hành động này không thể hoàn tác.`,
        )
      ) {
        removeTrack(track.id);
      }
    },
    [removeTrack],
  );

  useEffect(() => {
    if (!isVirtualized) return;
    const list = listRef.current;
    const scroller = list?.parentElement;
    if (!list || !scroller) return;

    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const row = list.querySelector<HTMLElement>('[data-track-row]');
        const listStyles = getComputedStyle(list);
        const parsedGap = Number.parseFloat(listStyles.rowGap);
        const rowGap = Number.isFinite(parsedGap) ? parsedGap : 0;
        const rowHeight = row?.getBoundingClientRect().height;
        const rowStride = rowHeight ? rowHeight + rowGap : ESTIMATED_ROW_HEIGHT;
        const listTop = list.offsetTop;
        const nextViewport = {
          scrollTop: Math.max(0, scroller.scrollTop - listTop),
          height: scroller.clientHeight,
          rowStride,
          rowGap,
        };
        setVirtualViewport((current) =>
          current.scrollTop === nextViewport.scrollTop &&
          current.height === nextViewport.height &&
          current.rowStride === nextViewport.rowStride &&
          current.rowGap === nextViewport.rowGap
            ? current
            : nextViewport,
        );
      });
    };

    measure();
    scroller.addEventListener('scroll', measure, { passive: true });
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(list);
    return () => {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', measure);
      observer.disconnect();
    };
  }, [isVirtualized]);

  const virtualRange = useMemo(() => {
    if (!isVirtualized) return { start: 0, end: tracks.length };
    const start = Math.max(
      0,
      Math.floor(virtualViewport.scrollTop / virtualViewport.rowStride) -
        OVERSCAN_ROWS,
    );
    const visibleRows = Math.ceil(
      virtualViewport.height / virtualViewport.rowStride,
    );
    return {
      start,
      end: Math.min(tracks.length, start + visibleRows + OVERSCAN_ROWS * 2),
    };
  }, [isVirtualized, tracks.length, virtualViewport]);

  const visibleTracks = isVirtualized
    ? tracks.slice(virtualRange.start, virtualRange.end)
    : tracks;
  const topSpacer = Math.max(
    0,
    virtualRange.start * virtualViewport.rowStride - virtualViewport.rowGap,
  );
  const bottomSpacer = Math.max(
    0,
    (tracks.length - virtualRange.end) * virtualViewport.rowStride -
      virtualViewport.rowGap,
  );

  if (tracks.length === 0 && !showJobs) {
    return (
      <div className="flex min-h-[240px] flex-col items-center justify-center gap-1.5 text-center text-muted">
        <span className="mb-1 text-3xl text-muted-2">♪</span>
        <p className="text-sm font-semibold text-ink-secondary">
          Chưa có bài hát
        </p>
        <p className="text-xs text-muted">
          Dán liên kết TikTok hoặc YouTube để bắt đầu
        </p>
      </div>
    );
  }

  if (isDraggable) {
    return (
      <>
        <SortableTrackList
          tracks={tracks}
          currentTrackId={currentTrack?.id}
          isPlaying={isPlaying}
          favorites={favorites}
          onPlay={handlePlay}
          onFavorite={handleFavorite}
          onRemove={confirmRemoveTrack}
          onActions={handleActions}
          onReorder={reorderTracks}
        />
        {actionTrack && (
          <TrackActionsDialog
            track={actionTrack}
            onClose={() => setActionTrack(null)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <ul
        ref={listRef}
        className="flex list-none flex-col gap-0.5"
        data-virtualized={isVirtualized || undefined}
      >
        {importJobs.map((job) => (
          <li
            key={job.id}
            className={`flex items-center gap-2.5 rounded-control border border-transparent border-l-2 bg-transparent px-2.5 py-2 transition-[background] max-[640px]:gap-3 max-[640px]:px-2 max-[640px]:py-3${job.status === 'processing' ? ' opacity-60' : ''}${job.status === 'failed' ? ' border-l-danger bg-danger-muted' : ''}`}
          >
            <div
              className={`flex size-10 shrink-0 items-center justify-center rounded-compact max-[640px]:size-11${job.status === 'processing' ? ' animate-pulse bg-white/10' : ''}${job.status === 'failed' ? ' bg-danger-muted' : ''}${job.status === 'cancelled' ? ' bg-surface-2' : ''}`}
            >
              {job.status === 'processing' && <SpinnerIcon size={18} />}
              {job.status === 'failed' && (
                <span className="text-xs text-danger">!</span>
              )}
              {job.status === 'cancelled' && <CloseIcon size={14} />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="mb-0.5 truncate text-sm font-medium text-ink">
                {job.status === 'processing' && 'Đang tải & xử lý...'}
                {job.status === 'failed' && (job.error || 'Không thể tải')}
                {job.status === 'cancelled' && 'Đã hủy'}
              </p>
              <p className="truncate text-xs text-muted">{job.url}</p>
              {job.error && job.status === 'failed' && (
                <p className="mt-0.5 truncate text-xs text-danger">
                  {job.error}
                </p>
              )}
            </div>
            <div className="flex shrink-0 gap-1">
              {job.status === 'failed' && (
                <button
                  type="button"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted-2 hover:text-accent"
                  onClick={() => retryImport(job.id)}
                  aria-label="Thử lại"
                  title="Thử lại"
                >
                  <RefreshCwIcon size={15} />
                </button>
              )}
              {job.status === 'cancelled' && (
                <button
                  type="button"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted-2 hover:text-danger"
                  onClick={() => dismissImport(job.id)}
                  aria-label="Xóa"
                  title="Xóa"
                >
                  <CloseIcon size={14} />
                </button>
              )}
              {job.status === 'processing' && (
                <button
                  type="button"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-control border-0 bg-transparent p-0 text-muted-2 hover:text-danger"
                  onClick={() => cancelImport(job.id)}
                  aria-label="Hủy"
                  title="Hủy"
                >
                  <CloseIcon size={14} />
                </button>
              )}
            </div>
          </li>
        ))}
        {topSpacer > 0 && (
          <li
            aria-hidden
            className="pointer-events-none shrink-0"
            style={{ height: topSpacer }}
          />
        )}
        {visibleTracks.map((track) => (
          <TrackRow
            key={track.id}
            track={track}
            isActive={currentTrack?.id === track.id}
            isPlaying={currentTrack?.id === track.id && isPlaying}
            isFavorite={favorites.has(track.id)}
            onPlay={handlePlay}
            onFavorite={handleFavorite}
            onRemove={confirmRemoveTrack}
            onActions={handleActions}
          />
        ))}
        {bottomSpacer > 0 && (
          <li
            aria-hidden
            className="pointer-events-none shrink-0"
            style={{ height: bottomSpacer }}
          />
        )}
      </ul>
      {actionTrack && (
        <TrackActionsDialog
          track={actionTrack}
          onClose={() => setActionTrack(null)}
        />
      )}
    </>
  );
}
