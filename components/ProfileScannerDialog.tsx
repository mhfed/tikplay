'use client';

import { useEffect, useRef, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';
import { useGlobalAudioEngine } from '../hooks/usePlayback';
import Cover from './Cover';
import { DialogOverlay } from './DialogOverlay';
import { CloseIcon, PauseIcon, PlayIcon, PlusIcon, SpinnerIcon } from './icons';

interface ProfileScannerDialogProps {
  url: string;
  onClose: () => void;
}

interface ProfileItem {
  id: string;
  url: string;
  title: string;
  author: string;
  duration: number;
  thumbnail: string;
  viewCount?: number;
}

export default function ProfileScannerDialog({
  url,
  onClose,
}: ProfileScannerDialogProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ProfileItem[]>([]);
  const [profile, setProfile] = useState<{
    username: string;
    url: string;
  } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Preview state
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [previewDuration, setPreviewDuration] = useState(0);
  const [previewCurrentTime, setPreviewCurrentTime] = useState(0);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Trimming state map: itemId -> { startTime, endTime }
  const [trims, setTrims] = useState<
    Record<string, { startTime: number; endTime: number }>
  >({});
  const trimsRef = useRef(trims);
  useEffect(() => {
    trimsRef.current = trims;
  }, [trims]);

  const { loadAll } = useAppStore();
  const globalAudio = useGlobalAudioEngine();
  const scanPromiseRef = useRef<Promise<{
    ok: boolean;
    data?: { items: ProfileItem[]; profile: { username: string; url: string; }; };
    error?: string;
  }> | null>(null);

  useEffect(() => {
    let mounted = true;
    const scan = async () => {
      try {
        if (!scanPromiseRef.current) {
          scanPromiseRef.current = fetch('/api/profile/scan', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url }),
          }).then((res) => res.json());
        }

        const data = await scanPromiseRef.current;

        if (!mounted) return;

        if (data.ok === false) {
          throw new Error(data.error || 'Lỗi quét profile');
        }

        // @ts-ignore
        setItems(data.data?.items || []);
        // @ts-ignore
        setProfile(data.data?.profile || null);
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    scan();

    return () => {
      mounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [url]);

  const toggleSelectAll = () => {
    if (selected.size === items.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(items.map((item) => item.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handlePreview = async (item: ProfileItem) => {
    // If it is already the active item, toggle playback status instead of reloading
    if (previewingId === item.id) {
      if (audioRef.current) {
        if (audioRef.current.paused) {
          audioRef.current.play().catch(console.error);
        } else {
          audioRef.current.pause();
        }
      }
      return;
    }

    setPreviewLoading(item.id);
    try {
      const res = await fetch('/api/profile/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.url }),
      });
      const data = await res.json();

      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Lỗi lấy preview');
      }

      if (audioRef.current) {
        audioRef.current.pause();
      }

      // Pause global main player to prevent overlaying sounds
      try {
        globalAudio.pause();
      } catch (e) {
        console.warn('Could not pause global audio', e);
      }

      const audio = new Audio(data.data.audioUrl);
      audioRef.current = audio;

      audio.onplay = () => setIsPreviewPlaying(true);
      audio.onpause = () => setIsPreviewPlaying(false);
      audio.onended = () => {
        setPreviewingId(null);
        setIsPreviewPlaying(false);
        setPreviewCurrentTime(0);
      };

      audio.onloadedmetadata = () => {
        setPreviewDuration(audio.duration);
        setPreviewCurrentTime(0);
      };

      audio.ontimeupdate = () => {
        setPreviewCurrentTime(audio.currentTime);
        const activeTrim = trimsRef.current[item.id] || {
          startTime: 0,
          endTime: item.duration || audio.duration || 60,
        };
        if (audio.currentTime >= activeTrim.endTime) {
          audio.currentTime = activeTrim.startTime;
        }
      };

      await audio.play();
      setPreviewingId(item.id);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setPreviewLoading(null);
    }
  };

  const handlePreviewSeek = (sec: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = sec;
      setPreviewCurrentTime(sec);
    }
  };

  const handleTogglePreviewPlay = () => {
    if (audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play().catch(console.error);
      } else {
        audioRef.current.pause();
      }
    }
  };

  const handleDownload = async () => {
    if (selected.size === 0 || downloading) return;

    setDownloading(true);
    setError(null);
    setDownloadProgress(0);

    try {
      // Chunk requests into batches of 20 URLs to respect rate limits / constraints
      const itemsToDownload = items
        .filter((i) => selected.has(i.id))
        .map((i) => {
          const trim = trims[i.id];
          return {
            url: i.url,
            startTime: trim ? trim.startTime : undefined,
            endTime: trim ? trim.endTime : undefined,
          };
        });
      const batchSize = 20;
      let completedCount = 0;

      for (let i = 0; i < itemsToDownload.length; i += batchSize) {
        const batch = itemsToDownload.slice(i, i + batchSize);

        const res = await fetch('/api/profile/download', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items: batch }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error || 'Lỗi tải một số bài');
        }

        completedCount += batch.length;
        setDownloadProgress(
          Math.floor((completedCount / itemsToDownload.length) * 100),
        );
      }

      // Reload library to show new tracks
      await loadAll();
      onClose();
    } catch (err) {
      setError((err as Error).message);
      setDownloading(false);
    }
  };

  const formatViewCount = (count?: number) => {
    if (!count) return '';
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M views`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K views`;
    return `${count} views`;
  };

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return '';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60)
      .toString()
      .padStart(2, '0');
    return `${m}:${s}`;
  };

  return (
    <DialogOverlay onClose={onClose} closeOnBackdropClick={false}>
      <div
        role="dialog"
        className="relative z-10 flex max-h-[85vh] w-[720px] max-w-[95vw] flex-col overflow-hidden rounded-[24px] bg-surface-2 border border-line-soft shadow-2xl max-[640px]:max-h-[90vh]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-line-soft p-5 max-[640px]:p-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-compact bg-accent/15 px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-accent border border-accent/20">
                TikTok Profile
              </span>
            </div>
            <h2 className="mt-1 font-display text-lg font-bold text-ink leading-tight">
              Quét Profile TikTok
            </h2>
            {profile && (
              <p className="mt-0.5 text-xs text-muted">@{profile.username}</p>
            )}
          </div>
          <button
            type="button"
            className="grid size-10 cursor-pointer place-items-center rounded-full bg-surface transition-colors hover:bg-line-soft max-[640px]:size-8"
            onClick={onClose}
            aria-label="Đóng"
          >
            <CloseIcon size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {loading ? (
            <div className="flex flex-1 flex-col p-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  // biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading uses array
                  key={i}
                  className="flex gap-4 p-3 rounded-[20px] border border-line-soft bg-surface/40 animate-pulse"
                >
                  <div className="w-[84px] h-[112px] rounded-[14px] bg-line-soft shrink-0" />
                  <div className="flex flex-col justify-center flex-1 space-y-3 py-1">
                    <div className="h-3.5 bg-line-soft rounded-full w-2/3" />
                    <div className="h-3 bg-line-soft/60 rounded-full w-1/3" />
                    <div className="mt-auto h-3 bg-line-soft/60 rounded-full w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center p-10 text-center text-danger">
              <p className="font-semibold">{error}</p>
              <button
                type="button"
                className="mt-4 rounded-full bg-surface px-5 py-2 text-sm font-bold shadow-app"
                onClick={onClose}
              >
                Đóng
              </button>
            </div>
          ) : (
            <>
              <div className="flex shrink-0 items-center justify-between border-b border-line-soft bg-surface px-5 py-3.5 max-[640px]:px-4 shadow-sm z-[2]">
                <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-ink select-none">
                  <input
                    type="checkbox"
                    checked={selected.size === items.length && items.length > 0}
                    onChange={toggleSelectAll}
                    disabled={downloading}
                    className="size-4 rounded text-accent border-line-soft focus:ring-accent focus:ring-offset-0 cursor-pointer accent-accent"
                  />
                  Chọn tất cả ({items.length})
                </label>
                <div className="text-xs font-semibold text-muted-2 bg-surface px-2.5 py-1 rounded-full border border-line-soft">
                  Đã chọn{' '}
                  <span className="text-accent font-bold">{selected.size}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                {items.map((item) => {
                  const isSelected = selected.has(item.id);
                  const isPlayingThis = previewingId === item.id;
                  const isLoadingThis = previewLoading === item.id;
                  const itemTrim = trims[item.id] || {
                    startTime: 0,
                    endTime: item.duration || previewDuration || 60,
                  };

                  return (
                    <div
                      key={item.id}
                      className={`group flex flex-col gap-2 rounded-control border border-transparent px-3 py-2.5 transition-all duration-200 hover:bg-surface-3 ${
                        isSelected
                          ? 'bg-accent-muted border-accent/20 shadow-[inset_0_0_0_1px_rgba(0,221,214,0.15)]'
                          : 'hover:border-line-soft'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(item.id)}
                          disabled={downloading}
                          className="size-4 rounded text-accent border-line-soft focus:ring-accent focus:ring-offset-0 shrink-0 cursor-pointer accent-accent"
                        />

                        <button
                          type="button"
                          className="group/btn relative size-11 shrink-0 overflow-hidden rounded-compact bg-surface shadow-md cursor-pointer"
                          onClick={() => handlePreview(item)}
                          disabled={downloading}
                          title="Nghe thử"
                        >
                          <Cover
                            src={item.thumbnail}
                            alt={item.title}
                            className="size-full rounded-compact object-cover transition-transform duration-[var(--motion-base)] ease-out-app group-hover/btn:scale-[1.06]"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover/btn:opacity-100">
                            {isLoadingThis ? (
                              <SpinnerIcon className="size-4 animate-spin text-white" />
                            ) : isPlayingThis && isPreviewPlaying ? (
                              <span
                                className="eq-dots !scale-75 text-accent"
                                aria-hidden
                              >
                                <span />
                                <span />
                                <span />
                              </span>
                            ) : (
                              <PlayIcon size={16} className="text-white" />
                            )}
                          </div>
                          {isPlayingThis &&
                            !isLoadingThis &&
                            isPreviewPlaying && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                                <span
                                  className="eq-dots !scale-75 text-accent"
                                  aria-hidden
                                >
                                  <span />
                                  <span />
                                  <span />
                                </span>
                              </div>
                            )}
                          {isLoadingThis && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                              <SpinnerIcon className="size-4 animate-spin text-accent" />
                            </div>
                          )}
                        </button>

                        <button
                          type="button"
                          className="min-w-0 flex-1 cursor-pointer border-0 bg-transparent text-left"
                          onClick={() => !downloading && toggleSelect(item.id)}
                        >
                          <p
                            className={`truncate text-sm font-semibold transition-colors ${
                              isSelected ? 'text-accent' : 'text-ink'
                            }`}
                          >
                            {item.title}
                          </p>
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted flex-wrap">
                            <span className="truncate max-w-[140px] font-medium">
                              {item.author}
                            </span>
                            {item.duration > 0 && (
                              <>
                                <span className="text-[10px] opacity-60">
                                  •
                                </span>
                                <span>{formatDuration(item.duration)}</span>
                              </>
                            )}
                            {item.viewCount !== undefined &&
                              item.viewCount > 0 && (
                                <>
                                  <span className="text-[10px] opacity-60">
                                    •
                                  </span>
                                  <span className="font-mono">
                                    {formatViewCount(item.viewCount)}
                                  </span>
                                </>
                              )}
                          </div>
                        </button>
                      </div>

                      {/* Preview & Trimmer controls (only visible if active previewing item) */}
                      {isPlayingThis && !isLoadingThis && (
                        <div className="ml-7 mt-1.5 space-y-3.5 rounded-xl bg-surface-2/40 border border-line-soft/40 p-3.5 transition-all duration-300">
                          {/* Audio scrubber & Play/Pause controls */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={handleTogglePreviewPlay}
                              className="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent/15 text-accent border border-accent/20 hover:bg-accent/25 active:scale-95 transition-all"
                              title={
                                isPreviewPlaying ? 'Tạm dừng' : 'Phát tiếp'
                              }
                            >
                              {isPreviewPlaying ? (
                                <PauseIcon
                                  size={12}
                                  className="fill-accent text-accent"
                                />
                              ) : (
                                <PlayIcon
                                  size={12}
                                  className="fill-accent text-accent ml-0.5"
                                />
                              )}
                            </button>

                            <span className="text-[10px] font-mono text-muted select-none w-7 text-right">
                              {formatDuration(previewCurrentTime)}
                            </span>
                            <input
                              type="range"
                              min={0}
                              max={previewDuration || item.duration || 60}
                              step={0.1}
                              value={previewCurrentTime}
                              onChange={(e) =>
                                handlePreviewSeek(Number(e.target.value))
                              }
                              className="flex-1 h-1 rounded bg-surface border-none accent-accent cursor-pointer"
                            />
                            <span className="text-[10px] font-mono text-muted select-none w-7 text-left">
                              {formatDuration(previewDuration || item.duration)}
                            </span>
                          </div>

                          {/* Trimmer controls */}
                          <div className="border-t border-line-soft/45 pt-3 space-y-2.5">
                            <div className="flex items-center justify-between text-xs font-semibold text-ink-secondary">
                              <span className="flex items-center gap-1.5 text-accent">
                                <svg
                                  className="size-3.5"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
                                  />
                                </svg>
                                Cắt đoạn tải về (Bỏ đoạn thừa)
                              </span>
                              {(itemTrim.startTime > 0 ||
                                itemTrim.endTime <
                                  (item.duration || previewDuration || 60)) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTrims((prev) => {
                                      const next = { ...prev };
                                      delete next[item.id];
                                      return next;
                                    });
                                  }}
                                  className="text-[10px] uppercase font-bold tracking-wider text-danger hover:underline cursor-pointer"
                                >
                                  Đặt lại
                                </button>
                              )}
                            </div>

                            <div className="space-y-2 text-xs">
                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-muted w-14 font-medium shrink-0">
                                  Bắt đầu:
                                </span>
                                <input
                                  type="range"
                                  min={0}
                                  max={item.duration || previewDuration || 60}
                                  step={1}
                                  value={itemTrim.startTime}
                                  onChange={(e) => {
                                    const newStart = Math.min(
                                      Number(e.target.value),
                                      itemTrim.endTime - 1,
                                    );
                                    setTrims((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        startTime: newStart,
                                        endTime: Math.max(
                                          itemTrim.endTime,
                                          newStart + 1,
                                        ),
                                      },
                                    }));
                                    if (audioRef.current) {
                                      audioRef.current.currentTime = newStart;
                                    }
                                  }}
                                  className="flex-1 h-1 rounded bg-surface border-none accent-accent cursor-pointer"
                                />
                                <span className="text-[11px] font-mono text-ink-secondary w-9 text-right font-semibold shrink-0">
                                  {formatDuration(itemTrim.startTime)}
                                </span>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-[11px] text-muted w-14 font-medium shrink-0">
                                  Kết thúc:
                                </span>
                                <input
                                  type="range"
                                  min={0}
                                  max={item.duration || previewDuration || 60}
                                  step={1}
                                  value={
                                    itemTrim.endTime === undefined
                                      ? item.duration || previewDuration || 60
                                      : itemTrim.endTime
                                  }
                                  onChange={(e) => {
                                    const newEnd = Math.max(
                                      Number(e.target.value),
                                      itemTrim.startTime + 1,
                                    );
                                    setTrims((prev) => ({
                                      ...prev,
                                      [item.id]: {
                                        startTime: itemTrim.startTime,
                                        endTime: newEnd,
                                      },
                                    }));
                                  }}
                                  className="flex-1 h-1 rounded bg-surface border-none accent-tertiary cursor-pointer"
                                />
                                <span className="text-[11px] font-mono text-ink-secondary w-9 text-right font-semibold shrink-0">
                                  {formatDuration(
                                    itemTrim.endTime === undefined
                                      ? item.duration || previewDuration || 60
                                      : itemTrim.endTime,
                                  )}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {!error && (
          <div className="relative border-t border-line bg-surface p-5 max-[640px]:p-4 z-[2]">
            {downloading && (
              <div className="absolute top-0 left-0 w-full h-[3px] bg-surface-3 overflow-hidden">
                <div
                  className="bg-accent h-full transition-all duration-300 ease-out shadow-[0_0_8px_var(--accent-glow)]"
                  style={{ width: `${downloadProgress}%` }}
                />
              </div>
            )}
            <div className="flex items-center justify-between gap-4 max-[640px]:flex-col max-[640px]:gap-3">
              <div className="text-sm min-w-0 flex-1">
                {downloading ? (
                  <div className="flex flex-col gap-1">
                    <span className="text-accent font-bold flex items-center gap-1.5">
                      <SpinnerIcon className="size-4 animate-spin" />
                      Đang xử lý tải về... ({downloadProgress}%)
                    </span>
                    <span className="text-xs text-muted truncate">
                      Vui lòng giữ cửa sổ mở cho đến khi hoàn thành
                    </span>
                  </div>
                ) : loading ? (
                  <span className="text-muted font-medium block leading-normal animate-pulse">
                    Đang tìm kiếm video và bài hát trên profile...
                  </span>
                ) : (
                  <span className="text-muted font-medium block leading-normal">
                    Chọn các bài hát mong muốn để thêm vào thư viện của bạn
                  </span>
                )}
              </div>
              <div className="flex gap-3 shrink-0 max-[640px]:w-full">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={downloading}
                  className="rounded-full px-5 py-2.5 text-sm font-bold hover:bg-surface-3 transition-colors max-[640px]:flex-1 cursor-pointer disabled:opacity-50"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  disabled={loading || selected.size === 0 || downloading}
                  className="flex items-center justify-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-bold text-[#00201e] shadow-[0_0_15px_var(--accent-glow)] transition-all hover:brightness-110 disabled:opacity-50 disabled:shadow-none max-[640px]:flex-1 cursor-pointer"
                >
                  {downloading ? (
                    <>
                      <SpinnerIcon className="size-4 animate-spin text-[#00201e]" />
                      Đang tải...
                    </>
                  ) : (
                    <>
                      <PlusIcon size={16} />
                      Tải về {selected.size} bài
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DialogOverlay>
  );
}
