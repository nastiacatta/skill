import { useMemo } from 'react';
import { storyPalette, forecasterColour } from './storyPalette';

export interface StoryWagerFlowProps {
  effectiveWager: number[];
  payout: number[];
  forecasterCount: number;
  step: number;
  activeForecaster?: number | null;
}

const WIDTH = 400;
const HEIGHT = 140;
const NODE_W = 8;
const POOL_X = WIDTH / 2;
const LEFT_X = 40;
const RIGHT_X = WIDTH - 40;
const TOP_PAD = 28;

function fmt(v: number): string {
  return Number.isFinite(v) ? v.toFixed(2) : '0.00';
}

export default function StoryWagerFlow({
  effectiveWager,
  payout,
  forecasterCount,
  step,
  activeForecaster = null,
}: StoryWagerFlowProps) {
  const showInbound = step >= 3;
  const showOutbound = step >= 6;

  const totalWager = useMemo(
    () => effectiveWager.slice(0, forecasterCount).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [effectiveWager, forecasterCount],
  );
  const totalPayout = useMemo(
    () => payout.slice(0, forecasterCount).reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0),
    [payout, forecasterCount],
  );

  const maxRibbon = useMemo(() => {
    const vals = [
      ...effectiveWager.slice(0, forecasterCount),
      ...payout.slice(0, forecasterCount).map(Math.abs),
    ];
    return Math.max(...vals, 0.01);
  }, [effectiveWager, payout, forecasterCount]);

  const ribbonScale = (v: number) => Math.max(1, (Math.abs(v) / maxRibbon) * 20);

  const slotH = (HEIGHT - TOP_PAD) / forecasterCount;

  return (
    <div data-testid="wager-flow" style={{ width: '100%', maxWidth: WIDTH }}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label="wager and payout flow diagram"
      >
        {/* Pool node */}
        <rect
          x={POOL_X - NODE_W / 2}
          y={TOP_PAD}
          width={NODE_W}
          height={HEIGHT - TOP_PAD}
          rx={3}
          fill={storyPalette.pool.fill}
          stroke={storyPalette.pool.stroke}
          strokeWidth={1}
        />
        <text
          x={POOL_X}
          y={14}
          textAnchor="middle"
          fontSize={10}
          fontWeight={600}
          fill={storyPalette.text.body}
          fontFamily="var(--font-sans, sans-serif)"
        >
          Pool
        </text>

        {/* Inbound ribbons (wagers flowing in) */}
        {showInbound && Array.from({ length: forecasterCount }).map((_, i) => {
          const w = effectiveWager[i] ?? 0;
          if (w <= 0) return null;
          const thick = ribbonScale(w);
          const yMid = TOP_PAD + slotH * i + slotH / 2;
          const isHighlighted = activeForecaster === i;
          const isDimmed = activeForecaster != null && !isHighlighted;
          const baseOpacity = showOutbound ? 0.25 : 0.6;
          const opacity = isHighlighted ? 0.9 : isDimmed ? 0.12 : baseOpacity;
          return (
            <path
              key={`in-${i}`}
              d={`M${LEFT_X},${yMid} C${POOL_X - 40},${yMid} ${POOL_X - 30},${yMid} ${POOL_X - NODE_W / 2},${yMid}`}
              fill="none"
              stroke={forecasterColour(i)}
              strokeWidth={isHighlighted ? thick + 1 : thick}
              opacity={opacity}
              strokeLinecap="round"
              style={{ transition: 'opacity 0.15s ease' }}
            />
          );
        })}

        {/* Outbound ribbons (payouts flowing out) */}
        {showOutbound && Array.from({ length: forecasterCount }).map((_, i) => {
          const p = payout[i] ?? 0;
          const thick = ribbonScale(p);
          const yMid = TOP_PAD + slotH * i + slotH / 2;
          const isPositive = p >= (effectiveWager[i] ?? 0);
          const isHighlighted = activeForecaster === i;
          const isDimmed = activeForecaster != null && !isHighlighted;
          return (
            <path
              key={`out-${i}`}
              d={`M${POOL_X + NODE_W / 2},${yMid} C${POOL_X + 30},${yMid} ${RIGHT_X - 40},${yMid} ${RIGHT_X},${yMid}`}
              fill="none"
              stroke={isPositive ? storyPalette.payoutPositive : storyPalette.payoutNegative}
              strokeWidth={isHighlighted ? thick + 1 : thick}
              opacity={isHighlighted ? 0.95 : isDimmed ? 0.2 : 0.7}
              strokeLinecap="round"
              style={{ transition: 'opacity 0.15s ease' }}
            />
          );
        })}

        {/* Left labels */}
        {showInbound && Array.from({ length: forecasterCount }).map((_, i) => {
          const yMid = TOP_PAD + slotH * i + slotH / 2;
          return (
            <text
              key={`lbl-l-${i}`}
              x={LEFT_X - 6}
              y={yMid + 3}
              textAnchor="end"
              fontSize={9}
              fill={forecasterColour(i)}
              fontWeight={600}
              fontFamily="var(--font-sans, sans-serif)"
            >
              F{i + 1}
            </text>
          );
        })}

        {/* Right labels (payouts) */}
        {showOutbound && Array.from({ length: forecasterCount }).map((_, i) => {
          const p = payout[i] ?? 0;
          const yMid = TOP_PAD + slotH * i + slotH / 2;
          const isPositive = p >= (effectiveWager[i] ?? 0);
          return (
            <text
              key={`lbl-r-${i}`}
              x={RIGHT_X + 6}
              y={yMid + 3}
              textAnchor="start"
              fontSize={9}
              fill={isPositive ? storyPalette.payoutPositive : storyPalette.payoutNegative}
              fontWeight={600}
              fontFamily="var(--font-mono, monospace)"
            >
              {fmt(p)}
            </text>
          );
        })}
      </svg>

      {/* Summary labels */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          fontFamily: 'var(--font-mono, monospace)',
          color: storyPalette.text.muted,
          padding: '2px 4px 0',
        }}
      >
        {showInbound && (
          <span data-testid="wager-flow-total-in">
            Total in: {fmt(totalWager)}
          </span>
        )}
        {showOutbound && (
          <span data-testid="wager-flow-total-out">
            Total out: {fmt(totalPayout)}
          </span>
        )}
      </div>
    </div>
  );
}
