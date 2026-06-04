import { useEffect, useRef, useState, type ReactNode } from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { TYPE, SPACE, DURATION, SPRING, TRANSITION } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';
import { VERDICT_COLOURS, contrastRatio } from '@/lib/palette';

/** WCAG AA large-text (>=24px bold / >=18.66px) contrast floor. */
const LARGE_TEXT_AA = 3;
/** The tile background the headline number sits on (var(--card) == white). */
const TILE_BG = '#ffffff';

type Size = 'lg' | 'xl';
type Direction = 'up' | 'down' | 'flat';

export interface StatTileProps {
  /** Eyebrow label above the number. */
  label: string;
  /** The number (already formatted, e.g. "-7.1" or "83.7"). */
  value: ReactNode;
  /** Optional unit suffix (e.g. "%", "MW"). */
  unit?: string;
  /** Optional change indicator. */
  delta?: { value: ReactNode; direction: Direction };
  /** `lg` = supporting stat (44px); `xl` = the headline number (64px). */
  size?: Size;
  /** Concept accent (drives the number colour). */
  accent?: keyof typeof SEM;
  /** Optional secondary line under the number. */
  sublabel?: ReactNode;
  /** Optional slot (e.g. a sparkline) below the value. */
  children?: ReactNode;
  className?: string;
}

/**
 * Tween a changing number towards its new value rather than snapping, so a
 * round-to-round update reads. Honours reduce-motion (renders the value
 * directly). `decimals` keeps the formatting stable across the tween.
 */
function AnimatedNumber({ value, decimals }: { value: number; decimals: number }) {
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(value);
  const prev = useRef(value);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      prev.current = value;
      return;
    }
    const controls = animate(prev.current, value, {
      ...TRANSITION.count,
      onUpdate: (v) => setDisplay(v),
    });
    prev.current = value;
    return () => controls.stop();
  }, [value, reduce]);

  return <>{display.toFixed(decimals)}</>;
}

/** Count the decimals in a JS number so the tween formats consistently. */
function decimalsOf(n: number): number {
  if (!Number.isFinite(n) || Number.isInteger(n)) return 0;
  const s = String(n);
  const dot = s.indexOf('.');
  return dot === -1 ? 0 : Math.min(4, s.length - dot - 1);
}

const DELTA_TONE: Record<Direction, { fg: string; arrow: string }> = {
  up: { fg: VERDICT_COLOURS.good.fg, arrow: '↑' },
  down: { fg: VERDICT_COLOURS.bad.fg, arrow: '↓' },
  flat: { fg: 'var(--ink-soft)', arrow: '→' },
};

/**
 * Large, legible single-metric tile. Number uses `statL` (44px) or
 * `statXL` (64px), tabular figures, optional delta with a verdict colour
 * and an arrow (length/direction, not colour alone). Entrance is a soft
 * spring that collapses to instant under reduce-motion.
 *
 * Spec: design_system.md §1 (statL/statXL), §9 (one headline number),
 * §6 (reduce-motion); ui_research §2 (length/position, not dials).
 */
export default function StatTile({
  label,
  value,
  unit,
  delta,
  size = 'lg',
  accent,
  sublabel,
  children,
  className = '',
}: StatTileProps) {
  const reduce = useReducedMotion();
  const numType = size === 'xl' ? TYPE.statXL : TYPE.statL;
  // The number takes its concept accent only when that hue clears the AA
  // large-text floor on the tile; otherwise it falls back to ink so the
  // headline figure stays legible (the accent still reads in charts/legends).
  const accentHex = accent ? SEM[accent].main : null;
  const numberColour =
    accentHex && contrastRatio(accentHex, TILE_BG) >= LARGE_TEXT_AA ? accentHex : 'var(--ink)';
  const deltaTone = delta ? DELTA_TONE[delta.direction] : null;

  return (
    <motion.div
      className={`platform-stat-tile ${className}`.trim()}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={reduce ? { duration: 0 } : { ...SPRING.soft, duration: DURATION.base / 1000 }}
      style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        padding: `${SPACE[5]}px ${SPACE[6]}px`,
        minWidth: 0,
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: TYPE.label.size,
          fontWeight: TYPE.label.weight,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--ink-soft)',
          margin: 0,
        }}
      >
        {label}
      </p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: SPACE[2] }}>
        <span
          className="tabular-nums"
          style={{
            fontFamily: numType.family,
            fontSize: numType.size,
            lineHeight: numType.lineHeight,
            fontWeight: numType.weight,
            color: numberColour,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {typeof value === 'number' ? <AnimatedNumber value={value} decimals={decimalsOf(value)} /> : value}
        </span>
        {unit && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: size === 'xl' ? 24 : 18,
              fontWeight: 600,
              color: 'var(--ink-soft)',
            }}
          >
            {unit}
          </span>
        )}
        {delta && deltaTone && (
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: 16,
              fontWeight: 600,
              color: deltaTone.fg,
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 2,
            }}
          >
            <span aria-hidden="true">{deltaTone.arrow}</span>
            {delta.value}
          </span>
        )}
      </div>
      {sublabel && (
        <p
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: TYPE.caption.size,
            color: 'var(--ink-faint)',
            margin: 0,
            marginTop: SPACE[1],
          }}
        >
          {sublabel}
        </p>
      )}
      {children && <div style={{ marginTop: SPACE[3] }}>{children}</div>}
    </motion.div>
  );
}
