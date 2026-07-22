import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Điều khoản sử dụng',
  description: 'Điều khoản sử dụng nền tảng phi thương mại TikPlay.',
};

const sections = [
  {
    title: '1. Phạm vi và chấp thuận',
    content:
      'Khi truy cập hoặc sử dụng TikPlay, bạn xác nhận đã đọc, hiểu và đồng ý với các điều khoản này. Nếu không đồng ý, bạn không được tiếp tục sử dụng dịch vụ.',
  },
  {
    title: '2. Mục đích của TikPlay',
    content:
      'TikPlay là công cụ miễn phí, phi thương mại dành cho nhu cầu quản lý và phát nội dung âm thanh cá nhân. TikPlay không liên kết, đại diện hoặc được bảo trợ bởi TikTok, YouTube hay chủ sở hữu nội dung bên thứ ba.',
  },
  {
    title: '3. Quyền sở hữu trí tuệ',
    content:
      'TikPlay không tuyên bố sở hữu và không cấp giấy phép đối với nội dung của bên thứ ba. Quyền tác giả, quyền liên quan, nhãn hiệu và các quyền sở hữu trí tuệ khác vẫn thuộc chủ sở hữu hợp pháp tương ứng.',
  },
  {
    title: '4. Nghĩa vụ của người sử dụng',
    content:
      'Bạn chỉ được cung cấp và sử dụng nội dung do mình sở hữu, đã được cho phép hoặc được pháp luật hiện hành cho phép. Bạn chịu trách nhiệm về liên kết đã nhập, mục đích sử dụng, giấy phép cần thiết và hậu quả phát sinh từ hành vi của mình.',
  },
  {
    title: '5. Hành vi bị cấm',
    content:
      'Bạn không được dùng TikPlay để xâm phạm bản quyền; phát hành lại, bán hoặc khai thác thương mại nội dung khi chưa được phép; vượt qua biện pháp kiểm soát truy cập; gây quá tải hệ thống; hoặc thực hiện hành vi trái pháp luật và điều khoản của nguồn nội dung.',
  },
  {
    title: '6. Xử lý nội dung và tài khoản',
    content:
      'TikPlay có thể từ chối xử lý liên kết, gỡ dữ liệu, chặn nội dung hoặc hạn chế truy cập khi nhận được thông báo hợp lệ, phát hiện dấu hiệu vi phạm hoặc cần bảo vệ an toàn hệ thống.',
  },
  {
    title: '7. Giới hạn dịch vụ',
    content:
      'Dịch vụ được cung cấp trên cơ sở hiện trạng và có thể thay đổi, gián đoạn hoặc ngừng hoạt động. Không nội dung nào trong điều khoản này loại trừ trách nhiệm không thể loại trừ theo pháp luật áp dụng.',
  },
  {
    title: '8. Thay đổi điều khoản',
    content:
      'TikPlay có thể cập nhật điều khoản khi dịch vụ hoặc yêu cầu pháp lý thay đổi. Phiên bản mới sẽ ghi rõ ngày hiệu lực và có thể yêu cầu bạn xác nhận lại trước khi tiếp tục sử dụng.',
  },
];

export default function TermsPage() {
  return (
    <main className="h-dvh overflow-y-auto bg-canvas text-ink">
      <div className="mx-auto w-full max-w-[860px] px-5 py-8 sm:px-8 sm:py-12">
        <nav className="mb-10 flex items-center justify-between border-b border-line-soft pb-4 text-sm">
          <Link href="/" className="font-display font-extrabold text-accent">
            TikPlay
          </Link>
          <Link href="/copyright" className="text-ink-secondary hover:text-ink">
            Chính sách bản quyền
          </Link>
        </nav>

        <header className="mb-10 border-l-2 border-accent pl-5">
          <p className="mb-2 font-mono text-[11px] uppercase text-muted">
            Hiệu lực từ 21/07/2026
          </p>
          <h1 className="font-display text-3xl font-black text-ink sm:text-4xl">
            Điều khoản sử dụng
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-ink-secondary">
            Các nguyên tắc áp dụng khi truy cập và sử dụng nền tảng phi thương
            mại TikPlay.
          </p>
        </header>

        <div className="space-y-8 pb-12">
          {sections.map((section) => (
            <section key={section.title}>
              <h2 className="mb-2 font-display text-base font-extrabold text-ink">
                {section.title}
              </h2>
              <p className="text-[15px] leading-7 text-ink-secondary">
                {section.content}
              </p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
