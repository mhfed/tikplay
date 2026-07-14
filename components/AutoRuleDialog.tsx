'use client';

import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';

interface Props {
  onClose: () => void;
}

export default function AutoRuleDialog({ onClose }: Props) {
  const { autoRules, playlists, createAutoRule, deleteAutoRule } =
    useAppStore();
  const [keyword, setKeyword] = useState('');
  const [playlistId, setPlaylistId] = useState<number>(0);
  const [matchMode, setMatchMode] = useState('contains');

  const userPlaylists = playlists.filter((p) => p.id !== 1);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyword.trim() || !playlistId) return;
    await createAutoRule(playlistId, keyword.trim(), matchMode);
    setKeyword('');
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ minWidth: 440 }}
      >
        <h2 className="modal__title">Auto Rules</h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Tracks matching keywords will be auto-added to playlists.
        </p>

        {autoRules.length > 0 && (
          <ul className="modal__rule-list">
            {autoRules.map((rule) => {
              const pl = playlists.find((p) => p.id === rule.playlist_id);
              return (
                <li key={rule.id} className="modal__rule-item">
                  <span className="modal__rule-keyword">
                    &quot;{rule.keyword}&quot;
                  </span>
                  <span className="modal__rule-arrow">&rarr;</span>
                  <span className="modal__rule-playlist">
                    {pl?.name || '?'}
                  </span>
                  <button
                    className="modal__rule-delete"
                    onClick={() => deleteAutoRule(rule.id)}
                    title="Delete rule"
                  >
                    &times;
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <form
          onSubmit={handleAdd}
          style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}
        >
          <input
            className="modal__input"
            type="text"
            placeholder="Keyword (e.g. chill, remix)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ flex: '1 1 140px', marginBottom: 0 }}
          />
          <select
            className="modal__input"
            value={playlistId}
            onChange={(e) => setPlaylistId(Number(e.target.value))}
            style={{ flex: '1 1 140px', marginBottom: 0 }}
          >
            <option value={0} disabled>
              Select playlist...
            </option>
            {userPlaylists.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            className="modal__input"
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value)}
            style={{ flex: '0 0 120px', marginBottom: 0 }}
          >
            <option value="contains">Contains</option>
            <option value="starts_with">Starts with</option>
          </select>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!keyword.trim() || !playlistId}
            style={{ flex: '0 0 auto' }}
          >
            Add Rule
          </button>
        </form>

        <div className="modal__actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
