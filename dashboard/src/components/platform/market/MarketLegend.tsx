import { TYPE, SPACE, RADIUS } from '@/components/platform/designTokens';
import { SEM } from '@/lib/tokens';
import { forecasterColour } from '@/components/platform/forecasterIdentity';

/**
 * Always-visible key for the market floor. Names every mark a viewer can point
 * at: a forecaster's q10..q90 fan, its median, the wager-weighted aggregate,
 * the realised outcome, and the per-row weight share. Plain-English, no maths.
 */
const fc = forecasterColour(0);

interface LegendItem {
  swatch: 'fan' | 'median' | 'aggregate' | 'outcome';
  colour: string;
  label: string;
}

const ITEMS: LegendItem[] = [
  { swatch: 'fan', colour: fc, label: "A forecaster's fan: its q10 to q90 forecast range" },
  { swatch: 'median', colour: fc, label: "That forecaster's median (middle line of the fan)" },
  { swatch: 'aggregate', colour: SEM.aggregate.main, label: 'Wager-weighted aggregate: the panel forecast' },
  { swatch: 'outcome', colour: SEM.outcome.main, label: 'Realised outcome y: what actually happened' },
];

function Swatch({ item }: { item: LegendItem }) {
  const { swatch, colour } = item;
  if (swatch === 'fan') {
    return (
      <span
        aria-hidden="true"
        style={{ width: 28, height: 14, borderRadius: 4, background: colour, opacity: 0.22, border: `1.5px solid ${colour}`, flexShrink: 0 }}
      />
    );
  }
  if (swatch === 'median') {
    return <span aria-hidden="true" style={{ width: 28, height: 14, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}><span style={{ width: 2.5, height: 14, background: colour }} /></span>;
  }
  if (swatch === 'aggregate') {
    return <span aria-hidden="true" style={{ width: 28, height: 14, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}><span style={{ width: 3, height: 14, background: colour }} /></span>;
  }
  // outcome: dashed line swatch
  return (
    <span aria-hidden="true" style={{ width: 28, height: 14, flexShrink: 0, display: 'inline-flex', justifyContent: 'center' }}>
      <span style={{ width: 0, height: 14, borderLeft: `2.5px dashed ${colour}` }} />
    </span>
  );
}

export default function MarketLegend() {
  return (
    <ul
      data-testid="market-legend"
      aria-label="What the marks mean"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: `${SPACE[2]}px ${SPACE[5]}px`,
        listStyle: 'none',
        margin: 0,
        padding: `${SPACE[3]}px ${SPACE[4]}px`,
        background: 'var(--cream)',
        border: '1px solid var(--border)',
        borderRadius: RADIUS.md,
      }}
    >
      {ITEMS.map((item) => (
        <li key={item.label} style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
          <Swatch item={item} />
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)' }}>{item.label}</span>
        </li>
      ))}
      <li style={{ display: 'flex', alignItems: 'center', gap: SPACE[2] }}>
        <span aria-hidden="true" style={{ fontFamily: 'var(--font-mono)', fontSize: TYPE.caption.size, fontWeight: 700, color: 'var(--ink-soft)', flexShrink: 0 }}>w%</span>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: TYPE.caption.size, color: 'var(--ink-soft)' }}>Each row's weight in the aggregate</span>
      </li>
    </ul>
  );
}
