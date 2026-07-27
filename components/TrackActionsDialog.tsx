'use client';

import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useOffline } from '@/hooks/useOffline';
import { CATEGORIES, DEFAULT_CATEGORY } from '../lib/categories';
import type { Track } from '../lib/types';
import { DialogOverlay } from './DialogOverlay';
import { CheckIcon, PlusIcon, ShareIcon, DownloadIcon, TrashIcon } from './icons';

interface Props {
  track: Track;
  onClose: () => void;
}

export default function TrackActionsDialog({ track, onClose }: Props) {
  const { playlists, addTrackToPlaylist, updateTrackMetadata } = useAppStore();
  const [title, setTitle] = useState(track.title);
  const [author, setAuthor] = useState(track.author);
  const [cover, setCover] = useState(track.cover);
  const [category, setCategory] = useState(track.category || DEFAULT_CATEGORY);
  const [addedPlaylistIds, setAddedPlaylistIds] = useState<Set<number>>(
    new Set(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareCopied, setShareCopied] = useState(false);
  const { downloadedTracks, downloadTrack, removeTrack, isSupported } = useOffline();

  const downloadState = downloadedTracks.get(track.id);

  const saveMetadata = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await updateTrackMetadata(track.id, {
        title: title.trim(),
        author: author.trim(),
        cover: cover.trim(),
        category,
      });
      onClose();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể lưu bài hát',
      );
    } finally {
      setSaving(false);
    }
  };

  const addToPlaylist = async (playlistId: number) => {
    setError(null);
    try {
      await addTrackToPlaylist(track.id, playlistId);
      setAddedPlaylistIds((current) => new Set(current).add(playlistId));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Không thể thêm vào danh sách',
      );
    }
  };

  const shareTrackLink = async () => {
    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_type: 'track', target_id: track.id }),
      });
      const data = await res.json();
      if (!data.ok || !data.url) throw new Error('Failed');

      const isTouch = window.matchMedia('(pointer: coarse)').matches;
      if (isTouch && navigator.share) {
        try {
          await navigator.share({
            title: `${track.title} - ${track.author}`,
            text: `Nghe "${track.title}" của ${track.author} trên TikPlay.`,
            url: data.url,
          });
          return;
        } catch {}
      }
      await navigator.clipboard.writeText(data.url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {}
  };

  const fieldClass =
    'w-full rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] max-[640px]:text-base';

  return (
    <DialogOverlay onClose={onClose}>
      <form
        className="relative z-10 max-h-[calc(100vh-32px)] w-full max-w-[520px] overflow-y-auto rounded-panel border border-line-soft bg-[var(--glass-bg)] p-6 shadow-app backdrop-blur-[20px] max-[640px]:p-5"
        onSubmit={saveMetadata}
        role="dialog"
        aria-modal="true"
        aria-labelledby="track-actions-title"
      >
        <h2
          id="track-actions-title"
          className="font-display text-lg font-extrabold"
        >
          Chỉnh sửa bài hát
        </h2>
        <div className="mt-4 grid gap-3">
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Tên bài hát
            <input
              className={fieldClass}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={200}
              required
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Nghệ sĩ
            <input
              className={fieldClass}
              value={author}
              onChange={(event) => setAuthor(event.target.value)}
              maxLength={120}
              required
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Ảnh bìa
            <input
              className={fieldClass}
              value={cover}
              onChange={(event) => setCover(event.target.value)}
              maxLength={2000}
              placeholder="URL hoặc đường dẫn ảnh"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-semibold text-muted">
            Thể loại
            <select
              className={fieldClass}
              value={category}
              onChange={(event) => setCategory(event.target.value)}
            >
              {CATEGORIES.map((item) => (
                <option key={item.slug} value={item.slug}>
                  {item.name}
                </option>
              ))}
              <option value={DEFAULT_CATEGORY}>Khác</option>
            </select>
          </label>
        </div>

        <div className="mt-5 border-t border-line-soft pt-4">
          <h3 className="mb-2 text-sm font-bold">Thêm vào danh sách phát</h3>
          <div className="grid max-h-36 gap-1 overflow-y-auto">
            {playlists.filter((playlist) => playlist.id !== 1).length === 0 ? (
              <p className="py-2 text-xs text-muted">Chưa có danh sách phát.</p>
            ) : (
              playlists
                .filter((playlist) => playlist.id !== 1)
                .map((playlist) => {
                  const added = addedPlaylistIds.has(playlist.id);
                  return (
                    <button
                      key={playlist.id}
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-3 py-2 text-left text-sm text-ink-secondary hover:bg-surface"
                      onClick={() => addToPlaylist(playlist.id)}
                      disabled={added}
                    >
                      {added ? <CheckIcon size={15} /> : <PlusIcon size={15} />}
                      <span className="min-w-0 flex-1 truncate">
                        {playlist.name}
                      </span>
                      {playlist.trackCount != null && (
                        <span className="font-mono text-[11px] text-muted-2">
                          {playlist.trackCount}
                        </span>
                      )}
                    </button>
                  );
                })
            )}
          </div>
        </div>

        <div className="mt-5 border-t border-line-soft pt-4">
          <h3 className="mb-2 text-sm font-bold">Chia sẻ</h3>
          <button
            type="button"
            className="flex w-full cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink-secondary transition-colors hover:bg-surface"
            onClick={shareTrackLink}
          >
            <ShareIcon size={16} />
            <span>
              {shareCopied ? 'Đã copy link!' : 'Sao chép link chia sẻ'}
            </span>
          </button>
        </div>

        {isSupported && (
          <div className="mt-5 border-t border-line-soft pt-4">
            <h3 className="mb-2 text-sm font-bold">Offline Storage</h3>
            {!downloadState ? (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink-secondary transition-colors hover:bg-surface hover:text-accent"
                onClick={() => {
                  downloadTrack(track).catch(() => {});
                  onClose();
                }}
              >
                <DownloadIcon size={16} />
                <span>Tải bài hát này về máy</span>
              </button>
            ) : (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded-control border-0 bg-transparent px-3 py-2.5 text-left text-sm text-ink-secondary transition-colors hover:bg-surface hover:text-danger"
                onClick={() => {
                  removeTrack(track.id);
                  onClose();
                }}
              >
                <TrashIcon size={16} />
                <span>Xóa bản tải offline</span>
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            className="rounded-control border border-line bg-surface-2 px-4 py-2 text-[13px] font-semibold text-ink"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="rounded-control border-0 bg-accent px-4 py-2 text-[13px] font-bold text-[#00201e] disabled:opacity-40"
            disabled={saving || !title.trim() || !author.trim()}
          >
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </button>
        </div>
      </form>
    </DialogOverlay>
  );
}
