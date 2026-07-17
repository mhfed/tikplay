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
      className={`url-input${compact ? ' url-input--compact' : ''}`}
      onSubmit={submit}
      aria-label="Thêm bài hát từ TikTok"
    >
      <input
        type="text"
        className="url-input__field"
        placeholder="Dán liên kết video TikTok..."
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
        aria-label="Liên kết video TikTok"
        aria-invalid={Boolean(error)}
        aria-describedby={error ? 'tiktok-url-error' : undefined}
        inputMode="url"
        autoComplete="url"
        autoCapitalize="none"
        spellCheck={false}
      />
      <button
        type="submit"
        className="btn btn--primary"
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
        <p id="tiktok-url-error" className="url-input__error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
