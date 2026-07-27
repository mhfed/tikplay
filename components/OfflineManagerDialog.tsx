'use client';

import { useState } from 'react';
import { DialogOverlay } from './DialogOverlay';
import { useOffline } from '@/hooks/useOffline';
import { CloseIcon, SearchIcon, TrashIcon, HardDriveIcon, WifiIcon, WifiOffIcon } from './icons';

interface OfflineManagerDialogProps {
  onClose: () => void;
}

export default function OfflineManagerDialog({ onClose }: OfflineManagerDialogProps) {
  const [search, setSearch] = useState('');
  const { 
    downloadedTracks, 
    removeTrack, 
    removeAll, 
    storageInfo, 
    isOnline, 
    isSupported 
  } = useOffline();

  if (!isSupported) {
    return (
      <DialogOverlay onClose={onClose} closeOnBackdropClick>
        <div className="flex w-[90vw] max-w-[400px] flex-col rounded-panel border border-line bg-elevated shadow-lg p-6">
          <h2 className="text-xl font-bold mb-4">Lỗi trình duyệt</h2>
          <p className="text-ink-secondary mb-6">
            Trình duyệt của bạn hiện không hỗ trợ chức năng tải nhạc offline (OPFS).
            Vui lòng thử lại trên Chrome, Safari, hoặc Edge phiên bản mới nhất.
          </p>
          <button
            type="button"
            className="rounded bg-accent px-4 py-2 text-black font-medium"
            onClick={onClose}
          >
            Đóng
          </button>
        </div>
      </DialogOverlay>
    );
  }

  const tracks = Array.from(downloadedTracks.values())
    .map(t => t.meta)
    .sort((a, b) => b.downloadedAt - a.downloadedAt);

  const filteredTracks = tracks.filter(t => 
    t.title.toLowerCase().includes(search.toLowerCase()) || 
    (t.author || '').toLowerCase().includes(search.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const usagePercent = storageInfo?.percentUsed || 0;

  return (
    <DialogOverlay onClose={onClose} closeOnBackdropClick>
      <div 
        className="flex w-[90vw] max-w-[600px] max-h-[85vh] flex-col rounded-panel border border-line bg-elevated shadow-lg [animation:modal-panel-in_var(--motion-base)_var(--ease-spring)]"
        role="dialog"
      >
        <header className="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 className="text-lg font-display font-bold">Quản lý nhạc Offline</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-ink-secondary hover:bg-white/10 hover:text-white"
          >
            <CloseIcon size={20} />
          </button>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col p-5 gap-5">
          {/* Storage Info Card */}
          <div className="rounded-lg border border-line bg-surface p-4">
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center gap-2 text-sm text-ink-secondary">
                <HardDriveIcon size={16} />
                <span>
                  Đã dùng {storageInfo ? storageInfo.usageFormatted : '...'} / {storageInfo ? storageInfo.quotaFormatted : '...'} ({usagePercent}%)
                </span>
              </div>
              
              {storageInfo?.isPersistent ? (
                <span className="text-[10px] uppercase font-bold text-emerald-400 bg-emerald-900/30 px-2 py-1 rounded border border-emerald-800">
                  Lưu trữ vĩnh viễn
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold text-amber-400 bg-amber-900/30 px-2 py-1 rounded border border-amber-800">
                  Lưu trữ tạm
                </span>
              )}
            </div>
            
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden mb-3">
              <div 
                className="h-full bg-accent transition-all duration-300" 
                style={{ width: `${Math.min(usagePercent, 100)}%` }}
              />
            </div>
            
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn xóa tất cả nhạc đã tải?')) {
                    removeAll();
                  }
                }}
                className="text-xs text-red-500 hover:text-red-400 flex items-center gap-1"
                disabled={tracks.length === 0}
              >
                <TrashIcon size={12} /> Xóa tất cả
              </button>
            </div>
          </div>

          {/* Network State */}
          <div className="flex items-center gap-2 text-sm bg-black/20 rounded p-2 border border-line-soft">
            {isOnline ? (
              <><WifiIcon size={16} className="text-emerald-400" /> <span className="text-emerald-400">Đang online</span></>
            ) : (
              <><WifiOffIcon size={16} className="text-red-400" /> <span className="text-red-400">Đang offline</span></>
            )}
            <span className="text-ink-secondary ml-auto">
              {tracks.length} bài đã tải
            </span>
          </div>

          {/* Search */}
          <div className="relative">
            <SearchIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-secondary" />
            <input
              type="text"
              placeholder="Tìm bài hát..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full rounded bg-white/5 pl-9 pr-4 py-2 text-sm text-white placeholder:text-ink-muted border border-line-soft focus:border-accent focus:outline-none transition-colors"
            />
          </div>

          {/* Track List */}
          <div className="flex-1 overflow-y-auto -mx-2 px-2 custom-scrollbar space-y-1">
            {filteredTracks.length === 0 ? (
              <div className="text-center text-ink-secondary py-8">
                {search ? 'Không tìm thấy bài nào.' : 'Chưa có bài hát nào được tải.'}
              </div>
            ) : (
              filteredTracks.map(track => (
                <div key={track.trackId} className="flex items-center gap-3 p-2 rounded hover:bg-white/5 group">
                  <div className="w-10 h-10 shrink-0 bg-white/10 rounded overflow-hidden">
                    {track.cover && (
                      <img src={track.cover} alt="" className="w-full h-full object-cover" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate text-ink">{track.title}</div>
                    <div className="text-xs text-ink-secondary truncate">{track.author} • {formatSize(track.fileSize)}</div>
                  </div>
                  
                  <button
                    type="button"
                    onClick={() => removeTrack(track.trackId)}
                    className="p-2 opacity-0 group-hover:opacity-100 text-ink-secondary hover:text-red-400 transition-all focus:opacity-100"
                    title="Xóa khỏi bộ nhớ"
                  >
                    <TrashIcon size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </DialogOverlay>
  );
}
