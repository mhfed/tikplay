'use client';

import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & {
  /** Pixel size applied to width/height. Defaults to 24. */
  size?: number;
};

/**
 * Shared SVG attributes for stroked (outline) icons. Fill-based icons
 * (play / pause) override fill/stroke per component.
 */
function stroke(size: number): SVGProps<SVGSVGElement> {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.6,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
}

export function PlayIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg
      {...stroke(size)}
      fill="currentColor"
      stroke="none"
      aria-hidden
      {...rest}
    >
      <path d="M7 5.5v13a1 1 0 0 0 1.54.84l10.3-6.5a1 1 0 0 0 0-1.68L8.54 4.66A1 1 0 0 0 7 5.5Z" />
    </svg>
  );
}

export function PauseIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg
      {...stroke(size)}
      fill="currentColor"
      stroke="none"
      aria-hidden
      {...rest}
    >
      <rect x="6.5" y="5" width="3.6" height="14" rx="1.2" />
      <rect x="13.9" y="5" width="3.6" height="14" rx="1.2" />
    </svg>
  );
}

export function PrevIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M18 5.5v13" />
      <path d="M8 12 16.5 5.5v13L8 12Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function NextIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M6 5.5v13" />
      <path d="M16 12 7.5 5.5v13L16 12Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function ShuffleIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M16 4h4v4" />
      <path d="M4 20 20 4" />
      <path d="M4 4l4 0" />
      <path d="M16 20h4v-4" />
      <path d="M4 4l16 16" />
    </svg>
  );
}

export function RepeatIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M3.5 11V9a4 4 0 0 1 4-4h13" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M20.5 13v2a4 4 0 0 1-4 4H3.5" />
    </svg>
  );
}

export function RepeatOneIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M17 2.5 20.5 6 17 9.5" />
      <path d="M3.5 11V9a4 4 0 0 1 4-4h13" />
      <path d="M7 21.5 3.5 18 7 14.5" />
      <path d="M20.5 13v2a4 4 0 0 1-4 4H3.5" />
      <path d="M11.5 10.5 12.5 9.5h-1.5" />
      <path d="M11.5 14v-3.5h1" />
    </svg>
  );
}

export function SearchIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </svg>
  );
}

export function VolumeIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path
        d="M4 9.5v5a1 1 0 0 0 1.5.86L10 13.2V10.8L5.5 8.64A1 1 0 0 0 4 9.5Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M14.5 9a4 4 0 0 1 0 6" />
      <path d="M17.5 6.5a7.5 7.5 0 0 1 0 11" />
    </svg>
  );
}

export function VolumeLowIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path
        d="M4 9.5v5a1 1 0 0 0 1.5.86L10 13.2V10.8L5.5 8.64A1 1 0 0 0 4 9.5Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="M14.5 9a4 4 0 0 1 0 6" />
    </svg>
  );
}

export function VolumeMuteIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path
        d="M4 9.5v5a1 1 0 0 0 1.5.86L10 13.2V10.8L5.5 8.64A1 1 0 0 0 4 9.5Z"
        fill="currentColor"
        stroke="none"
      />
      <path d="m15.5 9.5 5 5" />
      <path d="m20.5 9.5-5 5" />
    </svg>
  );
}

export function CloseIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </svg>
  );
}

export function HomeIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="m3.5 10.7 8.5-7 8.5 7" />
      <path d="M5.7 9.2v9.3a1.8 1.8 0 0 0 1.8 1.8h2.2v-5.1a1.8 1.8 0 0 1 1.8-1.8h1a1.8 1.8 0 0 1 1.8 1.8v5.1h2.2a1.8 1.8 0 0 0 1.8-1.8V9.2" />
    </svg>
  );
}

export function PlaylistsIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <rect x="4" y="5" width="12" height="3" rx="1.5" />
      <rect x="4" y="10.5" width="12" height="3" rx="1.5" />
      <rect x="4" y="16" width="8" height="3" rx="1.5" />
      <path d="M18 14v6" />
      <path d="M18 14.8 21 14v4.5" />
      <circle cx="16.8" cy="20" r="1.2" />
      <circle cx="19.8" cy="18.5" r="1.2" />
    </svg>
  );
}

