'use client';

import { useState } from 'react';
import { DialogOverlay } from './DialogOverlay';
import { CloseIcon, SearchIcon } from './icons';
import ProfileScannerDialog from './ProfileScannerDialog';

interface ProfileInputProps {
  onClose: () => void;
}

export default function ProfileInputDialog({ onClose }: ProfileInputProps) {
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [scannedUrl, setScannedUrl] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = value.trim();
    if (!url) return;

    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      if (
        ['tiktok.com', 'www.tiktok.com', 'vt.tiktok.com'].includes(host) ||
        host.endsWith('.tiktok.com')
      ) {
        const pathname = parsed.pathname.replace(/\/+$/, '');
        if (/^\/@[\w.-]+$/.test(pathname)) {
          setError('');
          setScannedUrl(url);
          return;
        }
      }
      setError(
        'Vui lòng nhập đúng link profile TikTok (vd: https://www.tiktok.com/@lyric_music)',
      );
    } catch {
      setError('Đường dẫn không hợp lệ');
    }
  };

  // If we already parsed a valid URL, hand off entirely to ProfileScannerDialog
  // We don't render our own overlay anymore, we just let it take over
  if (scannedUrl) {
    return <ProfileScannerDialog url={scannedUrl} onClose={onClose} />;
  }

  return (
    <DialogOverlay onClose={onClose} closeOnBackdropClick={false}>
      <form
        className="relative z-10 flex w-[480px] max-w-[95vw] flex-col overflow-hidden rounded-[24px] bg-surface-2 shadow-2xl"
        onSubmit={handleSubmit}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line p-5">
          <div>
            <h2 className="font-display text-lg font-bold">
              Tải nhạc từ Profile
            </h2>
            <p className="text-[13px] text-muted">
              Nhập link TikTok profile để xem và tải nhạc
            </p>
          </div>
          <button
            type="button"
            className="grid size-10 cursor-pointer place-items-center rounded-full bg-surface transition-colors hover:bg-line-soft max-[640px]:size-8"
            onClick={onClose}
          >
            <CloseIcon size={18} />
          </button>
        </div>
        <div className="p-5">
          <div className="relative">
            <input
              type="url"
              className="w-full rounded-full border border-line-soft bg-canvas px-5 py-3.5 pl-[48px] font-mono text-sm text-ink outline-none transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] placeholder:text-muted-2 placeholder:font-sans"
              placeholder="VD: https://www.tiktok.com/@lyric_music"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                if (error) setError('');
              }}
            />
            <SearchIcon
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted"
            />
          </div>

          {error && (
            <p className="mt-3 text-[13px] text-danger pl-2">{error}</p>
          )}
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-line bg-surface p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-5 py-2.5 text-sm font-bold transition-colors hover:bg-surface-2"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={!value.trim()}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-[#00201e] shadow-[0_0_15px_var(--accent-glow)] transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none"
          >
            Quét Profile
          </button>
        </div>
      </form>
    </DialogOverlay>
  );
}
