'use client';

import { useOffline } from '@/hooks/useOffline';
import { WifiIcon, WifiOffIcon, HardDriveIcon } from './icons';

interface OfflineIndicatorProps {
  onClick?: () => void;
  className?: string;
}

export default function OfflineIndicator({ onClick, className = '' }: OfflineIndicatorProps) {
  const { isOnline, downloadedTracks, isSupported, isInitialized } = useOffline();

  if (!isSupported || !isInitialized) return null;

  const count = downloadedTracks.size;

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
        isOnline 
          ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white' 
          : 'bg-emerald-900/50 text-emerald-400 hover:bg-emerald-900/70 border border-emerald-800'
      } ${className}`}
    >
      {isOnline ? (
        <>
          <HardDriveIcon size={14} />
          <span>Lưu trữ ({count})</span>
        </>
      ) : (
        <>
          <WifiOffIcon size={14} />
          <span>Offline ({count} bài)</span>
        </>
      )}
    </button>
  );
}
