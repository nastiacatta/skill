import type { CSSProperties } from 'react';
import { PALETTE, AGENT_COLORS, CHART_AXIS, CHART_GRID, CHART_BORDER } from '@/lib/palette';

/**
 * Lab chart tokens — all anchored on the slide palette in
 * `@/lib/palette` so every chart in the app, the password-gated slide
 * deck, and every R/Python-generated PNG share the same colours.
 */
export const AGENT_PALETTE = [...AGENT_COLORS];

export const CHART_MARGIN = { top: 10, right: 28, bottom: 6, left: 8 };

/** Use when chart has X/Y axis labels so they are not clipped */
export const CHART_MARGIN_LABELED = { top: 20, right: 32, bottom: 36, left: 64 };

export const AXIS_TICK = { fontSize: 13, fill: PALETTE.charcoal };
export const AXIS_STROKE = CHART_AXIS;

/** Colour for secondary labels on axes and annotations (matches --ink-soft). */
export const AXIS_LABEL_FILL = PALETTE.slate;

/** Colour for reference lines, band fills, dividers (desaturated, high-contrast grey). */
export const REF_LINE_STROKE = PALETTE.slate;

/** Fill for drag-to-zoom / brush preview rectangles. */
export const REF_BAND_FILL = PALETTE.navy;

/** Diverging tokens for bar charts that encode direction. */
export const DIVERGING_GOOD = PALETTE.teal;
export const DIVERGING_BAD  = PALETTE.coral;

export const GRID_PROPS = {
  strokeDasharray: '3 3',
  stroke: CHART_GRID,
  strokeOpacity: 0.7,
} as const;

export const TOOLTIP_STYLE: CSSProperties = {
  borderRadius: 6,
  border: `1px solid ${CHART_BORDER}`,
  boxShadow: '0 12px 32px -8px rgba(15, 23, 42, 0.18), 0 4px 12px -4px rgba(15, 23, 42, 0.08)',
  fontSize: 13,
  padding: '10px 14px',
  background: 'rgba(255, 255, 255, 0.98)',
  backdropFilter: 'blur(10px)',
  lineHeight: 1.5,
  maxWidth: 340,
  wordBreak: 'break-word' as const,
};

export function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function agentName(i: number): string {
  return `F${i + 1}`;
}

export function fmt(v: number | null | undefined, d = 3): string {
  if (v == null || isNaN(v)) return '—';
  if (Math.abs(v) < 1e-10) return '0';
  return v.toFixed(d);
}

export function fmtPct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

export function downsample<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const result: T[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i % step === 0 || i === data.length - 1) result.push(data[i]);
  }
  return result;
}

/** @deprecated Brush controls are being removed from default chart views in favour of drag-to-zoom. */
export const BRUSH_PROPS = {
  height: 22,
  stroke: '#cbd5e1',
  fill: '#f8fafc',
  travellerWidth: 8,
} as const;

export function movingAvg(values: number[], window: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < values.length; i++) {
    const start = Math.max(0, i - window + 1);
    const slice = values.slice(start, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / slice.length);
  }
  return result;
}

export function gini(values: number[]): number {
  const sorted = values.filter((v) => v >= 0).slice().sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  const total = sorted.reduce((s, v) => s + v, 0);
  if (total <= 0) return 0;
  let w = 0;
  sorted.forEach((v, i) => { w += (i + 1) * v; });
  return (2 * w - (sorted.length + 1) * total) / (sorted.length * total);
}
