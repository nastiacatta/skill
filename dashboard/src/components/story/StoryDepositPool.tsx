/**
 * Centred pool tile that aggregates inbound deposits, partial weight
 * refunds and outbound payouts. Pure render: receives the three
 * scalars the parent computes from the trace and draws them stacked
 * inside a single bordered tile.
 */

import { AnimatePresence, motion } from 'framer-motion';
import { storyPalette } from './storyPalette';
import type { StoryFrameIndex } from './useStoryPipeline';

export interface StoryDepositPoolProps {
  frame: StoryFrameIndex;
  totalDeposits: number;
  totalEffectiveWager: number;
  totalPayout: number;
  residual?: number;
}

function residualLabel(value: number): string {
  if (!Number.isFinite(value)) return '.';
  const abs = Math.abs(value);
  if (abs === 0) return '0 (exact)';
  if (abs < 1e-9) {
    return `${value < 0 ? '-' : ''}${abs.toExponential(1)}`;
  }
  return value.toFixed(3);
}

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '.';
  return value.toFixed(digits);
}

interface FlightToken {
  key: string;
  colour: string;
  fromX: number;
  toX: number;
  delay: number;
}

function tokensForFrame(frame: StoryFrameIndex): FlightToken[] {
  if (frame === 1) {
    return storyPalette.forecasters.map((colour, idx) => ({
      key: `dep-${idx}`,
      colour,
      fromX: 110,
      toX: 0,
      delay: idx * 0.05,
    }));
  }
  if (frame === 2) {
    return [
      {
        key: 'gate-refund',
        colour: storyPalette.inactive,
        fromX: 0,
        toX: 110,
        delay: 0,
      },
    ];
  }
  if (frame === 6) {
    return storyPalette.forecasters.map((colour, idx) => ({
      key: `pay-${idx}`,
      colour,
      fromX: 0,
      toX: 110,
      delay: idx * 0.05,
    }));
  }
  return [];
}

export default function StoryDepositPool({
  frame,
  totalDeposits,
  totalEffectiveWager,
  totalPayout,
  residual,
}: StoryDepositPoolProps) {
  const showWager = frame >= 2;
  const showPayout = frame >= 6;
  const showResidual = frame >= 6 && typeof residual === 'number';
  const tokens = tokensForFrame(frame);

  return (
    <div
      style={{
        background: storyPalette.surface.tile,
        border: `1px solid ${storyPalette.surface.border}`,
        borderLeft: `3px solid ${storyPalette.pool.stroke}`,
        borderRadius: 4,
        padding: '14px 18px',
        minWidth: 220,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          position: 'relative',
        }}
      >
        <span
          aria-hidden
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            background: storyPalette.pool.fill,
            border: `1.5px solid ${storyPalette.pool.stroke}`,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: storyPalette.pool.stroke,
            fontWeight: 700,
            fontSize: 14,
            fontFamily: 'var(--font-mono)',
            position: 'relative',
            zIndex: 1,
          }}
        >
          ∑
        </span>
        <div>
          <p
            className="eyebrow"
            style={{
              color: storyPalette.pool.stroke,
              marginBottom: 2,
              fontSize: 10,
            }}
          >
            Deposit pool
          </p>
          <div
            className="font-serif"
            style={{
              fontSize: 15,
              fontWeight: 600,
              color: storyPalette.text.body,
              lineHeight: 1.2,
            }}
          >
            self-financed pot
          </div>
        </div>
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            overflow: 'hidden',
          }}
        >
          <AnimatePresence>
            {tokens.map((token) => (
              <motion.span
                key={`${frame}-${token.key}`}
                initial={{ x: token.fromX, opacity: 0, scale: 0.5 }}
                animate={{
                  x: token.toX,
                  opacity: [0, 1, 1, 0],
                  scale: 1,
                }}
                exit={{ opacity: 0 }}
                transition={{
                  duration: 0.62,
                  ease: [0.22, 1, 0.36, 1],
                  delay: token.delay,
                  times: [0, 0.2, 0.7, 1],
                }}
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 0,
                  width: 10,
                  height: 10,
                  borderRadius: 5,
                  background: token.colour,
                  boxShadow: '0 0 0 1.5px rgba(255,255,255,0.6)',
                }}
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <div
        style={{
          marginTop: 14,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
        }}
      >
        <div>
          <div
            className="eyebrow"
            style={{ color: storyPalette.text.muted, fontSize: 10 }}
          >
            Deposits
          </div>
          <div
            className="font-mono tabular-nums"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: storyPalette.text.body,
              marginTop: 2,
            }}
          >
            {fmt(totalDeposits)}
          </div>
        </div>
        <div>
          <div
            className="eyebrow"
            style={{ color: storyPalette.text.muted, fontSize: 10 }}
          >
            Wager
          </div>
          <div
            className="font-mono tabular-nums"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: showWager
                ? storyPalette.aggregate.line
                : storyPalette.text.muted,
              marginTop: 2,
            }}
          >
            {showWager ? fmt(totalEffectiveWager) : '.'}
          </div>
        </div>
        <div>
          <div
            className="eyebrow"
            style={{ color: storyPalette.text.muted, fontSize: 10 }}
          >
            Payouts
          </div>
          <div
            className="font-mono tabular-nums"
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: showPayout
                ? storyPalette.payoutPositive
                : storyPalette.text.muted,
              marginTop: 2,
            }}
          >
            {showPayout ? fmt(totalPayout) : '.'}
          </div>
        </div>
      </div>
      {showResidual && (
        <div
          style={{
            marginTop: 10,
            paddingTop: 10,
            borderTop: `1px dashed ${storyPalette.surface.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 8,
          }}
        >
          <span
            className="eyebrow"
            style={{ color: storyPalette.text.muted, fontSize: 10 }}
          >
            Σ payout − Σ wager
          </span>
          <span
            className="font-mono tabular-nums"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: storyPalette.text.body,
            }}
          >
            {residualLabel(residual ?? 0)}
          </span>
        </div>
      )}
    </div>
  );
}
