import { motion, useReducedMotion } from 'framer-motion';
import { CHART, STAGGER, TRANSITION } from '@/components/platform/designTokens';

/**
 * Multi-series line chart for bankroll-over-rounds and skill-σ-over-rounds.
 * Length/position encoding only. Each series carries its own colour; an
 * optional reference line (e.g. the σ_min floor or the initial wealth) is
 * drawn as a dashed horizontal marker.
 *
 * On mount each series line draws on left-to-right (`pathLength` 0→1, staggered
 * by series) and its end marker plus label settle in once the line has arrived,
 * so the eye follows the trajectory appearing rather than seeing a finished
 * tangle. Under `prefers-reduced-motion` every line and label renders at its
 * final state immediately.
 */
export interface TrajectorySeries {
  label: string;
  data: number[];
  colour: string;
  dash?: string;
}

export interface TrajectoryChartProps {
  series: TrajectorySeries[];
  height?: number;
  ariaLabel: string;
  yLabel?: string;
  xLabel?: string;
  /** Fixed y-domain [min, max]; otherwise inferred from the data. */
  yDomain?: [number, number];
  /** Dashed horizontal reference line with a label. */
  reference?: { value: number; label: string };
  className?: string;
  'data-testid'?: string;
}

const VIEW_W = 900;
const MARGIN = { top: 24, right: 96, bottom: 44, left: 56 };

export default function TrajectoryChart({
  series,
  height = CHART.minHeight.md,
  ariaLabel,
  yLabel,
  xLabel = 'round',
  yDomain,
  reference,
  className = '',
  'data-testid': testId,
}: TrajectoryChartProps) {
  const reduce = useReducedMotion();
  const plotW = VIEW_W - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const maxLen = Math.max(1, ...series.map((s) => s.data.length));

  const allValues = series.flatMap((s) => s.data);
  if (reference) allValues.push(reference.value);
  // Data-driven domain with 8% headroom so small-magnitude series (e.g. CRPS
  // around 0.04) are not squashed against the axis floor. An explicit yDomain
  // overrides this; otherwise the domain hugs the data, not a forced [0, 1].
  let lo: number;
  let hi: number;
  if (yDomain) {
    [lo, hi] = yDomain;
  } else {
    const dataLo = allValues.length ? Math.min(...allValues) : 0;
    const dataHi = allValues.length ? Math.max(...allValues) : 1;
    const pad = (dataHi - dataLo || 1) * 0.08;
    lo = dataLo - pad;
    hi = dataHi + pad;
  }
  const range = hi - lo || 1;

  const x = (i: number) => MARGIN.left + (maxLen === 1 ? plotW / 2 : (i / (maxLen - 1)) * plotW);
  const y = (v: number) => MARGIN.top + (1 - (v - lo) / range) * plotH;

  const yTicks = [lo, lo + range / 3, lo + (2 * range) / 3, hi];

  // Stagger end-labels vertically when two series end close together so the
  // labels do not overprint (e.g. mechanism vs uniform converging).
  const endYs = series.map((s) => (s.data.length ? y(s.data[s.data.length - 1]) : 0));

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      role="img"
      aria-label={ariaLabel}
      data-testid={testId}
      className={className}
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      {/* Frame */}
      <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="var(--paper)" stroke="var(--border)" strokeWidth={1} />

      {/* Y grid + ticks */}
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
          <text x={MARGIN.left - 8} y={y(t) + 4} textAnchor="end" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
            {t.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Reference line */}
      {reference && (
        <g>
          <line x1={MARGIN.left} x2={MARGIN.left + plotW} y1={y(reference.value)} y2={y(reference.value)} stroke="var(--ink-faint)" strokeWidth={1.5} strokeDasharray="5 4" />
          <text x={MARGIN.left + plotW + 6} y={y(reference.value) + 4} fontSize={CHART.axisLabel} fill="var(--ink-faint)" fontFamily="var(--font-sans)">
            {reference.label}
          </text>
        </g>
      )}

      {/* Series */}
      {series.map((s, si) => {
        if (s.data.length === 0) return null;
        const path = s.data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
        const lastX = x(s.data.length - 1);
        const lastY = endYs[si];
        // Nudge a label vertically if it would collide with an earlier one.
        let labelY = lastY + 4;
        for (let j = 0; j < si; j++) {
          if (Math.abs(endYs[j] - lastY) < 14) labelY = lastY + (lastY > endYs[j] ? 16 : -12);
        }
        // Each line draws on, staggered by series; the end marker and label
        // fade in once that line has finished arriving. A dashed series (the
        // uniform-baseline convention) fades in instead, because framer-motion
        // drives `pathLength` through strokeDasharray and would clobber the
        // dash pattern. Instant under reduce-motion.
        const drawDelay = reduce ? 0 : (si * STAGGER.group) / 1000;
        const labelDelay = reduce ? 0 : drawDelay + TRANSITION.draw.duration;
        return (
          <g key={s.label}>
            {s.dash ? (
              <motion.path
                d={path}
                fill="none"
                stroke={s.colour}
                strokeWidth={CHART.strokeWidth.emphasis}
                strokeDasharray={s.dash}
                strokeLinejoin="round"
                initial={reduce ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduce ? { duration: 0 } : { ...TRANSITION.draw, delay: drawDelay }}
              />
            ) : (
              <motion.path
                d={path}
                fill="none"
                stroke={s.colour}
                strokeWidth={CHART.strokeWidth.emphasis}
                strokeLinejoin="round"
                initial={reduce ? false : { pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={reduce ? { duration: 0 } : { ...TRANSITION.draw, delay: drawDelay }}
              />
            )}
            <motion.g
              initial={reduce ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={reduce ? { duration: 0 } : { duration: TRANSITION.micro.duration, ease: TRANSITION.micro.ease, delay: labelDelay }}
            >
              <circle cx={lastX} cy={lastY} r={3.5} fill={s.colour} />
              <text x={lastX + 8} y={labelY} fontSize={CHART.axisLabel} fontWeight={600} fill={s.colour} fontFamily="var(--font-sans)">
                {s.label}
              </text>
            </motion.g>
          </g>
        );
      })}

      {/* Axis labels */}
      <text x={MARGIN.left + plotW / 2} y={height - 8} textAnchor="middle" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-sans)" fontWeight={500}>
        {xLabel}
      </text>
      {yLabel && (
        <text x={16} y={MARGIN.top + plotH / 2} textAnchor="middle" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-sans)" fontWeight={500} transform={`rotate(-90, 16, ${MARGIN.top + plotH / 2})`}>
          {yLabel}
        </text>
      )}
    </svg>
  );
}
