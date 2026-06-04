import { TYPE } from '@/components/platform/designTokens';

/**
 * Tiny length/position trend (profit history, σ trajectory). Position-encoded
 * line; never a dial or pie (Cleveland & McGill 1984; Tufte sparkline). A
 * baseline at zero is drawn when the series crosses zero so a signed profit
 * series reads correctly.
 */
export interface SparklineProps {
  data: number[];
  colour?: string;
  height?: number;
  width?: number;
  ariaLabel: string;
  /** Draw a zero baseline (for signed series). */
  zeroBaseline?: boolean;
  className?: string;
}

export default function Sparkline({
  data,
  colour = 'var(--ink-soft)',
  height = 40,
  width = 140,
  ariaLabel,
  zeroBaseline = false,
  className = '',
}: SparklineProps) {
  if (data.length === 0) {
    return <svg width={width} height={height} role="img" aria-label={ariaLabel} className={className} />;
  }
  const lo = Math.min(...data, zeroBaseline ? 0 : Infinity);
  const hi = Math.max(...data, zeroBaseline ? 0 : -Infinity);
  const range = hi - lo || 1;
  const pad = 2;
  const x = (i: number) => (data.length === 1 ? width / 2 : pad + (i / (data.length - 1)) * (width - 2 * pad));
  const y = (v: number) => pad + (1 - (v - lo) / range) * (height - 2 * pad);
  const path = data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className={className}
      style={{ display: 'block', overflow: 'visible', fontSize: TYPE.label.size }}
    >
      {zeroBaseline && lo < 0 && hi > 0 && (
        <line x1={pad} x2={width - pad} y1={y(0)} y2={y(0)} stroke="var(--border-strong)" strokeWidth={1} strokeDasharray="2 2" />
      )}
      <path d={path} fill="none" stroke={colour} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(data.length - 1)} cy={y(data[data.length - 1])} r={2.5} fill={colour} />
    </svg>
  );
}
