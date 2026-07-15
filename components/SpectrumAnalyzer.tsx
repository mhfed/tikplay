'use client';

import { useEffect, useRef } from 'react';

interface SpectrumAnalyzerProps {
  analyserRef: React.RefObject<AnalyserNode | null>;
  isPlaying: boolean;
  barCount?: number;
  className?: string;
}

// Only the lower FFT bins carry meaningful musical energy; an fftSize-256 FFT's
// top bins sit near zero, so mapping all 128 would waste half the width on flat
// bars. Cap the visualized range at the useful low/mid bins.
const USED_BINS = 96;

// Average the used bins down into `barCount` buckets, normalized to 0–1.
function sampleBars(freq: Uint8Array<ArrayBuffer>, barCount: number): number[] {
  const out = new Array<number>(barCount);
  const binsPerBar = USED_BINS / barCount;
  for (let i = 0; i < barCount; i++) {
    const start = Math.floor(i * binsPerBar);
    const end = Math.max(start + 1, Math.floor((i + 1) * binsPerBar));
    let sum = 0;
    let n = 0;
    for (let j = start; j < end && j < freq.length; j++) {
      sum += freq[j];
      n++;
    }
    out[i] = n > 0 ? sum / n / 255 : 0;
  }
  return out;
}

export default function SpectrumAnalyzer({
  analyserRef,
  isPlaying,
  barCount = 32,
  className,
}: SpectrumAnalyzerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Smoothed per-bar heights (0–1), kept across frames so bars ease toward the
  // target instead of snapping — and decay to zero when playback stops.
  const levelsRef = useRef<number[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let freq: Uint8Array<ArrayBuffer> | null = null;
    const levels = levelsRef.current;

    // Theme colors are static CSS vars — resolve once per (re)start.
    const styles = getComputedStyle(canvas);
    const cLow = styles.getPropertyValue('--accent').trim() || '#00ddd6';
    const cHigh = styles.getPropertyValue('--tertiary').trim() || '#7900fe';

    const draw = () => {
      raf = requestAnimationFrame(draw);

      // clientWidth is 0 when the canvas is display:none (the off-breakpoint
      // instance) — skip the read + paint but keep the loop cheap.
      const cssW = canvas.clientWidth;
      const cssH = canvas.clientHeight;
      if (!cssW || !cssH) return;

      // Keep the backing store at element size × DPR for crisp bars.
      const dpr = window.devicePixelRatio || 1;
      const w = Math.round(cssW * dpr);
      const h = Math.round(cssH * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
      }

      const analyser = analyserRef.current;
      let targets: number[];
      if (analyser && isPlaying) {
        if (!freq || freq.length !== analyser.frequencyBinCount) {
          freq = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(freq);
        targets = sampleBars(freq, barCount);
      } else {
        // No graph yet, or paused → fall to silence.
        targets = new Array<number>(barCount).fill(0);
      }

      ctx.clearRect(0, 0, w, h);

      const gap = Math.max(1, Math.round(w / barCount / 4));
      const barW = (w - gap * (barCount - 1)) / barCount;
      const midY = h / 2;

      // Vertical gradient so both mirrored halves brighten toward the center.
      const grad = ctx.createLinearGradient(0, 0, 0, h);
      grad.addColorStop(0, cHigh);
      grad.addColorStop(0.5, cLow);
      grad.addColorStop(1, cHigh);
      ctx.fillStyle = grad;

      ctx.beginPath();
      let anyVisible = false;
      for (let i = 0; i < barCount; i++) {
        const target = targets[i] ?? 0;
        const prev = levels[i] ?? 0;
        // Fast attack, slow release — lively but smooth.
        const next = target > prev ? prev + (target - prev) * 0.6 : prev * 0.82;
        levels[i] = next;
        if (next > 0.005) anyVisible = true;

        const halfH = Math.max(dpr, next * midY);
        const x = i * (barW + gap);
        const r = Math.min(barW / 2, halfH);
        // One rounded bar growing up and down from the center line.
        ctx.roundRect(x, midY - halfH, barW, halfH * 2, r);
      }
      ctx.fill();

      // At rest and paused → stop the loop to save battery. The effect restarts
      // it when isPlaying flips back on.
      if (!isPlaying && !anyVisible) cancelAnimationFrame(raf);
    };

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyserRef, isPlaying, barCount]);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}
