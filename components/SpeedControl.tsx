'use client';

interface SpeedControlProps {
  speed: number;
  onChange: (speed: number) => void;
}

const PRESETS = [0.75, 1.0, 1.25, 1.5, 2.0];

export default function SpeedControl({ speed, onChange }: SpeedControlProps) {
  return (
    <div>
      <div className="flex w-full items-center gap-2.5">
        <span className="whitespace-nowrap text-xs font-semibold text-muted">
          Tốc độ
        </span>
        <input
          type="range"
          className="flex-1"
          min={0.5}
          max={2}
          step={0.05}
          value={speed}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Tốc độ phát"
        />
        <span className="min-w-9 text-center text-[13px] font-bold text-accent tabular-nums">
          {speed.toFixed(2)}x
        </span>
      </div>
      <div className="mt-1.5 flex gap-1">
        {PRESETS.map((p) => (
          <button
            type="button"
            key={p}
            className={`cursor-pointer rounded-compact border border-line bg-surface px-2 py-[3px] text-[11px] font-semibold text-muted transition-[color,background,border-color,transform] duration-[var(--motion-fast)] ease-spring hover:-translate-y-px hover:border-accent hover:bg-accent-muted hover:text-accent${Math.abs(speed - p) < 0.01 ? ' -translate-y-px border-accent bg-accent-muted text-accent' : ''}`}
            onClick={() => onChange(p)}
          >
            {p}x
          </button>
        ))}
      </div>
    </div>
  );
}
