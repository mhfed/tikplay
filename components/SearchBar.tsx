'use client';

import { CloseIcon, SearchIcon } from './icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** Filters the visible playlist / history lists by title or author. */
export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <search className="search-bar">
      <SearchIcon size={16} className="search-bar__icon" />
      <input
        type="text"
        className="search-bar__field"
        placeholder="Tìm theo tên bài hát hoặc nghệ sĩ..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Tìm kiếm bài hát"
        spellCheck={false}
      />
      {value && (
        <button
          type="button"
          className="search-bar__clear"
          onClick={() => onChange('')}
          aria-label="Xóa nội dung tìm kiếm"
          title="Xóa tìm kiếm"
        >
          <CloseIcon size={16} />
        </button>
      )}
    </search>
  );
}
