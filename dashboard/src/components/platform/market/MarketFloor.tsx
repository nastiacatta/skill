import { motion, useReducedMotion } from 'framer-motion';
import type { RoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';
import { CHART, SPRING, TRANSITION } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';
import { forecasterColour, forecasterLabel } from '@/components/platform/forecasterIdentity';

/**
 * The "trading floor": the panel's per-forecaster quantile fans stacked as
 * ribbons, the wager-weighted aggregate fan emphasised in the centre, and the
 * realised outcome marker. Every geometry comes from the trace: each ribbon is
 * forecaster i's qReports[i] (q0.1..q0.9), the aggregate is r_hat_q, the outcome
 * is y. Weight share w_i drives the ribbon's opacity and is labelled.
 *
 * Layout rule (no overlap at 3..12 forecasters): every text label lives in a
 * margin gutter, never on top of a ribbon. Forecaster names sit in the left
 * gutter, weight shares in the right gutter, both vertically centred on their
 * own row. The two vertical-reference labels (aggregate median, realised
 * outcome) sit on two separate rows in the top margin so they never collide
 * with each other or with a ribbon. The panel height grows with the forecaster
 * count, so rows stay legible rather than being crammed.
 *
 * Reading order is left-to-right report -> aggregate (draft fig:report-to-wager).
 */
export interface MarketFloorProps {
  trace: RoundTrace;
  n: number;
  hovered?: number | null;
  onHover?: (i: number | null) => void;
  visitorIndex?: number;
}

const VIEW_W = 960;
const MARGIN = { top: 52, right: 132, bottom: 64, left: 84 };
const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1.0];
/** Comfortable vertical room per forecaster row; keeps 12 rows legible. */
const ROW_H = 46;

