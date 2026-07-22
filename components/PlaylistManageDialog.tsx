'use client';

import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import type { Playlist } from '../lib/types';
import { ChevronUpIcon } from './icons';

interface Props {
  playlist: Playlist;
  onClose: () => void;
}

export default function PlaylistManageDialog({ playlist, onClose }: Props) {
  const {
    playlists,
    renamePlaylist,
    deletePlaylist,
    reorderPlaylists,
    selectPlaylist,
  } = useAppStore();
  const [name, setName] = useState(playlist.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const customPlaylists = playlists.filter((item) => item.id !== 1);
  const index = customPlaylists.findIndex((item) => item.id === playlist.id);

  const run = async (action: () => Promise<void>) => {
    setSaving(true);
    setError(null);
    try {
      await action();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Không thể cập nhật');
    } finally {
      setSaving(false);
    }
  };

  const saveName = (event: React.FormEvent) => {
    event.preventDefault();
    run(async () => {
      await renamePlaylist(playlist.id, name.trim());
      onClose();
    });
  };

  const move = (offset: -1 | 1) => {
    const target = index + offset;
    if (target < 0 || target >= customPlaylists.length) return;
    const reordered = [...customPlaylists];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    run(() => reorderPlaylists([1, ...reordered.map((item) => item.id)]));
  };

  const remove = () => {
    run(async () => {
      await deletePlaylist(playlist.id);
      selectPlaylist(1);
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center px-4">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/60"
        onClick={onClose}
        aria-label="Đóng hộp thoại"
      />
      <form
        className="relative z-10 w-full max-w-[440px] rounded-panel border border-line-soft bg-[var(--glass-bg)] p-6 shadow-app backdrop-blur-[20px]"
        onSubmit={saveName}
        role="dialog"
        aria-modal="true"
        aria-labelledby="manage-playlist-title"
      >
        <h2
          id="manage-playlist-title"
          className="font-display text-lg font-extrabold"
        >
          Quản lý danh sách
        </h2>
        <label className="mt-4 grid gap-1.5 text-xs font-semibold text-muted">
          Tên danh sách
          <input
            className="w-full rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none focus:border-accent max-[640px]:text-base"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <div className="mt-4 flex items-center gap-2 border-t border-line-soft pt-4">
          <span className="mr-auto text-xs font-semibold text-muted">
            Thứ tự hiển thị
          </span>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-control border border-line bg-surface-2 text-muted disabled:opacity-30"
            onClick={() => move(-1)}
            disabled={saving || index <= 0}
            aria-label="Đưa danh sách lên"
            title="Đưa lên"
          >
            <ChevronUpIcon size={16} />
          </button>
          <button
            type="button"
            className="grid size-9 rotate-180 place-items-center rounded-control border border-line bg-surface-2 text-muted disabled:opacity-30"
            onClick={() => move(1)}
            disabled={saving || index === customPlaylists.length - 1}
            aria-label="Đưa danh sách xuống"
            title="Đưa xuống"
          >
            <ChevronUpIcon size={16} />
          </button>
        </div>
        {error && <p className="mt-3 text-xs text-danger">{error}</p>}
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {confirmDelete ? (
            <button
              type="button"
              className="mr-auto rounded-control border border-danger bg-transparent px-3 py-2 text-[13px] font-semibold text-danger"
              onClick={remove}
              disabled={saving}
            >
              Xác nhận xóa
            </button>
          ) : (
            <button
              type="button"
              className="mr-auto rounded-control border border-line bg-transparent px-3 py-2 text-[13px] font-semibold text-danger"
              onClick={() => setConfirmDelete(true)}
            >
              Xóa danh sách
            </button>
          )}
          <button
            type="button"
            className="rounded-control border border-line bg-surface-2 px-4 py-2 text-[13px] font-semibold"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="rounded-control border-0 bg-accent px-4 py-2 text-[13px] font-bold text-[#00201e] disabled:opacity-40"
            disabled={saving || !name.trim()}
          >
            Lưu
          </button>
        </div>
      </form>
    </div>
  );
}
