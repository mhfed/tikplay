'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CheckIcon } from './icons';

export const TERMS_STORAGE_KEY = 'tikplay:terms:2026-07-21';

export default function TermsDialog() {
  const pathname = usePathname();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  useEffect(() => {
    try {
      setIsOpen(window.localStorage.getItem(TERMS_STORAGE_KEY) !== 'accepted');
    } catch {
      setIsOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    checkboxRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), a[href]',
      );
      if (!focusable?.length) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const acceptTerms = () => {
    if (!hasConfirmed) return;
    try {
      window.localStorage.setItem(TERMS_STORAGE_KEY, 'accepted');
    } catch {
      // Keep the acceptance for this page session when storage is unavailable.
    }
    setIsOpen(false);
  };

  if (
    !isOpen ||
    pathname === '/terms' ||
    pathname === '/copyright' ||
    pathname.startsWith('/admin/')
  )
    return null;

  return (
    <div className="fixed inset-0 z-[200] grid place-items-center bg-black/80 p-4 backdrop-blur-sm [animation:modal-backdrop-in_var(--motion-base)_var(--ease-out)]">
      <div
        ref={dialogRef}
        className="relative flex max-h-[min(760px,calc(100dvh-32px))] w-full max-w-[680px] flex-col overflow-hidden rounded-panel border border-line bg-elevated shadow-[0_24px_80px_rgba(0,0,0,0.72)] [animation:modal-panel-in_var(--motion-base)_var(--ease-spring)]"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="terms-title"
        aria-describedby="terms-summary"
      >
        <header className="border-b border-line-soft px-6 py-5 max-[640px]:px-5">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-compact border border-accent/30 bg-accent-muted px-2 py-1 font-mono text-[10px] font-bold uppercase text-accent">
              Phi thương mại
            </span>
            <span className="font-mono text-[10px] uppercase text-muted">
              Cập nhật 21/07/2026
            </span>
          </div>
          <h2
            id="terms-title"
            className="font-display text-xl font-extrabold text-ink max-[640px]:text-lg"
          >
            Điều khoản sử dụng và bản quyền
          </h2>
          <p id="terms-summary" className="mt-2 text-sm text-ink-secondary">
            Vui lòng đọc và xác nhận trước khi sử dụng TikPlay.
          </p>
        </header>

        <div className="overflow-y-auto px-6 py-5 text-[13px] leading-6 text-ink-secondary max-[640px]:px-5">
          <section className="mb-5">
            <h3 className="mb-1 font-display text-sm font-bold text-ink">
              1. Mục đích của nền tảng
            </h3>
            <p>
              TikPlay là công cụ miễn phí, phi thương mại, phục vụ nhu cầu cá
              nhân. TikPlay không liên kết, đại diện hoặc được bảo trợ bởi
              TikTok, YouTube hay bất kỳ chủ sở hữu nội dung nào.
            </p>
          </section>

          <section className="mb-5">
            <h3 className="mb-1 font-display text-sm font-bold text-ink">
              2. Quyền sở hữu nội dung
            </h3>
            <p>
              TikPlay không tuyên bố sở hữu và không cấp quyền sử dụng đối với
              nội dung của bên thứ ba. Mọi quyền tác giả, quyền liên quan, nhãn
              hiệu và quyền sở hữu trí tuệ khác vẫn thuộc về chủ sở hữu hợp pháp
              tương ứng.
            </p>
          </section>

          <section className="mb-5">
            <h3 className="mb-1 font-display text-sm font-bold text-ink">
              3. Trách nhiệm của người sử dụng
            </h3>
            <p>
              Bạn chỉ được nhập liên kết, truy cập, trích xuất, lưu trữ hoặc sử
              dụng nội dung do bạn sở hữu, đã được chủ sở hữu cho phép, hoặc
              được pháp luật hiện hành cho phép. Bạn tự chịu trách nhiệm về nội
              dung và liên kết mình cung cấp, mục đích sử dụng, việc xin các
              giấy phép cần thiết và mọi hậu quả phát sinh từ hành vi của mình.
            </p>
          </section>

          <section className="mb-5">
            <h3 className="mb-1 font-display text-sm font-bold text-ink">
              4. Hành vi không được phép
            </h3>
            <p>
              Không sử dụng TikPlay để xâm phạm bản quyền; phát hành lại, bán
              hoặc khai thác thương mại nội dung khi chưa được phép; vượt qua
              biện pháp kiểm soát truy cập; hoặc thực hiện hành vi trái pháp
              luật, điều khoản của nguồn nội dung hay quyền hợp pháp của bên thứ
              ba.
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-display text-sm font-bold text-ink">
              5. Xử lý vi phạm và giới hạn dịch vụ
            </h3>
            <p>
              TikPlay có thể chặn liên kết, gỡ dữ liệu hoặc hạn chế quyền truy
              cập khi nhận được thông báo hợp lệ hay phát hiện dấu hiệu vi phạm.
              Dịch vụ được cung cấp trên cơ sở hiện trạng và không bảo đảm mọi
              nguồn nội dung luôn khả dụng. Không nội dung nào trong thông báo
              này loại trừ các trách nhiệm không thể loại trừ theo pháp luật.
            </p>
          </section>
        </div>

        <footer className="border-t border-line-soft bg-canvas/60 px-6 py-4 max-[640px]:px-5">
          <label className="mb-4 flex cursor-pointer items-start gap-3 text-[13px] leading-5 text-ink">
            <input
              ref={checkboxRef}
              type="checkbox"
              checked={hasConfirmed}
              onChange={(event) => setHasConfirmed(event.target.checked)}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span>
              Tôi đã đọc, hiểu và đồng ý tuân thủ các điều khoản trên; tôi chịu
              trách nhiệm về quyền sử dụng nội dung do mình cung cấp.
            </span>
          </label>
          <div className="mb-4 flex gap-4 text-xs text-ink-secondary">
            <Link href="/terms" className="underline hover:text-ink">
              Điều khoản đầy đủ
            </Link>
            <Link href="/copyright" className="underline hover:text-ink">
              Chính sách bản quyền
            </Link>
          </div>
          <button
            type="button"
            disabled={!hasConfirmed}
            onClick={acceptTerms}
            className="inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-control border border-transparent bg-accent px-5 text-sm font-bold text-[#00201e] transition-[filter,transform,opacity] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <CheckIcon size={16} />
            Đồng ý và tiếp tục
          </button>
        </footer>
      </div>
    </div>
  );
}
