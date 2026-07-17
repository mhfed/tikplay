'use client';

import { useState, useEffect } from 'react';
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
    <div className="trimmer-panel">
      <div className="trimmer-header">
        <span className="trimmer-title">Cắt nhạc (Bỏ đoạn thừa)</span>
      </div>
      <div className="trimmer-controls">
        <label>
          Bắt đầu (s):
          <input 
            type="range" 
            min="0" 
            max={duration} 
            step="1" 
            value={startTime} 
            onChange={(e) => setStartTime(Math.min(Number(e.target.value), endTime - 1))} 
          />
          {startTime}s
        </label>
        <label>
          Kết thúc (s):
          <input 
            type="range" 
            min="0" 
            max={duration} 
            step="1" 
            value={endTime} 
            onChange={(e) => setEndTime(Math.max(Number(e.target.value), startTime + 1))} 
          />
          {endTime}s
        </label>
      </div>
      <div className="trimmer-actions">
        <button className="btn btn--outline" onClick={handleReset}>Reset</button>
        <button className="btn btn--primary" onClick={handleApply}>Áp dụng</button>
      </div>
    </div>
  );
}
