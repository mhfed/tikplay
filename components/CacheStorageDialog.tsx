'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePlayback } from '@/hooks/usePlayback';
import Cover from './Cover';
import { DialogOverlay } from './DialogOverlay';
import {
  CheckCircleIcon,
  CloseIcon,
  HardDriveIcon,
  ShieldAlertIcon,
  SpinnerIcon,
  TrashIcon,
} from './icons';

interface EvictionCandidate {
  trackId: number;
  audioKey: string;
  title: string;
  author: string;
  cover: string;
  size: number;
  mtimeMs: number;
}

interface CacheStatus {
  cacheBytes: number;
  limitBytes: number;
  remainingBytes: number;
  freeBytes: number | null;
  minFreeBytes: number;
  isOverLimit: boolean;
  isLowDisk: boolean;
  safeCleanupBytes: number;
  safeCleanupFiles: number;
  orphanedEntries: number;
  evictionCandidates: EvictionCandidate[];
}

interface CacheResponse {
  ok: boolean;
  cacheMaxGb: number;
  savedCacheMaxGb: number | null;
  status: CacheStatus;
  removedFiles?: number;
  freedBytes?: number;
  error?: string;
}

interface CacheStorageDialogProps {
  onClose: () => void;
}

function formatBytes(bytes: number | null): string {
  if (bytes === null) return 'Không xác định';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(
    Math.floor(Math.log(Math.abs(bytes)) / Math.log(1024)),
    units.length - 1,
  );
  return `${Number((bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1))} ${units[index]}`;
}

