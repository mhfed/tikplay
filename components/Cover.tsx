'use client';

import { useState } from 'react';

interface CoverProps {
  src?: string;
  alt?: string;
  className?: string;
}

/**
 * Thumbnail image with a graceful fallback. TikTok's signed cover URLs
 * sometimes fail to load (expired signature / CDN hotlink rules), so on error
 * we swap to a gradient placeholder instead of a broken image icon.
 */
export default function Cover({ src, alt = '', className = '' }: CoverProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return <div className={`cover cover--fallback ${className}`} aria-hidden>♪</div>;
  }

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
