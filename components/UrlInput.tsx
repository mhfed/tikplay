'use client';

import { useState } from 'react';
import { PlusIcon } from './icons';

interface UrlInputProps {
  onAdd: (url: string) => void;
  loading: boolean;
  error: string | null;
  compact?: boolean;
}

export default function UrlInput({
  onAdd,
  loading,
  error,
  compact = false,
}: UrlInputProps) {
  const [value, setValue] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = value.trim();
    if (!url || loading) return;
    onAdd(url);
    setValue('');
  };

  return (
    <form
      className={
        compact
          ? 'relative ml-auto flex min-w-[260px] max-w-[620px] flex-[1_1_360px] flex-nowrap gap-2 max-[1024px]:flex-[1_1_320px] max-[640px]:order-3 max-[640px]:m-0 max-[640px]:min-w-0 max-[640px]:max-w-none max-[640px]:flex-[1_1_100%] max-[640px]:flex-wrap'
          : 'mb-4 flex flex-wrap gap-2.5 rounded-panel border border-line-soft bg-surface p-3.5'
      }
      onSubmit={submit}
      aria-label="Thêm bài hát từ link nhạc"
    >
      <input
        type="text"
        className={`min-w-0 flex-1 rounded-full border border-line-soft bg-canvas px-4 py-3 font-mono text-[13px] text-ink outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-out-app placeholder:text-muted-2 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] disabled:opacity-60 max-[640px]:text-base${compact ? ' bg-surface px-3.5 py-[9px] max-[640px]:py-2.5' : ' max-[640px]:px-4 max-[640px]:py-[11px]'}`}
        placeholder="Dán link TikTok, YouTube, Instagram, Facebook, SoundCloud..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
        aria-label="Liên kết bài hát/video"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'tiktok-url-error' : undefined}
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
      />
      <button
        type="submit"
        className="inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-control border border-transparent bg-linear-to-br from-accent to-tertiary px-4 py-[9px] text-[13px] font-bold text-[#00201e] shadow-[0_0_20px_var(--accent-glow)] transition-[filter,transform] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-[0.35] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        disabled={loading || !value.trim()}
      >
        {loading ? (
          'Đang tải...'
        ) : (
          <>
            <PlusIcon size={14} /> Thêm
          </>
        )}
      </button>
      {error && (
        <p
          id="tiktok-url-error"
          className={`basis-full pl-4 text-xs text-danger${compact ? ' absolute inset-x-0 top-[calc(100%+7px)] z-[5] m-0 rounded-control border border-[color-mix(in_srgb,var(--danger)_38%,transparent)] bg-[color-mix(in_srgb,var(--bg)_94%,var(--danger))] px-3 py-[9px] shadow-app max-[640px]:static max-[640px]:mt-0 max-[640px]:shadow-none' : ' mt-1.5'}`}
          role="alert"
        >
          {error}
        </p>
      )}
    </form>
  );
}