function formatRelativeAge(mtimeMs: number): string {
  const minutes = Math.max(0, Math.floor((Date.now() - mtimeMs) / 60_000));
  if (minutes < 1) return 'vừa cập nhật';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

function errorMessage(response: Response, body: CacheResponse): string {
  if (body.error) return body.error;
  if (response.status >= 500) return 'Không thể xử lý cache lúc này.';
  return 'Không thể cập nhật thông tin cache.';
}

export default function CacheStorageDialog({
  onClose,
}: CacheStorageDialogProps) {
  const { currentTrack, queue } = usePlayback();
  const [data, setData] = useState<CacheResponse | null>(null);
  const [limitInput, setLimitInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const protectedTrackIds = useMemo(
    () =>
      Array.from(
        new Set(
          [currentTrack?.id, ...queue.map((track) => track.id)].filter(
            (id): id is number =>
              typeof id === 'number' && Number.isInteger(id) && id > 0,
          ),
        ),
      ),
    [currentTrack?.id, queue],
  );
  const protectedQuery = protectedTrackIds.join(',');

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      if (mountedRef.current) setLoading(true);
      try {
        const response = await fetch(
          `/api/cache${protectedQuery ? `?protectedTrackIds=${protectedQuery}` : ''}`,
          { cache: 'no-store', signal },
        );
        const body = (await response.json()) as CacheResponse;
        if (!response.ok || !body.ok) {
          throw new Error(errorMessage(response, body));
        }
        if (!mountedRef.current) return;
        setData(body);
        setLimitInput(String(body.cacheMaxGb));
        setError(null);
      } catch (err) {
        if ((err as Error).name === 'AbortError' || !mountedRef.current) return;
        setError((err as Error).message || 'Không thể đọc thông tin cache.');
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    },
    [protectedQuery],
  );

  useEffect(() => {
    mountedRef.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => {
      mountedRef.current = false;
      controller.abort();
    };
  }, [refresh]);

  const saveLimit = async () => {
    const value = Number(limitInput);
    if (!Number.isFinite(value) || value <= 0) {
      setInputError('Giới hạn cache phải lớn hơn 0 GB');
      return;
    }

    setSaving(true);
    setInputError(null);
    setNotice(null);
    try {
      const response = await fetch('/api/cache', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheMaxGb: value }),
      });
      const body = (await response.json()) as CacheResponse;
      if (!response.ok || !body.ok) {
        throw new Error(errorMessage(response, body));
      }
      if (!mountedRef.current) return;
      setData(body);
      setLimitInput(String(body.cacheMaxGb));
      setNotice('Đã lưu giới hạn cache.');
      setError(null);
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message || 'Không thể lưu giới hạn cache.');
      }
    } finally {
      if (mountedRef.current) setSaving(false);
    }
  };

  const cleanNow = async () => {
    setCleaning(true);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/cache${protectedQuery ? `?protectedTrackIds=${protectedQuery}` : ''}`,
        { method: 'POST' },
      );
      const body = (await response.json()) as CacheResponse;
      if (!response.ok || !body.ok) {
        throw new Error(errorMessage(response, body));
      }
      if (!mountedRef.current) return;
      setData(body);
      setLimitInput(String(body.cacheMaxGb));
      setNotice(
        `Đã giải phóng ${formatBytes(body.freedBytes ?? 0)} từ ${body.removedFiles ?? 0} file.`,
      );
      setError(null);
    } catch (err) {
      if (mountedRef.current) {
        setError((err as Error).message || 'Không thể dọn cache.');
      }
    } finally {
      if (mountedRef.current) setCleaning(false);
    }
  };

  const status = data?.status;
  const usagePercent = status
    ? Math.min(100, (status.cacheBytes / Math.max(status.limitBytes, 1)) * 100)
    : 0;
  const hasWarning = Boolean(status?.isOverLimit || status?.isLowDisk);

  return (
    <DialogOverlay onClose={onClose} closeOnBackdropClick>
      <section
        className="flex max-h-[min(760px,calc(100dvh-2rem))] w-[min(94vw,680px)] flex-col overflow-hidden rounded-panel border border-line bg-elevated shadow-lg [animation:modal-panel-in_var(--motion-base)_var(--ease-spring)] max-[640px]:max-h-[calc(100dvh-1rem)] max-[640px]:w-[calc(100vw-1rem)]"
        role="dialog"
        aria-modal="true"
        aria-label="Dung lượng cache"
      >
        <header className="flex shrink-0 items-start justify-between border-b border-line px-5 py-4 max-[640px]:px-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-compact bg-accent-muted text-accent">
              <HardDriveIcon size={18} />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-ink">
                Dung lượng cache
              </h2>
              <p className="mt-0.5 text-xs text-muted">
                Bộ nhớ media trên máy chủ TikPlay, không phải bộ nhớ offline của
                trình duyệt.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-control border-0 bg-transparent p-1.5 text-muted transition-colors hover:bg-surface hover:text-ink"
            aria-label="Đóng"
            title="Đóng"
          >
            <CloseIcon size={19} />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 max-[640px]:p-4">
          {error && (
            <div
              className="flex items-start gap-2 rounded-control border border-red-400/30 bg-red-400/10 px-3 py-2.5 text-sm text-red-200"
              role="alert"
            >
              <ShieldAlertIcon size={16} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div
              className="flex items-start gap-2 rounded-control border border-accent/30 bg-accent-muted px-3 py-2.5 text-sm text-accent"
              aria-live="polite"
            >
              <CheckCircleIcon size={16} className="mt-0.5 shrink-0" />
              <span>{notice}</span>
            </div>
          )}

          {loading && !status ? (
            <div className="grid gap-3 sm:grid-cols-3" aria-busy="true">
              {[
                'Đang đọc cache',
                'Đang tính giới hạn',
                'Đang kiểm tra ổ đĩa',
              ].map((label) => (
                <div
                  key={label}
                  className="h-[92px] animate-pulse rounded-control border border-line-soft bg-surface"
                  role="status"
                  aria-label={label}
                />
              ))}
            </div>
          ) : status ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-control border border-line-soft bg-surface p-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                    Đang dùng
                  </div>
                  <div className="mt-1.5 font-display text-xl font-bold text-ink">
                    {formatBytes(status.cacheBytes)}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    / {formatBytes(status.limitBytes)}
                  </div>
                </div>
                <div className="rounded-control border border-line-soft bg-surface p-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                    Còn theo giới hạn
                  </div>
                  <div className="mt-1.5 font-display text-xl font-bold text-accent">
                    {formatBytes(status.remainingBytes)}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    sẽ dùng cho media mới
                  </div>
                </div>
                <div className="rounded-control border border-line-soft bg-surface p-3.5">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-2">
                    Ổ đĩa còn trống
                  </div>
                  <div className="mt-1.5 font-display text-xl font-bold text-ink">
                    {formatBytes(status.freeBytes)}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    dự trữ tối thiểu {formatBytes(status.minFreeBytes)}
                  </div>
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-3 text-xs text-muted">
                  <span>Mức dùng cache</span>
                  <span className="tabular-nums">
                    {Math.round(usagePercent)}%
                  </span>
                </div>
                <div
                  className="h-2.5 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-label="Mức sử dụng cache"
                  aria-valuemin={0}
                  aria-valuemax={status.limitBytes}
                  aria-valuenow={Math.min(status.cacheBytes, status.limitBytes)}
                >
                  <div
                    className={`h-full rounded-full transition-[width,background-color] duration-300 ${hasWarning ? 'bg-amber-400' : 'bg-accent'}`}
                    style={{ width: `${usagePercent}%` }}
                  />
                </div>
              </div>

              {hasWarning && (
                <div className="flex items-start gap-2 rounded-control border border-amber-400/30 bg-amber-400/10 px-3 py-2.5 text-sm text-amber-100">
                  <ShieldAlertIcon
                    size={16}
                    className="mt-0.5 shrink-0 text-amber-300"
                  />
                  <p>
                    {status.isOverLimit
                      ? 'Cache đang vượt giới hạn. Bài cũ chỉ được tự dọn khi cần tạo chỗ trống.'
                      : 'Ổ đĩa đang gần mức dự trữ tối thiểu. Hãy cân nhắc dọn file rác trước khi tải thêm.'}
                  </p>
                </div>
              )}

              <section className="rounded-control border border-line-soft bg-surface p-4">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Giới hạn cache
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Áp dụng cho các lần bảo trì cache trước và sau khi tải bài
                      mới.
                    </p>
                  </div>
                  <div className="flex items-end gap-2">
                    <label htmlFor="cache-limit-gb" className="sr-only">
                      Giới hạn cache (GB)
                    </label>
                    <div>
                      <input
                        id="cache-limit-gb"
                        type="number"
                        min="0.1"
                        step="0.1"
                        value={limitInput}
                        onChange={(event) => {
                          setLimitInput(event.target.value);
                          setInputError(null);
                        }}
                        className="w-28 rounded-control border border-line bg-elevated px-3 py-2 text-right text-sm text-ink outline-none transition-colors focus:border-accent"
                        aria-invalid={Boolean(inputError)}
                        aria-describedby={
                          inputError ? 'cache-limit-error' : undefined
                        }
                      />
                      <span className="ml-2 text-sm text-muted">GB</span>
                    </div>
                    <button
                      type="button"
                      className="rounded-control border border-accent/40 bg-accent-muted px-3 py-2 text-xs font-bold text-accent transition-colors hover:bg-accent/20 disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => void saveLimit()}
                      disabled={saving || loading || !limitInput}
                    >
                      {saving ? 'Đang lưu…' : 'Lưu giới hạn'}
                    </button>
                  </div>
                </div>
                {inputError && (
                  <p
                    id="cache-limit-error"
                    className="mt-2 text-xs text-red-300"
                  >
                    {inputError}
                  </p>
                )}
              </section>

              <section>
                <div className="mb-2 flex items-end justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-ink">
                      Bài có thể bị dọn tiếp theo
                    </h3>
                    <p className="mt-1 text-xs text-muted">
                      Chỉ là dự báo; tự dọn khi cache vượt giới hạn hoặc ổ đĩa
                      thiếu chỗ.
                    </p>
                  </div>
                  {status.orphanedEntries > 0 && (
                    <span className="text-right text-[11px] text-muted-2">
                      {status.orphanedEntries} file mồ côi sẽ được ưu tiên
                    </span>
                  )}
                </div>
                <div className="space-y-1 rounded-control border border-line-soft bg-surface p-1.5">
                  {status.evictionCandidates.length === 0 ? (
                    <p className="px-3 py-5 text-center text-sm text-muted">
                      Chưa có bài thư viện nào đủ điều kiện để đưa vào dự báo.
                    </p>
                  ) : (
                    status.evictionCandidates.slice(0, 8).map((candidate) => (
                      <div
                        key={candidate.trackId}
                        className="flex items-center gap-3 rounded-control px-2 py-2 transition-colors hover:bg-elevated"
                      >
                        <Cover
                          src={candidate.cover}
                          alt={candidate.title}
                          subtitle={candidate.author}
                          className="size-10 shrink-0"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-ink">
                            {candidate.title}
                          </div>
                          <div className="truncate text-xs text-muted">
                            {candidate.author || 'Không rõ tác giả'}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-[11px] text-muted-2">
                          <div>{formatBytes(candidate.size)}</div>
                          <div>{formatRelativeAge(candidate.mtimeMs)}</div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-line-soft bg-surface p-4">
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-ink">Dọn file rác</h3>
                  <p className="mt-1 max-w-[440px] text-xs leading-relaxed text-muted">
                    Xóa file tải dở, preview hết hạn và cache mồ côi. Không xóa
                    bài trong thư viện.
                  </p>
                  {status.safeCleanupFiles > 0 && (
                    <p className="mt-1.5 text-xs text-accent">
                      Có thể thu hồi khoảng{' '}
                      {formatBytes(status.safeCleanupBytes)} từ{' '}
                      {status.safeCleanupFiles} file.
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  className="inline-flex shrink-0 items-center gap-2 rounded-control border border-red-400/30 bg-red-400/10 px-3.5 py-2.5 text-sm font-bold text-red-200 transition-colors hover:bg-red-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                  onClick={() => void cleanNow()}
                  disabled={cleaning || loading}
                >
                  {cleaning ? (
                    <SpinnerIcon size={15} className="animate-spin" />
                  ) : (
                    <TrashIcon size={15} />
                  )}
                  {cleaning ? 'Đang dọn…' : 'Dọn ngay'}
                </button>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </DialogOverlay>
  );
}
