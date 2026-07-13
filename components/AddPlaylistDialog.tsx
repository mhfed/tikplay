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
      >
        <h2 className="modal__title">New Playlist</h2>
        <input
          className="modal__input"
          type="text"
          placeholder="Playlist name..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
        />
        <div className="modal__actions">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn btn--primary" disabled={!name.trim()}>
            Create
          </button>
        </div>
      </form>
    </div>
  );
}
