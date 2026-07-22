import type { Metadata } from 'next';
import Link from 'next/link';
import CopyrightReportForm from '@/components/CopyrightReportForm';

export const metadata: Metadata = {
  title: 'Chính sách bản quyền',
  description: 'Chính sách và quy trình báo cáo vi phạm bản quyền của TikPlay.',
};

export default function CopyrightPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-canvas text-ink">
      <div className="mx-auto w-full max-w-[980px] px-5 py-8 sm:px-8 sm:py-12">
        <nav className="mb-10 flex items-center justify-between border-b border-line-soft pb-4 text-sm">
          <Link href="/" className="font-display font-extrabold text-accent">
            TikPlay
          </Link>
          <Link href="/terms" className="text-ink-secondary hover:text-ink">
            Điều khoản sử dụng
          </Link>
        </nav>

        <header className="mb-10 border-l-2 border-secondary pl-5">
          <p className="mb-2 font-mono text-[11px] uppercase text-muted">
            Quy trình thông báo và gỡ nội dung
          </p>
          <h1 className="font-display text-3xl font-black text-ink sm:text-4xl">
            Chính sách bản quyền
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
            TikPlay tôn trọng quyền sở hữu trí tuệ và xem xét các thông báo vi
            phạm được gửi đầy đủ, chính xác và thiện chí.
          </p>
        </header>

        <div className="grid items-start gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:gap-14">
          <aside className="space-y-7 text-sm leading-6 text-ink-secondary">
            <section>
              <h2 className="mb-2 font-display text-base font-extrabold text-ink">
                Thông tin cần cung cấp
              </h2>
              <p>
                Liên kết chính xác, danh tính và email liên hệ, căn cứ về quyền
                sở hữu hoặc ủy quyền, cùng mô tả đủ để xác định nội dung bị cho
                là vi phạm.
              </p>
            </section>
            <section>
              <h2 className="mb-2 font-display text-base font-extrabold text-ink">
                Cách xử lý
              </h2>
              <p>
                Báo cáo hợp lệ sẽ được rà soát. TikPlay có thể chặn nội dung,
                xóa dữ liệu và cache liên quan, yêu cầu bổ sung thông tin hoặc
                từ chối báo cáo thiếu căn cứ.
              </p>
            </section>
            <section>
              <h2 className="mb-2 font-display text-base font-extrabold text-ink">
                Lưu ý về thông tin cá nhân
              </h2>
              <p>
                Thông tin người báo cáo chỉ được dùng để xác minh và xử lý yêu
                cầu, không hiển thị trong thư viện công khai.
              </p>
            </section>
          </aside>

          <section className="border-t border-line pt-7 lg:border-t-0 lg:border-l lg:pl-12 lg:pt-0">
            <h2 className="mb-6 font-display text-xl font-extrabold text-ink">
              Gửi báo cáo vi phạm
            </h2>
            <CopyrightReportForm />
          </section>
        </div>
      </div>
    </main>
  );
}