type HeartIconProps = IconProps & {
  filled?: boolean;
};

export function HeartIcon({
  size = 24,
  filled = false,
  ...rest
}: HeartIconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path
        d="M20.2 5.7a5 5 0 0 0-7.1 0L12 6.8l-1.1-1.1a5 5 0 0 0-7.1 7.1L12 21l8.2-8.2a5 5 0 0 0 0-7.1Z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

export function TagIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M12.3 3.3H4.8a1.5 1.5 0 0 0-1.5 1.5v7.5l8.5 8.4a1.8 1.8 0 0 0 2.5 0l6.4-6.4a1.8 1.8 0 0 0 0-2.5l-8.4-8.5Z" />
      <circle cx="8" cy="8" r="1.1" />
    </svg>
  );
}

export function SettingsIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M4 7h10" />
      <path d="M18 7h2" />
      <circle cx="16" cy="7" r="2" />
      <path d="M4 17h2" />
      <path d="M10 17h10" />
      <circle cx="8" cy="17" r="2" />
    </svg>
  );
}

export function MusicIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </svg>
  );
}

export function ListMusicIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M4 6h11" />
      <path d="M4 12h11" />
      <path d="M4 18h7" />
      <path d="M17 14v6" />
      <circle cx="19" cy="14" r="2" />
    </svg>
  );
}

export function ClockIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </svg>
  );
}

export function PlusIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </svg>
  );
}

export function ShareIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 10.7 15.4 6.3M8.6 13.3l6.8 4.4" />
    </svg>
  );
}

export function CheckIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function SlidersIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <line x1="4" y1="21" x2="4" y2="14" />
      <line x1="4" y1="10" x2="4" y2="3" />
      <line x1="12" y1="21" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12" y2="3" />
      <line x1="20" y1="21" x2="20" y2="16" />
      <line x1="20" y1="12" x2="20" y2="3" />
      <line x1="1" y1="14" x2="7" y2="14" />
      <line x1="9" y1="8" x2="15" y2="8" />
      <line x1="17" y1="16" x2="23" y2="16" />
    </svg>
  );
}

export function GripIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M5 9h14" />
      <path d="M5 15h14" />
    </svg>
  );
}

export function ChevronUpIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="m6 15 6-6 6 6" />
    </svg>
  );
}

export function RefreshCwIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M20 12a8 8 0 0 0-13.5-5.5L4 11" />
      <path d="M4 12a8 8 0 0 0 13.5 5.5L20 13" />
    </svg>
  );
}

/** Partial-ring arc used as a loading spinner; pair with a `np__spin` rotate. */
export function SpinnerIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}

export function SourceIcon({
  source,
  size = 24,
  ...rest
}: IconProps & { source?: string }) {
  if (!source) return <MusicIcon size={size} {...rest} />;
  switch (source) {
    case 'youtube':
      return (
        <svg {...stroke(size)} aria-hidden {...rest}>
          <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
          <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" />
        </svg>
      );
    case 'instagram':
      return (
        <svg {...stroke(size)} aria-hidden {...rest}>
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
        </svg>
      );
    case 'facebook':
      return (
        <svg {...stroke(size)} aria-hidden {...rest}>
          <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
        </svg>
      );
    case 'soundcloud':
      return (
        <svg {...stroke(size)} aria-hidden {...rest}>
          <path d="M12 18.232a5 5 0 1 0-7.071-7.071L2.1 14.1l2.828 2.828L7.757 14.1v4.243a4 4 0 0 0 5.657 5.657l2.829-2.829-1.414-1.414a3 3 0 0 1-4.243 0z" />
          <path d="M16.929 11.854a5 5 0 1 0 0 7.071l4.243-4.243-4.243-4.243a7 7 0 0 0-9.9-9.9l1.415 1.414a5 5 0 0 1 7.07 7.071z" />
          <path d="M7 14v4" />
          <path d="M11 12v6" />
          <path d="M15 14v4" />
          <path d="M19 15v2" />
        </svg>
      );
    default:
      return (
        <svg {...stroke(size)} aria-hidden {...rest}>
          <path d="M9 12a4 4 0 1 0 4 4V4a5 5 0 0 0 5 5" />
        </svg>
      );
  }
}
