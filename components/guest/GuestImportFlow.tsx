'use client';

import { useEffect, useMemo, useState } from 'react';

type GuestTrack = {
  clientRef: string;
  title?: string;
  author?: string;
  canonicalSourceUrl?: string;
  addedAt: string;
};
type GuestPlaylist = {
  clientRef: string;
  name: string;
  trackRefs: string[];
  sortOrder: number;
};
type Snapshot = {
  version: 1;
  snapshotId: string;
  createdAt: string;
  updatedAt: string;
  deviceId: string;
  tracks: GuestTrack[];
  playlists: GuestPlaylist[];
};
type Step = 'offer' | 'review' | 'conflicts' | 'progress' | 'result';
type Preview = {
  id: string;
  payloadHash: string;
  conflicts?: Array<{ kind?: string; name?: string; action?: string }>;
};

const DATA_KEY = 'tikplay:guest:v1:data';
const STATUS_KEY = 'tikplay:guest:v1:import-status';

function readSnapshot(): Snapshot | null {
  try {
    const value = JSON.parse(
      localStorage.getItem(DATA_KEY) ?? 'null',
    ) as Snapshot | null;
    return value?.version === 1 && typeof value.snapshotId === 'string'
      ? value
      : null;
  } catch {
    return null;
  }
}

