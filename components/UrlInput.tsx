'use client';

import { useState } from 'react';
import { PlusIcon } from './icons';

interface UrlInputProps {
  onAdd: (url: string) => void;
  loading: boolean;
  error: string | null;
}

/** Controlled TikTok URL input. Calls `onAdd` with a trimmed URL on submit. */
export default function UrlInput({ onAdd, loading, error }: UrlInputProps) {
  const [value, setValue] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const url = value.trim();
    if (!url || loading) return;
    onAdd(url);
    setValue('');
  };

  return (
    <form className="url-input" onSubmit={submit}>
      <input
        type="text"
        className="url-input__field"
        placeholder="Paste a TikTok video URL…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        disabled={loading}
        aria-label="TikTok URL"
        spellCheck={false}
      />
      <button type="submit" className="btn btn--primary" disabled={loading || !value.trim()}>
        {loading ? 'Loading…' : (<><PlusIcon size={16} /> Add</>)}
      </button>
      {error && <p className="url-input__error">{error}</p>}
    </form>
  );
}
