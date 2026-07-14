'use client';

import { useMemo, useState } from 'react';

interface CoverProps {
  src?: string;
  /** Display name — used for the placeholder text and as the color seed. */
  alt?: string;
  /** Subtitle shown under the title (usually the author). */
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

/** Build a layered, name-seeded gradient: base sweep + light/shadow accents. */
function palette(name: string) {
  const h = hash(name || '♪');
  const hue = h % 360;
  const hue2 = (hue + 38) % 360;
  const hue3 = (hue + 310) % 360;
  return {
    bg: [
      `radial-gradient(circle at 26% 20%, hsl(${hue} 88% 68% / 0.55), transparent 52%)`,
      `radial-gradient(circle at 80% 84%, hsl(${hue3} 70% 24% / 0.85), transparent 62%)`,
      `linear-gradient(135deg, hsl(${hue} 68% 50%), hsl(${hue2} 72% 36%))`,
    ].join(', '),
    ring: `hsl(${hue} 80% 62%)`,
  };
}

/**
 * Thumbnail. Real covers are downloaded at crawl time (with the TikTok
 * Referer header TikTok's CDN requires) and re-served from our own
 * /api/cover/[key] cache, so — unlike hotlinking TikTok's signed URLs
 * directly — they don't expire or resolve to solid black. Falls back to a
 * generated, name-seeded gradient placeholder when there's no cover (legacy
 * tracks crawled before caching existed, or any fetch failure).
 */
export default function Cover({
  src,
  alt = '',
  subtitle,
  className = '',
  useImage = true,
}: CoverProps) {
  const [failed, setFailed] = useState(false);
  const { bg, ring } = useMemo(() => palette(alt), [alt]);

  if (useImage && src && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        className={`cover ${className}`}
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        loading="lazy"
        onError={() => setFailed(true)}
      />
    );
  }

  const label = alt.trim() || 'Không rõ tiêu đề';
  return (
    <div
      className={`cover cover--thumb ${className}`}
      style={{ backgroundImage: bg, boxShadow: `inset 0 0 0 1px ${ring}66` }}
      role="img"
      aria-label={label}
      title={subtitle ? `${label} — ${subtitle}` : label}
    >
      <span className="cover__title">{label}</span>
      {subtitle ? <span className="cover__sub">{subtitle}</span> : null}
    </div>
  );
}