export default function GuestImportFlow({ onClose }: { onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [step, setStep] = useState<Step>('offer');
  const [selection, setSelection] = useState({ tracks: true, playlists: true });
  const [status, setStatus] = useState('');
  const [previewData, setPreviewData] = useState<Preview | null>(null);
  const [result, setResult] = useState<{
    imported?: number;
    skipped?: number;
    renamed?: number;
  } | null>(null);

  useEffect(() => setSnapshot(readSnapshot()), []);
  const selectedSnapshot = useMemo(
    () =>
      snapshot && {
        ...snapshot,
        tracks: selection.tracks ? snapshot.tracks : [],
        playlists: selection.playlists ? snapshot.playlists : [],
      },
    [snapshot, selection],
  );
  if (!snapshot) return null;

  const preview = async () => {
    setStep('review');
    setStatus('Đang kiểm tra dữ liệu…');
    try {
      const response = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idempotencyKey: snapshot.snapshotId,
          snapshot: selectedSnapshot,
        }),
      });
      const body = await response.json();
      if (!response.ok || !body.import?.id || !body.import?.payloadHash) {
        setStatus('Bản sao đã cũ hoặc không thể đọc. Hãy thử lại sau.');
        return;
      }
      setPreviewData({
        id: body.import.id,
        payloadHash: body.import.payloadHash,
        conflicts: body.import.conflicts,
      });
      setStep(body.import.conflicts?.length ? 'conflicts' : 'review');
      setStatus('');
    } catch {
      setStatus(
        'Không thể kiểm tra lúc này. Dữ liệu vẫn được giữ trên thiết bị.',
      );
    }
  };
  const commit = async () => {
    if (!previewData) {
      await preview();
      return;
    }
    setStep('progress');
    setStatus('Đang nhập an toàn…');
    try {
      const response = await fetch('/api/import/commit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: previewData.id,
          payloadHash: previewData.payloadHash,
        }),
      });
      const body = await response.json();
      if (!response.ok) {
        setStep('review');
        setPreviewData(null);
        setStatus('Bản xem trước đã hết hạn. Hãy tạo lại để thử lại an toàn.');
        return;
      }
      localStorage.setItem(
        STATUS_KEY,
        JSON.stringify({
          status: 'confirmed',
          snapshotId: snapshot.snapshotId,
        }),
      );
      localStorage.removeItem(DATA_KEY);
      setResult(body.resultCounts ?? body.result ?? {});
      setStep('result');
      setStatus('');
    } catch {
      setStep('review');
      setStatus('Mất kết nối. Dữ liệu guest vẫn được giữ lại để thử lại.');
    }
  };

  return (
    <div className="auth-backdrop" role="presentation">
      <section
        className="auth-surface guest-import"
        role="dialog"
        aria-modal="true"
        aria-labelledby="guest-import-title"
      >
        <button
          type="button"
          className="auth-surface__close"
          onClick={onClose}
          aria-label="Đóng"
        >
          ×
        </button>
        <p className="auth-surface__eyebrow">Sao lưu local</p>
        <h2 id="guest-import-title">Mang thư viện theo bạn.</h2>
        {step === 'offer' && (
          <>
            <p className="auth-surface__copy">
              TikPlay tìm thấy {snapshot.tracks.length} bài hát và{' '}
              {snapshot.playlists.length} danh sách phát trên thiết bị này.
            </p>
            <div className="guest-import__actions">
              <button
                className="account-primary"
                type="button"
                onClick={() => void preview()}
              >
                Xem lại dữ liệu
              </button>
              <button
                className="account-secondary"
                type="button"
                onClick={onClose}
              >
                Để sau
              </button>
            </div>
          </>
        )}
        {step === 'conflicts' && (
          <>
            <p className="auth-surface__copy">
              Một số mục đã có trong tài khoản. Không có dữ liệu nào bị ghi đè;
              các mục mới sẽ được giữ lại với tên rõ ràng.
            </p>
            <p className="auth-error" role="status">
              Đã tìm thấy {previewData?.conflicts?.length ?? 0} xung đột cần xác
              nhận.
            </p>
            <div className="guest-import__actions">
              <button
                className="account-primary"
                type="button"
                onClick={() => void commit()}
              >
                Tiếp tục nhập
              </button>
              <button
                className="account-secondary"
                type="button"
                onClick={() => setStep('review')}
              >
                Xem lại lựa chọn
              </button>
            </div>
          </>
        )}
        {step === 'review' && (
          <>
            <p className="auth-surface__copy">
              Chọn nhóm dữ liệu muốn nhập. Không có dữ liệu nào bị ghi đè âm
              thầm.
            </p>
            <label className="account-toggle">
              <span>
                <strong>{snapshot.tracks.length} bài hát</strong>
                <small>Liên kết bài hát vào thư viện</small>
              </span>
              <input
                type="checkbox"
                checked={selection.tracks}
                onChange={(e) =>
                  setSelection({ ...selection, tracks: e.target.checked })
                }
              />
            </label>
            <label className="account-toggle">
              <span>
                <strong>{snapshot.playlists.length} danh sách phát</strong>
                <small>Tên trùng sẽ được thêm hậu tố rõ ràng</small>
              </span>
              <input
                type="checkbox"
                checked={selection.playlists}
                onChange={(e) =>
                  setSelection({ ...selection, playlists: e.target.checked })
                }
              />
            </label>
            {previewData?.conflicts?.length ? (
              <p className="auth-error" role="status">
                Có {previewData.conflicts.length} mục trùng. TikPlay sẽ giữ dữ
                liệu hiện có và đổi tên mục nhập khi cần.
              </p>
            ) : null}
            <div className="guest-import__actions">
              <button
                className="account-primary"
                type="button"
                onClick={() => void commit()}
              >
                Nhập dữ liệu
              </button>
              <button
                className="account-secondary"
                type="button"
                onClick={() => {
                  setPreviewData(null);
                  setStep('offer');
                }}
              >
                Quay lại
              </button>
            </div>
          </>
        )}
        {step === 'progress' && (
          <div className="auth-sent" role="status">
            <span className="auth-sent__icon">↗</span>
            <h3>Đang nhập an toàn…</h3>
            <p>
              Giữ cửa sổ này mở trong giây lát. Thử lại sẽ không tạo bản sao.
            </p>
          </div>
        )}
        {step === 'result' && (
          <div className="auth-sent" role="status">
            <span className="auth-sent__icon">✓</span>
            <h3>Đã hoàn tất</h3>
            <p>
              Đã nhập {result?.imported ?? 0} mục, bỏ qua {result?.skipped ?? 0}{' '}
              mục và đổi tên {result?.renamed ?? 0} danh sách khi cần.
            </p>
            <button type="button" onClick={onClose}>
              Tiếp tục nghe
            </button>
          </div>
        )}
        {status && (
          <p className="auth-error" role="alert">
            {status}
          </p>
        )}
      </section>
    </div>
  );
}
