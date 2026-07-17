'use client';

interface SpeedControlProps {
  speed: number;
  onChange: (speed: number) => void;
}

const PRESETS = [0.75, 1.0, 1.25, 1.5, 2.0];

export default function SpeedControl({ speed, onChange }: SpeedControlProps) {
  return (
    <div>
      <div className="speed">
        <span className="speed__label">Tốc độ</span>
        <input
          type="range"
          className="speed__slider"
          min={0.5}
          max={2}
          step={0.05}
          value={speed}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Tốc độ phát"
        />
        <span className="speed__value">{speed.toFixed(2)}x</span>
      </div>
      <div className="speed__presets">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p}
            className={`speed__preset${Math.abs(speed - p) < 0.01 ? ' is-active' : ''}`}
            onClick={() => onChange(p)}
          >
            {p}x
          </button>
        ))}
      </div>
    </div>
  );
}
