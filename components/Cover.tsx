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

/** Build a pleasant two-stop gradient from a name. */
function palette(name: string) {
  const h = hash(name || '♪');
  const hue = h % 360;
  const hue2 = (hue + 38) % 360;
  return {
    bg: `linear-gradient(135deg, hsl(${hue} 68% 52%), hsl(${hue2} 72% 40%))`,
    ring: `hsl(${hue} 80% 62%)`,
  };
}

/**
 * Thumbnail. TikTok's signed cover URLs often come back as solid-black
 * images (they "load" fine, so onError never fires). Instead of showing a
 * black square we render a generated placeholder: a name-derived gradient
 * with the song title + author in small text.
 */
export default function Cover({
  src,
  alt = '',
  subtitle,
  className = '',
  useImage = false,
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
