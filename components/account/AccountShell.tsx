'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthFlow } from '@/components/auth/AuthFlowProvider';
import { useAuthSession } from '@/components/auth/AuthSessionProvider';

const links = [
  ['/account/profile', 'Hồ sơ', 'Tên, email và ngôn ngữ'],
  ['/account/preferences', 'Sở thích nghe', 'Cá nhân hóa và nội dung'],
  ['/account/sessions', 'Thiết bị & phiên', 'Quản lý nơi đã đăng nhập'],
  [
    '/account/privacy',
    'Quyền riêng tư & dữ liệu',
    'Xuất, xóa lịch sử, tài khoản',
  ],
] as const;

export default function AccountShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { state, user } = useAuthSession();
  const { openAuth } = useAuthFlow();

  if (state !== 'authenticated' || !user) {
    return (
      <main className="account-page">
        <section className="account-gate" aria-labelledby="account-gate-title">
          <span className="account-gate__mark">◌</span>
          <h1 id="account-gate-title">Tài khoản của bạn, theo cách của bạn.</h1>
          <p>
            Đăng nhập để quản lý thư viện riêng tư. Bạn vẫn có thể khám phá và
            nghe nhạc như khách.
          </p>
          <button
            type="button"
            className="account-primary"
            onClick={() => openAuth({ source: 'account-gate' })}
          >
            Đăng nhập
          </button>
          <Link href="/" className="account-secondary">
            Về trang chủ
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="account-page">
      <div className="account-heading">
        <Link href="/" className="account-back">
          ← TikPlay
        </Link>
        <p className="account-kicker">Không gian cá nhân</p>
        <h1>Chào {user.name || 'bạn'}.</h1>
        <p>Những điều chỉnh nhỏ để trải nghiệm nghe vừa vặn hơn.</p>
      </div>
      <div className="account-layout">
        <nav className="account-nav" aria-label="Điều hướng tài khoản">
          {links.map(([href, label, description]) => (
            <Link
              key={href}
              href={href}
              className={
                pathname === href
                  ? 'account-nav__link account-nav__link--active'
                  : 'account-nav__link'
              }
            >
              <strong>{label}</strong>
              <span>{description}</span>
            </Link>
          ))}
        </nav>
        <section className="account-content">{children}</section>
      </div>
    </main>
  );
}
