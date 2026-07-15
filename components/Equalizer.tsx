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
    <div className="eq">
      <div className="eq__header">
        <span className="eq__title">Equalizer</span>
        <div className="eq__presets" ref={presetsRef}>
          <button
            className="eq__preset-btn"
            aria-haspopup="listbox"
            aria-expanded={showPresets}
            onClick={() => setShowPresets(!showPresets)}
          >
            {activePreset} ▾
          </button>
          {showPresets && (
            <div className="eq__preset-dropdown" role="listbox">
              {EQ_PRESETS.map((p) => (
                <button
                  key={p.name}
                  role="option"
                  aria-selected={p.name === activePreset}
                  className={`eq__preset-option${p.name === activePreset ? ' is-active' : ''}`}
                  onClick={() => handlePreset(p)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="eq__bands">
        {EQ_BANDS.map((freq, i) => (
          <div key={freq} className="eq__band">
            <span className="eq__band-value">
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
                setActivePreset('Custom');
              }}
              aria-label={`${formatHz(freq)} Hz`}
            />
            <span className="eq__band-label">{formatHz(freq)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
