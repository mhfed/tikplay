'use client';

import { useOffline } from '@/hooks/useOffline';
import { Track } from '@/lib/types';
import {
  DownloadIcon,
  CheckCircleIcon,
  SpinnerIcon,
  ShieldAlertIcon, // for error
} from './icons';

interface OfflineBadgeProps {
  track: Track;
  className?: string;
  size?: number;
}

export default function OfflineBadge({
  track,
  className = '',
  size = 16,
}: OfflineBadgeProps) {
  const { downloadedTracks, downloadTrack, isSupported } = useOffline();

  if (!isSupported) return null;

  const downloadState = downloadedTracks.get(track.id);

  if (!downloadState) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          downloadTrack(track).catch(() => {});
        }}
        className={`text-zinc-500 hover:text-white transition-colors ${className}`}
        title="Tải xuống để nghe offline"
      >
        <DownloadIcon size={size} />
      </button>
    );
  }

  if (downloadState.isDownloading) {
    const percent = Math.round(downloadState.progress * 100);
    return (
      <div
        className={`flex items-center gap-1 text-blue-400 ${className}`}
        title={`Đang tải... ${percent}%`}
      >
        <SpinnerIcon size={size} className="animate-spin" />
        <span className="text-[10px] w-5 text-right">{percent}%</span>
      </div>
    );
  }

  if (downloadState.error) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
          downloadTrack(track).catch(() => {});
        }}
        className={`text-red-400 hover:text-red-300 transition-colors ${className}`}
        title={`Lỗi: ${downloadState.error} — Nhấp để thử lại`}
      >
        <ShieldAlertIcon size={size} />
      </button>
    );
  }

  return (
    <div className={`text-emerald-400 ${className}`} title="Đã tải offline">
      <CheckCircleIcon size={size} />
    </div>
  );
}
