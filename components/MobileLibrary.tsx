'use client';

import { useEffect, useRef, useState } from 'react';
import type { RepeatMode, Track } from '../lib/types';
import History from './History';
import { ClockIcon, GripIcon, ListMusicIcon } from './icons';
import Playlist from './Playlist';

interface MobileLibraryProps {
  playlist: Track[];
  history: Track[];
  currentTrackUrl: string | null;
  isPlaying: boolean;
  shuffle: boolean;
  repeat: RepeatMode;
  onPlay: (track: Track) => void;
  onRemove: (track: Track) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
}

const TABS = ['playlist', 'history'] as const;
type TabIndex = 0 | 1;

/**
 * Mobile-only library: a fixed bottom tab bar that opens a slide-up sheet.
 * Inside, Playlist and History are two panes you switch between by swiping
 * horizontally (scroll-snap) or tapping the tab headers.
 */
export default function MobileLibrary({
  playlist,
  history,
  currentTrackUrl,
  isPlaying,
  shuffle,
  repeat,
  onPlay,
  onRemove,
  onToggleShuffle,
  onCycleRepeat,
}: MobileLibraryProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabIndex>(0);
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const startY = useRef<number | null>(null);

  // Close on Escape while the sheet is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const openTab = (i: TabIndex) => {
    setTab(i);
    setOpen(true);
  };

  const selectTab = (i: TabIndex) => {
    setTab(i);
    const vp = viewportRef.current;
    if (vp) vp.scrollTo({ left: i * vp.clientWidth, behavior: 'smooth' });
  };

  const handleScroll = () => {
    const vp = viewportRef.current;
    if (!vp) return;
    const i = Math.round(vp.scrollLeft / vp.clientWidth) as TabIndex;
    if (i !== tab) setTab(i);
  };

  // Drag the handle downward to dismiss the sheet.
  const onHandleDown = (e: React.PointerEvent) => {
    startY.current = e.clientY;
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (startY.current === null) return;
    setDragY(Math.max(0, e.clientY - startY.current));
  };
  const onHandleUp = () => {
    if (dragY > 90) setOpen(false);
    setDragY(0);
    setDragging(false);
    startY.current = null;
  };

  const sheetTransform = open ? `translateY(${dragY}px)` : 'translateY(100%)';

  return (
    <>
      {/* Fixed bottom tab bar */}
      <nav className="lib-bar" aria-label="Thư viện">
        <button
          type="button"
          className="lib-bar__tab"
          onClick={() => openTab(0)}
          aria-label={`Mở Playlist, ${playlist.length} bài`}
        >
          <ListMusicIcon size={18} className="lib-bar__icon" />
          <span>Playlist</span>
          <span className="lib-bar__count">{playlist.length}</span>
        </button>
        <button
          type="button"
          className="lib-bar__tab"
          onClick={() => openTab(1)}
          aria-label={`Mở History, ${history.length} bài`}
        >
          <ClockIcon size={18} className="lib-bar__icon" />
          <span>History</span>
          <span className="lib-bar__count">{history.length}</span>
        </button>
      </nav>

      {/* Dimmed backdrop */}
      <div
        className={`lib-backdrop${open ? ' is-open' : ''}`}
        onClick={() => setOpen(false)}
        aria-hidden
      />

      {/* Slide-up sheet */}
      <div
        className={`lib-sheet${open ? ' is-open' : ''}${dragging ? ' is-dragging' : ''}`}
        style={{ transform: sheetTransform }}
        role="dialog"
        aria-modal="true"
        aria-label="Thư viện"
      >
        <button
          type="button"
          className="lib-sheet__handle"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
          aria-label="Kéo xuống để đóng"
        >
          <GripIcon size={22} />
        </button>

        <div className="lib-sheet__tabs" role="tablist">
          {TABS.map((_t, i) => (
            <button
              key={_t}
              type="button"
              role="tab"
              aria-selected={tab === i}
              className={`lib-sheet__tab${tab === i ? ' is-active' : ''}`}
              onClick={() => selectTab(i as TabIndex)}
            >
              {i === 0 ? 'Playlist' : 'History'}
            </button>
          ))}
        </div>

        <div
          className="lib-sheet__viewport"
          ref={viewportRef}
          onScroll={handleScroll}
        >
          <div className="lib-sheet__pane">
            <Playlist
              tracks={playlist}
              currentTrackUrl={currentTrackUrl}
              isPlaying={isPlaying}
              shuffle={shuffle}
              repeat={repeat}
              onPlay={onPlay}
              onRemove={onRemove}
              onToggleShuffle={onToggleShuffle}
              onCycleRepeat={onCycleRepeat}
            />
          </div>
          <div className="lib-sheet__pane">
            <History
              tracks={history}
              currentTrackUrl={currentTrackUrl}
              onPlay={onPlay}
            />
          </div>
        </div>
      </div>
    </>
  );
}
