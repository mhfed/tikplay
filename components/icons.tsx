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
    strokeWidth: 2,
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

/** Partial-ring arc used as a loading spinner; pair with a `np__spin` rotate. */
export function SpinnerIcon({ size = 24, ...rest }: IconProps) {
  return (
    <svg {...stroke(size)} aria-hidden {...rest}>
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}
