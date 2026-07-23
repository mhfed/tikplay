'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAppStore } from '../hooks/useAppStore';

interface Props {
  onClose: () => void;
}

export default function AddPlaylistDialog({ onClose }: Props) {
  const { createPlaylist } = useAppStore();
  const [name, setName] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    await createPlaylist(trimmed);
    onClose();
  };

  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] grid place-items-center">
      <button
        type="button"
        className="absolute inset-0 cursor-default border-0 bg-black/60 [animation:modal-backdrop-in_var(--motion-base)_var(--ease-out)]"
        onClick={onClose}
        aria-label="Đóng hộp thoại"
      />
      <form
        className="relative z-10 min-w-[360px] max-w-[480px] rounded-panel border border-line-soft bg-[var(--glass-bg)] p-6 shadow-app backdrop-blur-[20px] [animation:modal-panel-in_var(--motion-base)_var(--ease-spring)] max-[640px]:mx-4 max-[640px]:min-w-0 max-[640px]:max-w-[calc(100vw-32px)]"
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-playlist-title"
      >
        <h2
          className="mb-4 font-display text-lg font-extrabold"
          id="add-playlist-title"
        >
          Tạo danh sách phát
        </h2>
        <input
          className="mb-4 w-full rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-out-app placeholder:text-muted-2 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] max-[640px]:text-base"
          type="text"
          placeholder="Tên danh sách phát..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Tên danh sách phát"
        />
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface-2 px-4 py-[9px] text-[13px] font-semibold text-ink transition-[background,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:border-accent hover:bg-surface-3 active:scale-[0.97]"
            onClick={onClose}
          >
            Hủy
          </button>
          <button
            type="submit"
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control border border-transparent bg-linear-to-br from-accent to-tertiary px-4 py-[9px] text-[13px] font-bold text-[#00201e] shadow-[0_0_20px_var(--accent-glow)] transition-[filter,transform] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-[0.35]"
            disabled={!name.trim()}
          >
            Tạo mới
          </button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
