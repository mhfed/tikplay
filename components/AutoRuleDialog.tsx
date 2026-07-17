'use client';

import { useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { CloseIcon } from './icons';

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
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-rule-title"
      >
        <h2 className="modal__title" id="auto-rule-title">
          Quy tắc tự động
        </h2>
        <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
          Bài hát khớp từ khóa sẽ tự động được thêm vào danh sách phát.
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
                    type="button"
                    className="modal__rule-delete"
                    onClick={() => deleteAutoRule(rule.id)}
                    aria-label={`Xóa quy tắc ${rule.keyword}`}
                    title="Xóa quy tắc"
                  >
                    <CloseIcon size={14} />
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
            placeholder="Từ khóa (ví dụ: chill, remix)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ flex: '1 1 140px', marginBottom: 0 }}
            aria-label="Từ khóa"
          />
          <select
            className="modal__input"
            value={playlistId}
            onChange={(e) => setPlaylistId(Number(e.target.value))}
            style={{ flex: '1 1 140px', marginBottom: 0 }}
            aria-label="Danh sách phát đích"
          >
            <option value={0} disabled>
              Chọn danh sách phát...
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
            aria-label="Kiểu khớp từ khóa"
          >
            <option value="contains">Có chứa</option>
            <option value="starts_with">Bắt đầu bằng</option>
          </select>
          <button
            type="submit"
            className="btn btn--primary"
            disabled={!keyword.trim() || !playlistId}
            style={{ flex: '0 0 auto' }}
          >
            Thêm quy tắc
          </button>
        </form>

        <div className="modal__actions" style={{ marginTop: 16 }}>
          <button type="button" className="btn" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
