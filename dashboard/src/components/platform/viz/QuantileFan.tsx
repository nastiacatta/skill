import { useCallback, useId, useRef } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CHART, TYPE, TRANSITION } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';
import { clamp01, fanFromMedianSpread, medianSpreadFromFan } from './fanMaths';

/**
 * Large, legible quantile fan over a [0, 1] outcome axis.
 *
 * The 9-level quantile vector is drawn as nested coverage bands (the Bank of
 * England fan-chart convention: darker inner bands, lighter outer bands), with
 * a median line and an optional realised-outcome marker. Bands pair the grid
 * symmetrically - [q0.1,q0.9]=80%, [q0.2,q0.8]=60%, [q0.3,q0.7]=40%,
 * [q0.4,q0.6]=20% - so the central mass reads darkest.
 *
 * Editable mode exposes a median handle (drag horizontally to move the whole
 * fan) and a spread handle (drag the right edge to widen/narrow). Both recompute
 * the fan through `fanFromMedianSpread`, which monotonises and clamps to [0, 1],
 * so the emitted vector is always a valid non-crossing fan the simulator can
 * score directly.
 */

export interface QuantileFanProps {
  /** 9-level quantile vector q(τ_k), monotone non-decreasing. */
  quantiles: number[];
  /** Quantile levels τ_k (same length as quantiles). */
  taus: readonly number[];
  /** Realised outcome y; drawn as a dashed marker when provided. */
  outcome?: number;
  /** When true, shows draggable median + spread handles. */
  editable?: boolean;
  /** Called with a fresh monotone, clamped quantile vector on edit. */
  onChange?: (quantiles: number[]) => void;
  /** Outer SVG height in px (defaults to the hero chart minimum). */
  height?: number;
  /** Accessible description. */
  ariaLabel?: string;
  /** Band/line colour (defaults to the aggregate concept colour). */
  accent?: string;
  /** Axis caption under the plot. */
  axisLabel?: string;
  /** Optional title above the plot. */
  title?: string;
  className?: string;
  'data-testid'?: string;
}

const VIEW_W = 960;
// Top margin holds two label rows so the median and the realised-outcome labels
// never overprint the coverage bands: outcome on the upper row, median below it.
const MARGIN = { top: 44, right: 36, bottom: 52, left: 36 };
const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1.0];

/** Symmetric band pairs (low index, high index) into the 9-level vector. */
const BANDS = [
  { lo: 0, hi: 8, label: '80%', opacity: 0.14 },
  { lo: 1, hi: 7, label: '60%', opacity: 0.2 },
  { lo: 2, hi: 6, label: '40%', opacity: 0.28 },
  { lo: 3, hi: 5, label: '20%', opacity: 0.4 },
];

