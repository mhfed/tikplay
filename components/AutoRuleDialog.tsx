'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
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
      <div
        className="relative z-10 min-w-[440px] max-w-[480px] rounded-panel border border-line-soft bg-[var(--glass-bg)] p-6 shadow-app backdrop-blur-[20px] [animation:modal-panel-in_var(--motion-base)_var(--ease-spring)] max-[640px]:mx-4 max-[640px]:min-w-0 max-[640px]:max-w-[calc(100vw-32px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auto-rule-title"
      >
        <h2
          className="mb-4 font-display text-lg font-extrabold"
          id="auto-rule-title"
        >
          Quy tắc tự động
        </h2>
        <p className="mb-4 text-[13px] text-muted">
          Bài hát khớp từ khóa sẽ tự động được thêm vào danh sách phát.
        </p>

        {autoRules.length > 0 && (
          <ul className="mb-4 flex max-h-60 list-none flex-col gap-1.5 overflow-y-auto">
            {autoRules.map((rule) => {
              const pl = playlists.find((p) => p.id === rule.playlist_id);
              return (
                <li
                  key={rule.id}
                  className="flex items-center gap-2.5 rounded-compact bg-canvas px-2.5 py-2 text-[13px]"
                >
                  <span className="font-semibold text-tertiary-light">
                    &quot;{rule.keyword}&quot;
                  </span>
                  <span className="text-muted-2">&rarr;</span>
                  <span className="flex-1 text-ink-secondary">
                    {pl?.name || '?'}
                  </span>
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0.5 text-base text-muted-2 hover:text-danger"
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

        <form onSubmit={handleAdd} className="flex flex-wrap gap-2">
          <input
            className="min-w-0 flex-[1_1_140px] rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-out-app placeholder:text-muted-2 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] max-[640px]:text-base"
            type="text"
            placeholder="Từ khóa (ví dụ: chill, remix)"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            aria-label="Từ khóa"
          />
          <select
            className="min-w-0 flex-[1_1_140px] rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-out-app focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] max-[640px]:text-base"
            value={playlistId}
            onChange={(e) => setPlaylistId(Number(e.target.value))}
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
            className="min-w-0 flex-[0_0_120px] rounded-control border border-line bg-canvas px-3.5 py-2.5 text-sm text-ink outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-out-app focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] max-[640px]:text-base"
            value={matchMode}
            onChange={(e) => setMatchMode(e.target.value)}
            aria-label="Kiểu khớp từ khóa"
          >
            <option value="contains">Có chứa</option>
            <option value="starts_with">Bắt đầu bằng</option>
          </select>
          <button
            type="submit"
            className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-control border border-transparent bg-linear-to-br from-accent to-tertiary px-4 py-[9px] text-[13px] font-bold text-[#00201e] shadow-[0_0_20px_var(--accent-glow)] transition-[filter,transform] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-[0.35]"
            disabled={!keyword.trim() || !playlistId}
          >
            Thêm quy tắc
          </button>
        </form>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface-2 px-4 py-[9px] text-[13px] font-semibold text-ink transition-[background,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:border-accent hover:bg-surface-3 active:scale-[0.97]"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
