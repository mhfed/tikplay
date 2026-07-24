'use client';

import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { CloseIcon } from './icons';
import './PwaInstallModal.css';

/* ───────── storage keys ───────── */
const DISMISS_KEY = 'tikplay:pwa-install:dismissed';
const PERMANENT_KEY = 'tikplay:pwa-install:permanent-hide';
const STORAGE_VERSION = '2026-07-24';

/* ───────── platform helpers ───────── */
type Platform = 'ios-safari' | 'android-chrome' | 'other-mobile' | null;

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  const isMobile =
    /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  if (!isMobile) return null;

  // Already running as PWA → no prompt needed
  if (
    window.matchMedia('(display-mode: standalone)').matches ||
    // @ts-expect-error — navigator.standalone is iOS-specific
    navigator.standalone
  )
    return null;

  const isIOS = /iPad|iPhone|iPod/.test(ua);
  if (isIOS) return 'ios-safari';

  const isAndroid = /Android/.test(ua);
  if (isAndroid) return 'android-chrome';

  return 'other-mobile';
}

/* ───────── Step type ───────── */
interface Step {
  num: number;
  title: string;
  desc: string;
  highlight?: string;
}

/* ───────── Phone mockup illustration ───────── */

/** Base phone frame shared by iOS & Android illustrations. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg className="pwa-phone" viewBox="0 0 240 440" fill="none" aria-hidden>
      {/* Phone body */}
      <rect
        x="3"
        y="3"
        width="234"
        height="434"
        rx="28"
        stroke="currentColor"
        strokeOpacity="0.18"
        strokeWidth="3"
        fill="var(--bg)"
      />
      {/* Screen */}
      <clipPath id="pwa-screen-clip">
        <rect x="12" y="12" width="216" height="416" rx="20" />
      </clipPath>
      <g clip-path="url(#pwa-screen-clip)">{children}</g>
      {/* Top notch / speaker */}
      <rect
        x="96"
        y="6"
        width="48"
        height="4"
        rx="2"
        fill="currentColor"
        fillOpacity="0.12"
      />
    </svg>
  );
}

/** Safari-style browser chrome (toolbar at bottom). */
function IOSChrome() {
  return (
    <>
      {/* Status bar */}
      <rect x="12" y="12" width="216" height="24" fill="var(--bg)" />
      <text
        x="24"
        y="28"
        fontSize="10"
        fontWeight="600"
        fill="var(--text)"
        fontFamily="var(--font-ui)"
      >
        9:41
      </text>

      {/* Safari URL bar */}
      <rect
        x="12"
        y="40"
        width="216"
        height="36"
        fill="var(--surface)"
        rx="8"
      />
      <text
        x="120"
        y="62"
        fontSize="10"
        textAnchor="middle"
        fill="var(--muted)"
        fontFamily="var(--font-ui)"
      >
        craw-music.fly.dev
      </text>

      {/* Page content placeholder */}
      <rect
        x="24"
        y="88"
        width="192"
        height="240"
        fill="var(--surface)"
        rx="8"
        opacity="0.4"
      />
      <rect
        x="36"
        y="104"
        width="168"
        height="10"
        fill="var(--surface-2)"
        rx="3"
      />
      <rect
        x="36"
        y="124"
        width="140"
        height="8"
        fill="var(--surface-2)"
        rx="3"
        opacity="0.6"
      />
      <rect
        x="36"
        y="142"
        width="168"
        height="8"
        fill="var(--surface-2)"
        rx="3"
        opacity="0.4"
      />
      <rect
        x="36"
        y="160"
        width="120"
        height="8"
        fill="var(--surface-2)"
        rx="3"
        opacity="0.3"
      />

      {/* Safari bottom toolbar */}
      <rect x="12" y="340" width="216" height="44" fill="var(--bg)" />
      <rect
        x="12"
        y="340"
        width="216"
        height="1"
        fill="currentColor"
        fillOpacity="0.06"
      />

      {/* Back */}
      <path
        d="M32 362 42 354M32 362 42 370"
        stroke="var(--muted-2)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      {/* Share button (highlighted) */}
      <circle cx="120" cy="362" r="14" fill="var(--accent)" opacity="0.15" />
      <rect
        x="112"
        y="358"
        width="16"
        height="8"
        rx="1"
        stroke="var(--accent)"
        strokeWidth="1.6"
      />
      <path
        d="M120 354v5M117 357l3-3 3 3"
        stroke="var(--accent)"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Tabs */}
      <rect
        x="176"
        y="354"
        width="16"
        height="16"
        rx="3"
        stroke="var(--muted-2)"
        strokeWidth="1.6"
      />
      <rect
        x="180"
        y="358"
        width="8"
        height="8"
        rx="1"
        stroke="var(--muted-2)"
        strokeWidth="1"
      />

      {/* Arrow callout pointing to Share button */}
      <path
        d="M120 386v12l-6-6M120 398l6-6"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </>
  );
}

