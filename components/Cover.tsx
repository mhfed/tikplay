'use client';

import type { CSSProperties } from 'react';
import { useMemo, useState } from 'react';

interface CoverProps {
  src?: string;
  /** Display name used for the accessible label and deterministic art seed. */
  alt?: string;
  /** Optional author/secondary text included in the accessible title. */
  subtitle?: string;
  className?: string;
  /** When true, attempt the real image and fall back to the placeholder on error. */
  useImage?: boolean;
}

/** FNV-1a hash so the same name always maps to the same color. */
function hash(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

const COVER_PALETTES = [
  {
    base: '#101615',
    depth: '#21403b',
    accent: '#c9f36b',
    ink: '#62d6cb',
    paper: '#f2eee4',
  },
  {
    base: '#17131d',
    depth: '#382744',
    accent: '#ff8a70',
    ink: '#a8d9d1',
    paper: '#f6ead9',
  },
  {
    base: '#161817',
    depth: '#34312a',
    accent: '#efc65a',
    ink: '#dd655d',
    paper: '#f0eee8',
  },
  {
    base: '#10151e',
    depth: '#20354c',
    accent: '#f0a36f',
    ink: '#83c8e6',
    paper: '#f3efe7',
  },
  {
    base: '#171313',
    depth: '#42292c',
    accent: '#77d9b0',
    ink: '#e36d75',
    paper: '#f6e9db',
  },
] as const;

type CoverArtStyle = CSSProperties & {
  '--cover-base': string;
  '--cover-depth': string;
  '--cover-accent': string;
  '--cover-ink': string;
  '--cover-paper': string;
  '--cover-angle': string;
  '--cover-x': string;
  '--cover-y': string;
};

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const letters = words
    .slice(0, 2)
    .map((word) => word.match(/[\p{L}\p{N}]/u)?.[0] ?? '')
    .join('');

  return (letters || 'TP').toLocaleUpperCase('vi-VN');
}

/** Curated sleeve palettes plus seeded geometry keep fallbacks intentional. */
function artwork(name: string) {
  const seed = hash(name || 'TikPlay');
  const selected = COVER_PALETTES[seed % COVER_PALETTES.length];
  const style: CoverArtStyle = {
    '--cover-base': selected.base,
    '--cover-depth': selected.depth,
    '--cover-accent': selected.accent,
    '--cover-ink': selected.ink,
    '--cover-paper': selected.paper,
    '--cover-angle': `${18 + ((seed >>> 5) % 38)}deg`,
    '--cover-x': `${18 + ((seed >>> 11) % 56)}%`,
    '--cover-y': `${14 + ((seed >>> 17) % 52)}%`,
  };

  return {
    style,
    monogram: initials(name),
    catalog: `TP-${(seed % 4096).toString(16).toUpperCase().padStart(3, '0')}`,
  };
}

/**
 * Thumbnail. Real covers are downloaded at crawl time (with the TikTok
 * Referer header TikTok's CDN requires) and re-served from our own
 * /api/cover/[key] cache, so — unlike hotlinking TikTok's signed URLs
 * directly — they don't expire or resolve to solid black. Falls back to a
 * generated, name-seeded record sleeve when there's no cover (legacy tracks
 * crawled before caching existed, or any fetch failure).
 */
export default function Cover({
  src,
  alt = '',
  subtitle,
  className = '',
  useImage = true,
}: CoverProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const label = alt.trim() || 'Không rõ tiêu đề';
  const art = useMemo(() => artwork(label), [label]);
  const imageSrc = useImage && src && failedSrc !== src ? src : null;
  const bustedSrc = imageSrc?.startsWith('/api/')
    ? `${imageSrc}${imageSrc.includes('?') ? '&' : '?'}v=2`
    : imageSrc;

  return (
    <div
      className={`cover cover--thumb ${className}`}
      style={art.style}
      role="img"
      aria-label={label}
      title={subtitle ? `${label} - ${subtitle}` : label}
    >
      {bustedSrc ? (
        // The sleeve stays underneath until the image has decoded successfully,
        // so a 404 can never expose browser broken-image chrome.
        // biome-ignore lint/performance/noImgElement: intentional native img
        <img
          className={`cover__image${loadedSrc === imageSrc ? ' is-loaded' : ''}`}
          src={bustedSrc}
          alt=""
          aria-hidden
          referrerPolicy="no-referrer"
          loading="lazy"
          onLoad={() => setLoadedSrc(imageSrc)}
          onError={() => setFailedSrc(imageSrc)}
        />
      ) : null}
      <span className="cover__geometry" aria-hidden />
      <span className="cover__edition" aria-hidden>
        {art.catalog}
      </span>
      <span className="cover__monogram" aria-hidden>
        {art.monogram}
      </span>
    </div>
  );
}
