'use client';

import { useState } from 'react';
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

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-playlist-title"
      >
        <h2 className="modal__title" id="add-playlist-title">
          Tạo danh sách phát
        </h2>
        <input
          className="modal__input"
          type="text"
          placeholder="Tên danh sách phát..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-label="Tên danh sách phát"
        />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Hủy
          </button>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!name.trim()}
          >
            Tạo mới
          </button>
        </div>
      </form>
    </div>
  );
}