/** Chrome-style browser chrome (toolbar at top). */
function AndroidChrome() {
  return (
    <>
      {/* Status bar */}
      <rect x="12" y="12" width="216" height="24" fill="var(--bg)" />
      <text
        x="24"
        y="28"
        fontSize="10"
        fontWeight="600"
        fill="var(--text)"
        fontFamily="var(--font-ui)"
      >
        9:41
      </text>
      <rect x="180" y="18" width="8" height="12" rx="1" fill="var(--muted-2)" />
      <rect x="192" y="18" width="8" height="12" rx="1" fill="var(--muted-2)" />
      <rect x="204" y="18" width="8" height="12" rx="1" fill="var(--muted-2)" />

      {/* Chrome URL bar */}
      <rect x="12" y="40" width="216" height="40" fill="var(--bg)" />
      <rect
        x="20"
        y="46"
        width="172"
        height="28"
        fill="var(--surface)"
        rx="14"
      />
      <text
        x="106"
        y="65"
        fontSize="10"
        textAnchor="middle"
        fill="var(--muted)"
        fontFamily="var(--font-ui)"
      >
        craw-music.fly.dev
      </text>

      {/* Menu button (⋮) highlighted */}
      <circle cx="214" cy="60" r="12" fill="var(--accent)" opacity="0.15" />
      <circle cx="214" cy="55" r="1.5" fill="var(--accent)" />
      <circle cx="214" cy="60" r="1.5" fill="var(--accent)" />
      <circle cx="214" cy="65" r="1.5" fill="var(--accent)" />

      {/* Page content placeholder */}
      <rect
        x="24"
        y="92"
        width="192"
        height="232"
        fill="var(--surface)"
        rx="8"
        opacity="0.4"
      />
      <rect
        x="36"
        y="108"
        width="168"
        height="10"
        fill="var(--surface-2)"
        rx="3"
      />
      <rect
        x="36"
        y="128"
        width="140"
        height="8"
        fill="var(--surface-2)"
        rx="3"
        opacity="0.6"
      />
      <rect
        x="36"
        y="146"
        width="168"
        height="8"
        fill="var(--surface-2)"
        rx="3"
        opacity="0.4"
      />
      <rect
        x="36"
        y="164"
        width="120"
        height="8"
        fill="var(--surface-2)"
        rx="3"
        opacity="0.3"
      />

      {/* Bottom Android nav bar */}
      <rect x="12" y="340" width="216" height="44" fill="var(--bg)" />
      <rect
        x="12"
        y="340"
        width="216"
        height="1"
        fill="currentColor"
        fillOpacity="0.06"
      />
      <rect
        x="100"
        y="368"
        width="40"
        height="3"
        rx="1.5"
        fill="var(--muted-2)"
        opacity="0.5"
      />

      {/* Arrow callout pointing to Menu button */}
      <path
        d="M214 80v-6M214 80l-5-5M214 80l5-5"
        stroke="var(--accent)"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.7"
      />
    </>
  );
}

