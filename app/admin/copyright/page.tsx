import type { Metadata } from 'next';
import Link from 'next/link';
import CopyrightAdmin from '@/components/CopyrightAdmin';

export const metadata: Metadata = {
  title: 'Quản trị bản quyền',
  robots: { index: false, follow: false },
};

export default function CopyrightAdminPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-canvas text-ink">
      <div className="mx-auto w-full max-w-[980px] px-5 py-8 sm:px-8 sm:py-12">
        <nav className="mb-10 flex items-center justify-between border-b border-line-soft pb-4 text-sm">
          <Link href="/" className="font-display font-extrabold text-accent">
            TikPlay
          </Link>
          <span className="font-mono text-[10px] uppercase text-muted">
            Khu vực quản trị
          </span>
        </nav>
        <header className="mb-8">
          <h1 className="font-display text-3xl font-black text-ink">
            Báo cáo bản quyền
          </h1>
          <p className="mt-2 text-sm text-ink-secondary">
            Xác minh báo cáo trước khi chặn và xóa nội dung khỏi hệ thống.
          </p>
        </header>
        <CopyrightAdmin />
      </div>
    </main>
  );
}
