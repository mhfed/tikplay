'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { authClient } from '@/lib/auth/client';
import { useAuthFlow } from './AuthFlowProvider';
import { useAuthSession } from './AuthSessionProvider';

type AuthStep = 'initial' | 'sending' | 'sent' | 'redirecting' | 'error';

function maskEmail(email: string) {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}${'•'.repeat(Math.min(5, Math.max(2, name.length - 2)))}@${domain}`;
}

export default function AuthSurfaceHost() {
  const { isOpen, closeAuth, intent, completeAuth } = useAuthFlow();
  const { state, refresh } = useAuthSession();
  const [step, setStep] = useState<AuthStep>('initial');
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    opener.current = document.activeElement as HTMLElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => panel.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      opener.current?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && state === 'authenticated') void completeAuth();
  }, [isOpen, state, completeAuth]);

  if (!isOpen) return null;

  const finishError = () => {
    setStep('error');
    setError(
      navigator.onLine
        ? 'Không thể hoàn tất đăng nhập lúc này. Vui lòng thử lại.'
        : 'Bạn đang ngoại tuyến. Nhạc vẫn có thể tiếp tục phát.',
    );
  };

  const google = async () => {
    setStep('redirecting');
    const result = await authClient.signIn.social({
      provider: 'google',
      callbackURL: intent?.returnTo ?? window.location.pathname,
    });
    if (result.error) finishError();
  };

  const magicLink = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError('Nhập một địa chỉ email hợp lệ.');
      return;
    }
    setError('');
    setStep('sending');
    const result = await authClient.signIn.magicLink({
      email,
      callbackURL: intent?.returnTo ?? window.location.pathname,
    });
    if (result.error) finishError();
    else {
      setStep('sent');
      void refresh();
    }
  };

  return (
    <div
      className="auth-backdrop"
      onMouseDown={(event) =>
        event.target === event.currentTarget && closeAuth()
      }
      onKeyDown={(event) => event.key === 'Escape' && closeAuth()}
    >
      <div
        ref={panel}
        className="auth-surface"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="auth-surface__pulse" aria-hidden="true" />
        <button
          type="button"
          className="auth-surface__close"
          onClick={closeAuth}
          aria-label="Đóng hộp thoại đăng nhập"
        >
          ×
        </button>
        <p className="auth-surface__eyebrow">Tài khoản TikPlay</p>
        <h2 id={titleId} className="auth-surface__title">
          Giữ nhạc của bạn ở mọi nơi.
        </h2>
        <p className="auth-surface__copy">
          Đồng bộ thư viện, danh sách phát và sở thích. Bài hát đang phát sẽ
          không bị gián đoạn.
        </p>

        {intent && <div className="auth-intent">Tiếp tục: {intent.label}</div>}

        {step === 'sent' ? (
          <div className="auth-sent" role="status">
            <span className="auth-sent__icon">↗</span>
            <h3>Kiểm tra hộp thư</h3>
            <p>
              Liên kết đã được gửi đến <strong>{maskEmail(email)}</strong> và có
              hiệu lực trong 15 phút. Hãy kiểm tra cả thư rác.
            </p>
            <button type="button" onClick={() => setStep('initial')}>
              Dùng email khác
            </button>
          </div>
        ) : (
          <>
            <button
              type="button"
              className="auth-google"
              onClick={google}
              disabled={step === 'redirecting' || step === 'sending'}
            >
              <span aria-hidden="true">G</span>
              {step === 'redirecting'
                ? 'Đang chuyển đến Google…'
                : 'Tiếp tục với Google'}
            </button>
            <div className="auth-divider">
              <span>hoặc</span>
            </div>
            <form onSubmit={magicLink} className="auth-form">
              <label htmlFor="auth-email">Email</label>
              <div className="auth-form__row">
                <input
                  id="auth-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="ban@example.com"
                  disabled={step === 'sending'}
                  aria-describedby={error ? 'auth-error' : undefined}
                />
                <button type="submit" disabled={step === 'sending'}>
                  {step === 'sending' ? 'Đang gửi…' : 'Gửi liên kết'}
                </button>
              </div>
            </form>
            {error && (
              <p id="auth-error" className="auth-error" role="alert">
                {error}
              </p>
            )}
          </>
        )}
        <p className="auth-legal">
          Tiếp tục nghĩa là bạn đồng ý với <a href="/terms">Điều khoản</a> và
          chính sách dữ liệu của TikPlay.
        </p>
      </div>
    </div>
  );
}