/* ───────── Step illustration wrapper ───────── */
function InstallIllustration({ platform }: { platform: Platform }) {
  if (platform === 'ios-safari')
    return (
      <PhoneFrame>
        <IOSChrome />
      </PhoneFrame>
    );
  if (platform === 'android-chrome')
    return (
      <PhoneFrame>
        <AndroidChrome />
      </PhoneFrame>
    );
  return (
    <div className="pwa-generic-icon" aria-hidden>
      <svg viewBox="0 0 80 80" fill="none" width="80" height="80">
        {/* Download arrow */}
        <circle
          cx="40"
          cy="40"
          r="36"
          stroke="currentColor"
          strokeOpacity="0.12"
          strokeWidth="3"
        />
        <path
          d="M40 56V28M32 48l8 8 8-8"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect
          x="24"
          y="60"
          width="32"
          height="3"
          rx="1.5"
          fill="var(--accent)"
          opacity="0.4"
        />
      </svg>
    </div>
  );
}

/* ───────── Steps data ───────── */
const IOS_STEPS: Step[] = [
  {
    num: 1,
    title: 'Nhấn nút Chia sẻ',
    desc: 'Trên thanh công cụ Safari phía dưới, nhấn vào biểu tượng hình vuông có mũi tên ↑.',
  },
  {
    num: 2,
    title: 'Chọn "Thêm vào Màn hình chính"',
    desc: 'Cuộn xuống và nhấn vào biểu tượng dấu cộng (+) trong danh sách tác vụ.',
    highlight: 'Thêm vào Màn hình chính',
  },
  {
    num: 3,
    title: 'Nhấn "Thêm"',
    desc: 'Góc trên bên phải, nhấn "Thêm" để hoàn tất. TikPlay sẽ hiển thị trên màn hình chính!',
  },
];

const ANDROID_STEPS: Step[] = [
  {
    num: 1,
    title: 'Nhấn nút Menu',
    desc: 'Trên thanh địa chỉ Chrome, nhấn vào biểu tượng ba chấm (⋮) ở góc phải.',
  },
  {
    num: 2,
    title: 'Chọn "Cài đặt ứng dụng"',
    desc: 'Trong menu, nhấn vào "Cài đặt ứng dụng" (Install app) hoặc "Thêm vào Màn hình chính".',
    highlight: 'Cài đặt ứng dụng',
  },
  {
    num: 3,
    title: 'Nhấn "Cài đặt"',
    desc: 'Xác nhận cài đặt trong hộp thoại. TikPlay sẽ xuất hiện trên màn hình chính!',
  },
];

const OTHER_STEPS: Step[] = [
  {
    num: 1,
    title: 'Mở menu trình duyệt',
    desc: 'Tìm tùy chọn "Thêm vào Màn hình chính" hoặc "Cài đặt ứng dụng" trong menu trình duyệt.',
  },
  {
    num: 2,
    title: 'Chọn Thêm / Cài đặt',
    desc: 'Nhấn xác nhận để thêm TikPlay vào màn hình chính của bạn.',
  },
  {
    num: 3,
    title: 'Sử dụng như ứng dụng',
    desc: 'Mở TikPlay từ màn hình chính để trải nghiệm như một ứng dụng gốc!',
  },
];

