'use client';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** Filters the visible playlist / history lists by title or author. */
export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div className="search-bar">
      <input
        type="text"
        className="search-bar__field"
        placeholder="Search by title or author…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Search tracks"
        spellCheck={false}
      />
      {value && (
        <button
          type="button"
          className="search-bar__clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          ×
        </button>
      )}
    </div>
  );
}
