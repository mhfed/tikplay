'use client';

import { useEffect, useState } from 'react';
import { CheckIcon, RefreshCwIcon, SpinnerIcon } from './icons';

interface CopyrightReport {
  id: number;
  source_url: string;
  track_title?: string;
  track_author?: string;
  reporter_name: string;
  reporter_email: string;
  rights_basis: string;
  details: string;
  status: 'pending' | 'actioned' | 'rejected';
  moderation_note?: string;
  created_at: number;
}

const TOKEN_KEY = 'tikplay:admin-token';

export default function CopyrightAdmin() {
  const [token, setToken] = useState('');
  const [reports, setReports] = useState<CopyrightReport[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);

  useEffect(() => {
    setToken(window.sessionStorage.getItem(TOKEN_KEY) || '');
  }, []);

  const loadReports = async (nextToken: string = token) => {
    if (!nextToken.trim()) {
      setMessage('Nhập ADMIN_TOKEN để tiếp tục.');
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/copyright-reports', {
        headers: { Authorization: `Bearer ${nextToken.trim()}` },
      });
      const result = (await response.json()) as {
        ok: boolean;
        reports?: CopyrightReport[];
        error?: string;
      };
      if (!response.ok || !result.ok) {
        throw new Error(result.error || 'Không thể tải báo cáo');
      }
      window.sessionStorage.setItem(TOKEN_KEY, nextToken.trim());
      setReports(result.reports || []);
    } catch (error) {
      setReports([]);
      setMessage((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const moderate = async (
    report: CopyrightReport,
    action: 'takedown' | 'rejected',
  ) => {
    const defaultNote =
      action === 'takedown'
        ? 'Gỡ theo báo cáo bản quyền đã xác minh'
        : 'Báo cáo chưa đủ căn cứ';
    const note = window.prompt('Ghi chú xử lý', defaultNote);
    if (note === null) return;

    setActiveId(report.id);
    setMessage(null);
    try {
      const response = await fetch('/api/admin/copyright-reports', {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: report.id, action, note }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        report?: CopyrightReport;
        error?: string;
      };
      if (!response.ok || !result.ok || !result.report) {
        throw new Error(result.error || 'Không thể xử lý báo cáo');
      }
      setReports((current) =>
        current.map((item) =>
          item.id === result.report!.id ? result.report! : item,
        ),
      );
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setActiveId(null);
    }
  };

  return (
    <div>
      <div className="mb-8 flex flex-col gap-3 border-b border-line pb-6 sm:flex-row">
        <input
          type="password"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') loadReports();
          }}
          className="min-h-11 flex-1 rounded-control border border-line bg-canvas px-3.5 text-sm text-ink outline-none focus:border-accent"
          placeholder="ADMIN_TOKEN"
          aria-label="Admin token"
        />
        <button
          type="button"
          onClick={() => loadReports()}
          disabled={loading}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-control bg-accent px-5 text-sm font-bold text-[#00201e] disabled:opacity-50"
        >
          {loading ? (
            <SpinnerIcon size={16} className="animate-spin" />
          ) : (
            <RefreshCwIcon size={16} />
          )}
          Tải báo cáo
        </button>
      </div>

      {message && (
        <p role="status" className="mb-6 text-sm text-[#ff9da9]">
          {message}
        </p>
      )}

      {!loading && reports.length === 0 && !message && (
        <p className="py-12 text-center text-sm text-muted">
          Chưa tải dữ liệu báo cáo.
        </p>
      )}

      <div className="space-y-4">
        {reports.map((report) => (
          <article
            key={report.id}
            className="rounded-panel border border-line bg-elevated p-5"
          >
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[11px] text-muted">
                  #{report.id} ·{' '}
                  {new Date(report.created_at).toLocaleString('vi-VN')}
                </p>
                <h2 className="mt-1 font-display text-base font-extrabold text-ink">
                  {report.track_title || 'Nội dung theo liên kết'}
                </h2>
                {report.track_author && (
                  <p className="text-sm text-muted">{report.track_author}</p>
                )}
              </div>
              <span
                className={`rounded-compact px-2 py-1 font-mono text-[10px] uppercase ${
                  report.status === 'pending'
                    ? 'bg-secondary-muted text-secondary'
                    : report.status === 'actioned'
                      ? 'bg-accent-muted text-accent'
                      : 'bg-surface-3 text-muted'
                }`}
              >
                {report.status}
              </span>
            </div>

            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-muted">Người báo cáo</dt>
                <dd className="text-ink-secondary">
                  {report.reporter_name} · {report.reporter_email}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted">Căn cứ</dt>
                <dd className="text-ink-secondary">{report.rights_basis}</dd>
              </div>
            </dl>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-ink-secondary">
              {report.details}
            </p>
            <a
              href={report.source_url}
              target="_blank"
              rel="noreferrer"
              className="mt-3 block break-all text-xs text-accent hover:underline"
            >
              {report.source_url}
            </a>

            {report.moderation_note && (
              <p className="mt-4 border-l-2 border-line pl-3 text-xs text-muted">
                {report.moderation_note}
              </p>
            )}

            {report.status === 'pending' && (
              <div className="mt-5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  disabled={activeId === report.id}
                  onClick={() => moderate(report, 'rejected')}
                  className="min-h-10 cursor-pointer rounded-control border border-line bg-surface-2 px-4 text-xs font-bold text-ink-secondary disabled:opacity-50"
                >
                  Từ chối
                </button>
                <button
                  type="button"
                  disabled={activeId === report.id}
                  onClick={() => moderate(report, 'takedown')}
                  className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-control bg-danger px-4 text-xs font-bold text-white disabled:opacity-50"
                >
                  {activeId === report.id ? (
                    <SpinnerIcon size={14} className="animate-spin" />
                  ) : (
                    <CheckIcon size={14} />
                  )}
                  Gỡ nội dung
                </button>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
