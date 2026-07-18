'use client';

import { useEffect, useRef, useState } from 'react';
import { EQ_BANDS, EQ_PRESETS } from '../lib/types';

interface EqualizerProps {
  gains: number[];
  onGainChange: (index: number, value: number) => void;
  onPreset: (gains: number[]) => void;
}

export default function Equalizer({
  gains,
  onGainChange,
  onPreset,
}: EqualizerProps) {
  const [showPresets, setShowPresets] = useState(false);
  const [activePreset, setActivePreset] = useState('Bass Boost');
  const presetsRef = useRef<HTMLDivElement>(null);

  // Close the preset dropdown on any outside pointer-down (and on Escape).
  useEffect(() => {
    if (!showPresets) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        presetsRef.current &&
        !presetsRef.current.contains(e.target as Node)
      ) {
        setShowPresets(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowPresets(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKey);
    };
  }, [showPresets]);

  const handlePreset = (preset: (typeof EQ_PRESETS)[number]) => {
    onPreset(preset.gains);
    setActivePreset(preset.name);
    setShowPresets(false);
  };

  const formatHz = (hz: number) => {
    if (hz >= 1000) return `${hz / 1000}k`;
    return `${hz}`;
  };

  return (
    <div className="w-full">
      <div className="mb-3 flex items-center justify-between">
        <span className="font-display text-sm font-bold text-ink-secondary">
          Bộ cân bằng
        </span>
        <div className="relative" ref={presetsRef}>
          <button
            type="button"
            className="cursor-pointer rounded-compact border border-line bg-surface px-2.5 py-1 text-xs font-semibold text-muted transition-[border-color,color,transform] duration-[var(--motion-fast)] ease-spring hover:-translate-y-px hover:border-accent hover:text-ink-secondary"
            aria-haspopup="listbox"
            aria-expanded={showPresets}
            onClick={() => setShowPresets(!showPresets)}
          >
            {activePreset} ▾
          </button>
          {showPresets && (
            <div
              className="absolute top-full right-0 z-20 mt-1 min-w-[140px] rounded-control border border-line bg-surface p-1 shadow-app [animation:np-dropdown-in_var(--motion-fast)_var(--ease-out)]"
              role="listbox"
            >
              {EQ_PRESETS.map((p) => (
                <button
                  type="button"
                  key={p.name}
                  role="option"
                  aria-selected={p.name === activePreset}
                  className={`block w-full cursor-pointer rounded-compact border-0 bg-transparent px-3 py-[7px] text-left text-[13px] text-ink-secondary transition-[background,color,transform] duration-[var(--motion-fast)] ease-spring hover:translate-x-0.5 hover:bg-surface-2${p.name === activePreset ? ' font-semibold text-accent' : ''}`}
                  onClick={() => handlePreset(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-end justify-between gap-1 px-0.5 pt-2">
        {EQ_BANDS.map((freq, i) => (
          <div key={freq} className="flex flex-1 flex-col items-center gap-1.5">
            <span className="min-w-6 text-center text-[9px] text-muted tabular-nums">
              {gains[i] > 0 ? '+' : ''}
              {gains[i]}
            </span>
            <input
              type="range"
              className="eq__band-slider"
              min={-12}
              max={12}
              step={1}
              value={gains[i]}
              onChange={(e) => {
                onGainChange(i, Number(e.target.value));
                setActivePreset('Tùy chỉnh');
              }}
              aria-label={`${formatHz(freq)} Hz`}
            />
            <span className="text-[9px] text-muted-2 tabular-nums">
              {formatHz(freq)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