/* ───────── Main component ───────── */
export default function PwaInstallModal() {
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);
  const [platform, setPlatform] = useState<Platform>(null);
  const [, setDismissed] = useLocalStorage(
    `${DISMISS_KEY}:${STORAGE_VERSION}`,
    false,
  );
  const [permanentHide, setPermanentHide] = useLocalStorage(
    `${PERMANENT_KEY}:${STORAGE_VERSION}`,
    false,
  );
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const dontShowAgainRef = useRef(false);

  // Sync ref with state so the keyboard handler can read the latest value
  // without needing the state in its closure.
  useEffect(() => {
    dontShowAgainRef.current = dontShowAgain;
  }, [dontShowAgain]);

  // Hydration guard + detection
  useEffect(() => {
    setMounted(true);
    // Small delay so we don't flash the modal on fast transitions
    const timer = setTimeout(() => {
      setPlatform(detectPlatform());
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = useCallback(() => {
    setDismissed(true);
    if (dontShowAgainRef.current) setPermanentHide(true);
    setPlatform(null);
  }, [setDismissed, setPermanentHide]);

  // Keyboard trap + Escape-to-close
  useEffect(() => {
    if (!platform) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        handleClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button, input, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('keydown', handleKey);
    };
  }, [platform, handleClose]);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (platform) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [platform]);

  // Don't render on admin / terms pages
  const isExcludedPage =
    pathname === '/terms' ||
    pathname === '/copyright' ||
    pathname.startsWith('/admin/');

  // Show if: mounted, on mobile, not standalone, not permanently hidden
  const shouldShow = mounted && platform && !permanentHide && !isExcludedPage;

  if (!shouldShow) return null;

  const steps =
    platform === 'ios-safari'
      ? IOS_STEPS
      : platform === 'android-chrome'
        ? ANDROID_STEPS
        : OTHER_STEPS;

  return createPortal(
    <div className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-black/80 p-4 backdrop-blur-sm [animation:modal-backdrop-in_var(--motion-base)_var(--ease-out)]">
      <div
        ref={dialogRef}
        className="relative w-full max-w-[440px] overflow-hidden rounded-panel border border-line bg-elevated shadow-[0_24px_80px_rgba(0,0,0,0.72)] [animation:modal-panel-in_var(--motion-base)_var(--ease-spring)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pwa-title"
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute right-3 top-3 z-10 flex size-8 cursor-pointer items-center justify-center rounded-full text-muted transition-colors hover:bg-surface hover:text-ink"
          aria-label="Đóng"
        >
          <CloseIcon size={18} />
        </button>

        {/* Header */}
        <header className="px-6 pt-8 pb-4 text-center max-[400px]:px-4">
          <div className="mb-3 inline-flex size-14 items-center justify-center rounded-compact bg-accent-muted">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              width="28"
              height="28"
              stroke="var(--accent)"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="9" width="18" height="12" rx="2" />
              <path d="M12 3v6" />
              <path d="m9 6 3-3 3 3" />
            </svg>
          </div>
          <h2
            id="pwa-title"
            className="font-display text-xl font-extrabold text-ink max-[400px]:text-lg"
          >
            Cài đặt TikPlay
          </h2>
          <p className="mt-2 text-sm text-ink-secondary">
            Cài đặt TikPlay lên màn hình chính để trải nghiệm nhanh hơn, nghe
            nhạc offline như một ứng dụng gốc!
          </p>
        </header>

        {/* Illustration */}
        <div className="flex justify-center px-6 pb-3">
          <InstallIllustration platform={platform} />
        </div>

        {/* Steps */}
        <div className="px-6 pb-6 max-[400px]:px-4">
          <ol className="space-y-4">
            {steps.map((step) => (
              <li key={step.num} className="flex gap-4">
                <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent-muted font-display text-xs font-bold text-accent">
                  {step.num}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">{step.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-secondary">
                    {step.desc}
                  </p>
                  {step.highlight && (
                    <span className="mt-1 inline-block rounded-compact bg-accent-muted px-2 py-0.5 text-[11px] font-semibold text-accent">
                      {step.highlight}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <footer className="border-t border-line-soft px-6 py-4 max-[400px]:px-4">
          {/* Don't show again */}
          <label className="mb-3 flex cursor-pointer items-center gap-2.5 text-xs text-ink-secondary">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => setDontShowAgain(e.target.checked)}
              className="size-4 accent-[var(--accent)]"
            />
            <span>Không hỏi lại lần sau</span>
          </label>

          <button
            type="button"
            onClick={handleClose}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent bg-accent px-5 text-sm font-bold text-[#00201e] transition-[filter,transform,opacity] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.99]"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              width="18"
              height="18"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Đã hiểu
          </button>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