export default function MarketFloor({
  trace,
  n,
  hovered = null,
  onHover,
  visitorIndex,
}: MarketFloorProps) {
  const reduce = useReducedMotion();

  const active = Array.from({ length: n }, (_, i) => i).filter((i) => trace.participated[i]);
  const rows = Math.max(1, active.length);
  const plotH = rows * ROW_H;
  const height = MARGIN.top + plotH + MARGIN.bottom;
  const plotW = VIEW_W - MARGIN.left - MARGIN.right;
  const x = (v: number) => MARGIN.left + Math.max(0, Math.min(1, v)) * plotW;
  // Round-to-round geometry changes glide along a readable path rather than
  // snapping, so the eye follows the change. Instant under reduce-motion.
  const formUpdate = reduce ? { duration: 0 } : TRANSITION.formUpdate;

  const slotH = plotH / rows;
  const ribbonH = Math.min(slotH * 0.5, 30);
  const slotY = (slot: number) => MARGIN.top + slot * slotH + slotH / 2;

  const aggQ = trace.r_hat_q;
  const aggLo = x(aggQ[0]);
  const aggHi = x(aggQ[aggQ.length - 1]);
  const aggMed = x(aggQ[Math.floor(aggQ.length / 2)]);
  const yOut = x(trace.y);

  // Anchor a top-margin reference label so it never spills past the plot edge.
  const refAnchor = (px: number): { anchor: 'start' | 'middle' | 'end'; dx: number } => {
    if (px < MARGIN.left + 56) return { anchor: 'start', dx: 0 };
    if (px > MARGIN.left + plotW - 56) return { anchor: 'end', dx: 0 };
    return { anchor: 'middle', dx: 0 };
  };
  const aggLab = refAnchor(aggMed);
  const outLab = refAnchor(yOut);

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${height}`}
      role="img"
      aria-label="Market floor: each forecaster's quantile fan and the wager-weighted aggregate, against the realised outcome"
      data-testid="market-floor"
      style={{ width: '100%', height: 'auto', display: 'block' }}
    >
      <rect x={MARGIN.left} y={MARGIN.top} width={plotW} height={plotH} fill="var(--paper)" stroke="var(--border)" strokeWidth={1} />

      {AXIS_TICKS.map((tick) => (
        <g key={tick}>
          <line x1={x(tick)} x2={x(tick)} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke="var(--border)" strokeWidth={1} opacity={0.5} />
          <text x={x(tick)} y={MARGIN.top + plotH + 20} textAnchor="middle" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-mono)">
            {tick.toFixed(2)}
          </text>
        </g>
      ))}

      {/* Aggregate 80% band spanning full height */}
      <motion.rect
        initial={false}
        animate={{ x: aggLo, width: Math.max(0, aggHi - aggLo) }}
        transition={formUpdate}
        y={MARGIN.top}
        height={plotH}
        fill={SEM.aggregate.main}
        opacity={0.1}
      />

      {/* Per-forecaster ribbons */}
      {active.map((i, slot) => {
        const q = trace.qReports[i];
        if (!q || q.length < 9) return null;
        const cy = slotY(slot);
        const yTop = cy - ribbonH / 2;
        const x10 = x(q[0]);
        const x90 = x(q[8]);
        const x50 = x(q[4]);
        const colour = forecasterColour(i);
        const w = trace.weights[i] ?? 0;
        const isHover = hovered === i;
        const dim = hovered != null && !isHover;
        return (
          <motion.g
            key={`rib-${i}`}
            data-testid={`market-ribbon-${i}`}
            onMouseEnter={() => onHover?.(i)}
            onMouseLeave={() => onHover?.(null)}
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: isHover ? 1 : dim ? 0.45 : 0.9 }}
            transition={reduce ? { duration: 0 } : SPRING.soft}
            style={{ cursor: 'pointer' }}
          >
            {/* Forecaster name in the left gutter, centred on the row. */}
            <text x={MARGIN.left - 10} y={cy + 4} textAnchor="end" fontSize={CHART.axisLabel} fontWeight={600} fill={colour} fontFamily="var(--font-sans)">
              {forecasterLabel(i, visitorIndex)}
            </text>
            <motion.rect initial={false} animate={{ x: x10, width: Math.max(0, x90 - x10) }} transition={formUpdate} y={yTop} height={ribbonH} rx={4} fill={colour} opacity={0.22} />
            <motion.rect initial={false} animate={{ x: x10, width: Math.max(0, x90 - x10) }} transition={formUpdate} y={yTop} height={ribbonH} rx={4} fill="none" stroke={colour} strokeWidth={isHover ? 2.5 : 1.5} />
            <motion.line initial={false} animate={{ x1: x50, x2: x50 }} transition={formUpdate} y1={yTop} y2={yTop + ribbonH} stroke={colour} strokeWidth={2.5} />
            {/* Weight share in the right gutter, centred on the row. */}
            <text x={MARGIN.left + plotW + 10} y={cy + 4} textAnchor="start" fontSize={CHART.axisLabel} fontWeight={600} fill={colour} fontFamily="var(--font-mono)">
              w {(w * 100).toFixed(1)}%
            </text>
          </motion.g>
        );
      })}

      {/* Aggregate median line + label (top row of the top margin) */}
      <motion.line
        x1={aggMed}
        x2={aggMed}
        y1={MARGIN.top}
        y2={MARGIN.top + plotH}
        stroke={SEM.aggregate.main}
        strokeWidth={CHART.strokeWidth.emphasis}
        initial={false}
        animate={{ x1: aggMed, x2: aggMed }}
        transition={formUpdate}
      />
      <text x={aggMed} y={MARGIN.top - 30} textAnchor={aggLab.anchor} fontSize={CHART.axisLabel} fontWeight={700} fill={SEM.aggregate.main} fontFamily="var(--font-mono)">
        aggregate {aggQ[Math.floor(aggQ.length / 2)].toFixed(2)}
      </text>

      {/* Realised outcome marker + label (lower row of the top margin) */}
      <motion.line initial={false} animate={{ x1: yOut, x2: yOut }} transition={formUpdate} y1={MARGIN.top} y2={MARGIN.top + plotH} stroke={SEM.outcome.main} strokeWidth={2.5} strokeDasharray="6 4" />
      <text x={yOut} y={MARGIN.top - 12} textAnchor={outLab.anchor} fontSize={CHART.axisLabel} fontWeight={700} fill={SEM.outcome.main} fontFamily="var(--font-mono)">
        outcome y = {trace.y.toFixed(2)}
      </text>

      {/* Explicit x-axis title */}
      <text x={MARGIN.left + plotW / 2} y={height - 10} textAnchor="middle" fontSize={CHART.axisLabel} fill="var(--ink-soft)" fontFamily="var(--font-sans)" fontWeight={600}>
        normalised forecast value on [0, 1] &middot; {TAUS.length}-level quantile fan per forecaster
      </text>
    </svg>
  );
}
