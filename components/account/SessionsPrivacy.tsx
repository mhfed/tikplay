'use client';

import { useEffect, useState } from 'react';

type Session = {
  id: string;
  deviceLabel?: string | null;
  expiresAt: string;
  lastSeenAt?: string;
};

export function SessionList() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [status, setStatus] = useState('Đang tải phiên…');
  const load = async () => {
    const response = await fetch('/api/privacy/sessions');
    if (!response.ok) throw new Error();
    const body = await response.json();
    setSessions(body.sessions ?? []);
    setStatus('');
  };
  useEffect(() => {
    void load().catch(() => setStatus('Không thể tải danh sách phiên.'));
  }, []);
  const revoke = async (id: string) => {
    setStatus('Đang thu hồi…');
    await fetch('/api/privacy/sessions', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: id }),
    });
    await load();
  };
  const revokeOthers = async () => {
    setStatus('Đang thu hồi…');
    await fetch('/api/privacy/sessions', { method: 'POST' });
    await load();
  };
  return (
    <div className="account-form">
      <div className="session-list">
        {sessions.map((item, index) => (
          <div className="session-row" key={item.id}>
            <span className="session-row__icon">{index === 0 ? '●' : '○'}</span>
            <div>
              <strong>
                {item.deviceLabel ||
                  (index === 0 ? 'Thiết bị hiện tại' : 'Thiết bị khác')}
              </strong>
              <small>
                Hoạt động gần đây · hết hạn{' '}
                {new Date(item.expiresAt).toLocaleDateString('vi-VN')}
              </small>
            </div>
            {index > 0 && (
              <button type="button" onClick={() => void revoke(item.id)}>
                Thu hồi
              </button>
            )}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="account-danger-outline"
        onClick={() => void revokeOthers()}
      >
        Đăng xuất khỏi thiết bị khác
      </button>
      <p role="status">{status}</p>
    </div>
  );
}

export function PrivacyControls() {
  const [status, setStatus] = useState('');
  const clearHistory = async () => {
    if (
      !window.confirm(
        'Xóa toàn bộ lịch sử nghe? Hành động này không thể hoàn tác.',
      )
    )
      return;
    const response = await fetch('/api/privacy/history', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    setStatus(response.ok ? 'Đã xóa lịch sử nghe.' : 'Chưa thể xóa lịch sử.');
  };
  const deleteAccount = async () => {
    if (
      !window.confirm(
        'Yêu cầu xóa tài khoản? Tài khoản sẽ bị khóa ngay và xóa vĩnh viễn sau 30 ngày.',
      )
    )
      return;
    const response = await fetch('/api/privacy/deletion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });
    setStatus(
      response.ok
        ? 'Tài khoản đã được lên lịch xóa trong 30 ngày.'
        : 'Chưa thể xử lý yêu cầu.',
    );
  };
  return (
    <div className="account-form">
      <div className="privacy-card">
        <div>
          <strong>Tải dữ liệu của bạn</strong>
          <small>Nhận bản JSON gồm hồ sơ, thư viện và hoạt động cá nhân.</small>
        </div>
        <a className="account-secondary" href="/api/privacy/export">
          Tải bản xuất
        </a>
      </div>
      <div className="privacy-card">
        <div>
          <strong>Lịch sử nghe</strong>
          <small>
            Xóa hoạt động nghe đã lưu. Thư viện và playback không bị ảnh hưởng.
          </small>
        </div>
        <button
          type="button"
          className="account-danger-outline"
          onClick={() => void clearHistory()}
        >
          Xóa lịch sử
        </button>
      </div>
      <div className="privacy-card privacy-card--danger">
        <div>
          <strong>Vùng nguy hiểm</strong>
          <small>
            Yêu cầu xóa sẽ thu hồi mọi phiên và bắt đầu thời gian chờ 30 ngày.
          </small>
        </div>
        <button
          type="button"
          className="account-danger"
          onClick={() => void deleteAccount()}
        >
          Xóa tài khoản
        </button>
      </div>
      <p role="status">{status}</p>
    </div>
  );
}