export default function QuantileFan({
  quantiles,
  taus,
  outcome,
  editable = false,
  onChange,
  height = CHART.minHeight.lg,
  ariaLabel,
  accent = SEM.aggregate.main,
  axisLabel = 'normalised outcome',
  title,
  className = '',
  'data-testid': testId,
}: QuantileFanProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<'median' | 'spread' | null>(null);
  const gradientId = useId();
  const reduce = useReducedMotion();
  // While dragging the fan should track the pointer instantly; the smooth
  // form-update tween is for round-to-round changes, not direct manipulation.
  const fanTransition = reduce || editable ? { duration: 0 } : TRANSITION.formUpdate;
  // Mount reveal: the band group fades in and expands from its centre, so the
  // fan reads as opening rather than blinking on. Suppressed while editable
  // (direct manipulation should feel immediate) and under reduce-motion. The
  // inner bands keep `initial={false}` so a round-to-round reshape still uses
  // the form-update tween, not this entrance.
  const revealGroup = reduce || editable
    ? false
    : { initial: { opacity: 0, scaleX: 0.82 }, animate: { opacity: 1, scaleX: 1 } };

  const plotW = VIEW_W - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const x = useCallback((v: number) => MARGIN.left + clamp01(v) * plotW, [plotW]);

  const mid = Math.floor(quantiles.length / 2);
  const median = quantiles[mid] ?? 0.5;
  const bandY = MARGIN.top;
  const bandH = plotH;

  // Convert a pointer clientX to a data x-coordinate in [0, 1].
  const pointerToData = useCallback((clientX: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0.5;
    const rect = svg.getBoundingClientRect();
    const scale = VIEW_W / rect.width;
    const svgX = (clientX - rect.left) * scale;
    return clamp01((svgX - MARGIN.left) / plotW);
  }, [plotW]);

  const handleDrag = useCallback((clientX: number) => {
    if (!onChange) return;
    const dataX = pointerToData(clientX);
    const { median: curMed, spread: curSpread } = medianSpreadFromFan(quantiles);
    if (dragRef.current === 'median') {
      onChange(fanFromMedianSpread(dataX, curSpread));
    } else if (dragRef.current === 'spread') {
      // Right edge target: half-width in outcome space → re-fit spread so q0.9 ≈ dataX.
      const halfWidth = Math.max(0.01, dataX - curMed);
      // Map the 80% half-width to a latent spread via the q0.9 offset (z ≈ 1.2816).
      const spread = Math.max(0.02, halfWidth / 1.2816);
      onChange(fanFromMedianSpread(curMed, spread));
    }
  }, [onChange, pointerToData, quantiles]);

  const startDrag = useCallback((kind: 'median' | 'spread') => (e: React.PointerEvent) => {
    if (!editable) return;
    e.preventDefault();
    dragRef.current = kind;
    const onMove = (ev: PointerEvent) => handleDrag(ev.clientX);
    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [editable, handleDrag]);

  // Keyboard nudge for the median handle (accessibility for the editable fan).
  const onMedianKey = useCallback((e: React.KeyboardEvent) => {
    if (!editable || !onChange) return;
    const { median: curMed, spread: curSpread } = medianSpreadFromFan(quantiles);
    const step = e.shiftKey ? 0.05 : 0.01;
    if (e.key === 'ArrowRight') { e.preventDefault(); onChange(fanFromMedianSpread(curMed + step, curSpread)); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); onChange(fanFromMedianSpread(curMed - step, curSpread)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); onChange(fanFromMedianSpread(curMed, curSpread * 1.1)); }
    if (e.key === 'ArrowDown') { e.preventDefault(); onChange(fanFromMedianSpread(curMed, curSpread * 0.9)); }
  }, [editable, onChange, quantiles]);

  const xMed = x(median);
  const xHi = x(quantiles[quantiles.length - 1] ?? 1);

  return (
    <figure className={`platform-fan ${className}`.trim()} style={{ margin: 0 }}>
      {title && (
        <figcaption
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: CHART.title,
            fontWeight: 600,
            color: 'var(--ink)',
            marginBottom: 8,
          }}
        >
          {title}
        </figcaption>
      )}
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VIEW_W} ${height}`}
        // A plain `img` must have no interactive descendants; the editable fan
        // carries focusable slider handles, so it is a labelled group instead.
        role={editable ? 'group' : 'img'}
        aria-label={ariaLabel ?? 'Quantile forecast fan'}
        data-testid={testId ?? 'quantile-fan'}
        style={{ width: '100%', height: 'auto', display: 'block', touchAction: 'none' }}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={accent} stopOpacity={0.04} />
            <stop offset="50%" stopColor={accent} stopOpacity={0.1} />
            <stop offset="100%" stopColor={accent} stopOpacity={0.04} />
          </linearGradient>
        </defs>

        {/* Plot frame */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotW}
          height={plotH}
          fill="var(--paper)"
          stroke="var(--border)"
          strokeWidth={1}
        />

        {/* Vertical grid + axis ticks */}
        {AXIS_TICKS.map((tick) => (
          <g key={tick}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotH}
              stroke="var(--border)"
              strokeWidth={1}
              opacity={0.6}
            />
            <text
              x={x(tick)}
              y={MARGIN.top + plotH + 22}
              textAnchor="middle"
              fontSize={CHART.axisLabel}
              fill="var(--ink-soft)"
              fontFamily="var(--font-mono)"
            >
              {tick.toFixed(2)}
            </text>
          </g>
        ))}

        {/* Nested coverage bands (darker inner = central mass). The group
            fades in and expands from centre on mount; the rects keep
            `initial={false}` so a round change still uses the form tween. */}
        <motion.g
          initial={revealGroup ? revealGroup.initial : false}
          animate={revealGroup ? revealGroup.animate : undefined}
          transition={revealGroup ? { ...TRANSITION.draw } : undefined}
          style={{ transformBox: 'fill-box', transformOrigin: 'center' }}
        >
          {BANDS.map((band) => {
            const x1 = x(quantiles[band.lo] ?? 0);
            const x2 = x(quantiles[band.hi] ?? 1);
            return (
              <motion.rect
                key={band.label}
                initial={false}
                animate={{ x: x1, width: Math.max(0, x2 - x1) }}
                transition={fanTransition}
                y={bandY}
                height={bandH}
                fill={accent}
                opacity={band.opacity}
                data-testid={`fan-band-${band.label}`}
              />
            );
          })}

          {/* Quantile level ticks at the base (one per τ_k grid level) */}
          {quantiles.map((q, k) => (
            <motion.line
              key={`qtick-${taus[k] ?? k}`}
              initial={false}
              animate={{ x1: x(q), x2: x(q) }}
              transition={fanTransition}
              y1={MARGIN.top + plotH - 10}
              y2={MARGIN.top + plotH}
              stroke={accent}
              strokeWidth={1.5}
              opacity={0.5}
            />
          ))}
        </motion.g>

        {/* Median line */}
        <motion.line
          initial={false}
          animate={{ x1: xMed, x2: xMed }}
          transition={fanTransition}
          y1={bandY}
          y2={bandY + bandH}
          stroke={accent}
          strokeWidth={CHART.strokeWidth.emphasis}
        />
        <motion.text
          initial={false}
          animate={{ x: xMed }}
          transition={fanTransition}
          y={MARGIN.top - 8}
          textAnchor="middle"
          fontSize={CHART.axisLabel}
          fontWeight={600}
          fill={accent}
          fontFamily="var(--font-mono)"
        >
          median {median.toFixed(2)}
        </motion.text>

        {/* Realised outcome marker */}
        {outcome != null && (
          <g data-testid="fan-outcome">
            <line
              x1={x(outcome)}
              x2={x(outcome)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotH}
              stroke={SEM.outcome.main}
              strokeWidth={2.5}
              strokeDasharray="6 4"
            />
            {/* Label on the upper row of the top margin, clear of the bands and
                of the median label (which sits on the lower row at top - 8). */}
            <text
              x={x(outcome)}
              y={MARGIN.top - 26}
              textAnchor={outcome > 0.8 ? 'end' : 'start'}
              dx={outcome > 0.8 ? -8 : 8}
              fontSize={CHART.axisLabel}
              fontWeight={600}
              fill={SEM.outcome.main}
              fontFamily="var(--font-mono)"
            >
              y = {outcome.toFixed(2)}
            </text>
          </g>
        )}

        {/* Editable handles */}
        {editable && (
          <>
            {/* Spread handle on the right (q0.9) edge */}
            <g
              role="slider"
              aria-label="Adjust forecast spread"
              aria-valuenow={Math.round((quantiles[quantiles.length - 1] - median) * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              tabIndex={0}
              onPointerDown={startDrag('spread')}
              style={{ cursor: 'ew-resize' }}
            >
              <line x1={xHi} x2={xHi} y1={bandY} y2={bandY + bandH} stroke={accent} strokeWidth={2} opacity={0.7} />
              <circle cx={xHi} cy={bandY + bandH / 2} r={11} fill="var(--paper)" stroke={accent} strokeWidth={2.5} />
              <path d={`M${xHi - 4} ${bandY + bandH / 2 - 4} l-4 4 l4 4 M${xHi + 4} ${bandY + bandH / 2 - 4} l4 4 l-4 4`} stroke={accent} strokeWidth={1.5} fill="none" />
            </g>
            {/* Median handle */}
            <g
              role="slider"
              aria-label="Adjust forecast median"
              aria-valuenow={Math.round(median * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              tabIndex={0}
              onPointerDown={startDrag('median')}
              onKeyDown={onMedianKey}
              style={{ cursor: 'ew-resize' }}
            >
              <circle cx={xMed} cy={bandY + bandH / 2} r={13} fill={accent} stroke="var(--paper)" strokeWidth={3} />
              <path d={`M${xMed - 3} ${bandY + bandH / 2 - 5} v10 M${xMed + 3} ${bandY + bandH / 2 - 5} v10`} stroke="var(--paper)" strokeWidth={1.5} />
            </g>
          </>
        )}

        {/* Axis caption */}
        <text
          x={MARGIN.left + plotW / 2}
          y={height - 12}
          textAnchor="middle"
          fontSize={CHART.axisLabel}
          fill="var(--ink-soft)"
          fontFamily="var(--font-sans)"
          fontWeight={500}
        >
          {axisLabel}
        </text>
      </svg>
      {editable && (
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-faint)', margin: '6px 0 0' }}>
          Drag the median handle to move the forecast; drag the right edge to widen or narrow it. Quantiles stay monotone and within [0, 1].
        </p>
      )}
    </figure>
  );
}
