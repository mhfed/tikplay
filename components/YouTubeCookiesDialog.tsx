'use client';

import { useEffect, useRef, useState } from 'react';
import { DialogOverlay } from './DialogOverlay';
import { CheckIcon, CloseIcon, RefreshCwIcon, SpinnerIcon } from './icons';

interface Props {
  onClose: () => void;
}

type CookieStatus = {
  configured: boolean;
  source: 'db' | 'env' | null;
  updatedAt: number | null;
  fileName: string | null;
};

export default function YouTubeCookiesDialog({ onClose }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [status, setStatus] = useState<CookieStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/youtube-cookies');
        const data = (await res.json()) as CookieStatus & { ok?: boolean };
        if (!cancelled && data) setStatus(data);
      } catch {
        if (!cancelled) setStatus(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handlePick = () => {
    inputRef.current?.click();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setLoading(true);
    setMessage(null);
    try {
      const cookiesText = (await file.text()).trim();
      const res = await fetch('/api/admin/youtube-cookies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cookiesText, fileName: file.name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Không thể lưu cookies');
      }
      setStatus(data);
      setMessage('Cookies YouTube đã được làm mới.');
    } catch (error) {
      setMessage((error as Error).message || 'Không thể lưu cookies');
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <DialogOverlay onClose={onClose}>
      <div
        className="relative z-10 min-w-[440px] max-w-[520px] rounded-panel border border-line-soft bg-[var(--glass-bg)] p-6 shadow-app backdrop-blur-[20px] [animation:modal-panel-in_var(--motion-base)_var(--ease-spring)] max-[640px]:mx-4 max-[640px]:min-w-0 max-[640px]:max-w-[calc(100vw-32px)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="youtube-cookies-title"
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="grid size-8 place-items-center rounded-compact bg-accent-muted text-accent">
            <RefreshCwIcon size={16} />
          </div>
          <h2
            className="font-display text-lg font-extrabold"
            id="youtube-cookies-title"
          >
            Refresh YouTube cookies
          </h2>
        </div>

        <div className="mb-4 rounded-compact border border-line bg-canvas px-3 py-2.5 text-[13px] text-muted">
          {status?.configured ? (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 font-semibold text-ink-secondary">
                <CheckIcon size={14} />
                {status.source === 'db'
                  ? 'Saved in app volume'
                  : 'Using Fly env'}
              </span>
              <span>
                {status.fileName ? `File: ${status.fileName}` : 'No file name'}
              </span>
              <span>
                {status.updatedAt
                  ? `Updated ${new Date(status.updatedAt).toLocaleString()}`
                  : 'Not refreshed from app'}
              </span>
            </div>
          ) : (
            'No YouTube cookies saved yet.'
          )}
        </div>

        <p className="mb-4 text-[13px] text-muted">
          Upload the exported `youtube.com` cookie file from a logged-in
          session.
        </p>

        {message && (
          <div className="mb-4 rounded-compact border border-line bg-canvas px-3 py-2 text-[13px] text-ink-secondary">
            {message}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept=".txt,.cookies,text/plain"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control border border-line bg-surface-2 px-4 py-[9px] text-[13px] font-semibold text-ink transition-[background,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:border-accent hover:bg-surface-3 active:scale-[0.97]"
            onClick={onClose}
          >
            <CloseIcon size={14} />
            Đóng
          </button>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center justify-center gap-1.5 rounded-control border border-transparent bg-linear-to-br from-accent to-tertiary px-4 py-[9px] text-[13px] font-bold text-[#00201e] shadow-[0_0_20px_var(--accent-glow)] transition-[filter,transform] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-[0.35]"
            onClick={handlePick}
            disabled={loading}
          >
            {loading ? (
              <SpinnerIcon size={14} className="animate-spin" />
            ) : null}
            Refresh YouTube cookies
          </button>
        </div>
      </div>
    </DialogOverlay>
  );
}
