import { motion, useReducedMotion } from 'framer-motion';
import { CHART, STAGGER, TRANSITION } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';
import type { CalibrationPoint } from '@/components/platform/derivedMetrics';

/**
 * Reliability / calibration diagram for a forecaster's own quantile reports.
 *
 * Plots empirical coverage (y) against nominal quantile level τ (x). The 45°
 * diagonal is perfect calibration: coverage_i(τ_k) = τ_k for all k (Gneiting,
 * Balabdaoui & Raftery 2007). Points above the diagonal = the forecaster's
 * quantiles are too high (over-covering); below = too low. The diagonal is the
 * reference, the marker series is the empirical coverage from
 * `calibrationCurve`.
 *
 * On mount the empirical coverage line draws on left-to-right and each marker
 * settles in just behind it, so the curve's distance from the diagonal reads as
 * it appears. The static reference (frame, diagonal, axes) is drawn at once.
 * Under `prefers-reduced-motion` the line and markers render at final state.
 */
export interface ReliabilityDiagramProps {
  points: CalibrationPoint[];
  height?: number;
  accent?: string;
  ariaLabel?: string;
  className?: string;
  'data-testid'?: string;
}

const VIEW = 420;
const MARGIN = { top: 24, right: 24, bottom: 48, left: 52 };

export default function ReliabilityDiagram({
  points,
  height = CHART.minHeight.md,
  accent = SEM.skill.main,
  ariaLabel = 'Calibration reliability diagram',
  className = '',
  'data-testid': testId,
}: ReliabilityDiagramProps) {
  const reduce = useReducedMotion();
  const size = Math.min(VIEW, height);
  const plotW = VIEW - MARGIN.left - MARGIN.right;
  const plotH = size - MARGIN.top - MARGIN.bottom;
  const x = (v: number) => MARGIN.left + v * plotW;
  const y = (v: number) => MARGIN.top + (1 - v) * plotH;

  const linePath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.tau).toFixed(1)} ${y(p.coverage).toFixed(1)}`)
    .join(' ');

  return (
    <svg
      viewBox={`0 0 ${VIEW} ${size}`}
      role="img"
      aria-label={ariaLabel}
      data-testid={testId ?? 'reliability-diagram'}
      className={className}
      style={{ width: '100%', maxWidth: VIEW, height: 'auto', display: 'block' }}
    >
      <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="var(--paper)" stroke="var(--border)" strokeWidth={1} />

      {/* 45-degree perfect-calibration diagonal */}
      <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-faint)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={x(0.72)} y={y(0.78)} fontSize={CHART.axisLabel} fill="var(--ink-faint)" fontFamily="var(--font-sans)">
        perfect
      </text>

      {/* Axis ticks */}
      {[0, 0.5, 1].map((t) => (
        <g key={t}>
          <text x={x(t)} y={MARGIN.top + plotH + 20} textAnchor="middle" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-mono)">{t.toFixed(1)}</text>
          <text x={MARGIN.left - 8} y={y(t) + 4} textAnchor="end" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-mono)">{t.toFixed(1)}</text>
        </g>
      ))}

      {/* Empirical coverage line + markers: the line draws on, the markers
          settle in just behind it. Instant under reduce-motion. */}
      <motion.path
        d={linePath}
        fill="none"
        stroke={accent}
        strokeWidth={CHART.strokeWidth.emphasis}
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={reduce ? { duration: 0 } : TRANSITION.draw}
      />
      {points.map((p, i) => (
        <motion.circle
          key={p.tau}
          cx={x(p.tau)}
          cy={y(p.coverage)}
          r={4}
          fill={accent}
          data-testid={`reliability-point-${p.tau}`}
          initial={reduce ? false : { opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={reduce ? { duration: 0 } : { ...TRANSITION.micro, delay: (i * STAGGER.item) / 1000 }}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        />
      ))}

      {/* Axis labels */}
      <text x={MARGIN.left + plotW / 2} y={size - 10} textAnchor="middle" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-sans)" fontWeight={500}>
        nominal quantile level τ
      </text>
      <text x={14} y={MARGIN.top + plotH / 2} textAnchor="middle" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-sans)" fontWeight={500} transform={`rotate(-90, 14, ${MARGIN.top + plotH / 2})`}>
        empirical coverage
      </text>
    </svg>
  );
}
