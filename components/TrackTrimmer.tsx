'use client';

import { useEffect, useState } from 'react';
import { useAppStore } from '../hooks/useAppStore';

export default function TrackTrimmer() {
  const { currentTrack, updateTrackTiming } = useAppStore();
  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(0);

  useEffect(() => {
    if (currentTrack) {
      setStartTime(currentTrack.startTime || 0);
      setEndTime(currentTrack.endTime || currentTrack.duration);
    }
  }, [currentTrack]);

  if (!currentTrack) return null;

  const duration = currentTrack.duration || 0;

  const handleApply = () => {
    updateTrackTiming(currentTrack.id, startTime, endTime);
  };

  const handleReset = () => {
    setStartTime(0);
    setEndTime(duration);
    updateTrackTiming(currentTrack.id, 0, duration);
  };

  return (
    <div className="mb-4 rounded-panel bg-surface p-4">
      <div className="mb-3 text-[13px] font-semibold text-ink">
        <span>Cắt nhạc (Bỏ đoạn thừa)</span>
      </div>
      <div>
        <label className="mb-2 flex items-center gap-3 text-xs text-ink-secondary">
          Bắt đầu (s):
          <input
            className="flex-1"
            type="range"
            min="0"
            max={duration}
            step="1"
            value={startTime}
            onChange={(e) =>
              setStartTime(Math.min(Number(e.target.value), endTime - 1))
            }
          />
          {startTime}s
        </label>
        <label className="mb-2 flex items-center gap-3 text-xs text-ink-secondary">
          Kết thúc (s):
          <input
            className="flex-1"
            type="range"
            min="0"
            max={duration}
            step="1"
            value={endTime}
            onChange={(e) =>
              setEndTime(Math.max(Number(e.target.value), startTime + 1))
            }
          />
          {endTime}s
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-control border border-line bg-surface-2 px-3 py-1.5 text-xs font-semibold text-ink transition-[background,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:border-accent hover:bg-surface-3 active:scale-[0.97]"
          onClick={handleReset}
        >
          Đặt lại
        </button>
        <button
          type="button"
          className="inline-flex cursor-pointer items-center justify-center rounded-control border border-transparent bg-linear-to-br from-accent to-tertiary px-3 py-1.5 text-xs font-bold text-[#00201e] shadow-[0_0_20px_var(--accent-glow)] transition-[filter,transform] duration-[var(--motion-fast)] ease-spring hover:brightness-110 active:scale-[0.97]"
          onClick={handleApply}
        >
          Áp dụng
        </button>
      </div>
    </div>
  );
}
