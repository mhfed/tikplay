'use client';

import { CloseIcon, SearchIcon } from './icons';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

/** Filters the visible playlist / history lists by title or author. */
export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <search className="relative ml-0 flex max-w-[640px] flex-[1_1_360px] items-center max-[640px]:max-w-none max-[640px]:flex-[1_1_100%]">
      <SearchIcon
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-2"
      />
      <input
        type="text"
        className="w-full rounded-full border border-line bg-surface py-[9px] pl-9 pr-9 font-mono text-[13px] text-ink outline-none transition-[border-color,box-shadow] duration-[var(--motion-fast)] ease-out-app placeholder:text-muted-2 focus:border-accent focus:shadow-[0_0_0_3px_var(--accent-muted)] max-[640px]:py-2 max-[640px]:pl-[34px] max-[640px]:pr-8 max-[640px]:text-base"
        placeholder="Tìm theo tên bài hát hoặc nghệ sĩ..."
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label="Tìm kiếm bài hát"
        spellCheck={false}
      />
      {value && (
        <button
          type="button"
          className="absolute right-2 inline-flex cursor-pointer items-center justify-center border-0 bg-transparent p-1 text-muted hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
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
