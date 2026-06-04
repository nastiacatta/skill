import { storyPalette } from './storyPalette';
import type { StoryFrameIndex } from './useStoryPipeline';

export interface StoryContextStripProps {
  frame: StoryFrameIndex;
  forecasterCount: number;
  totalDeposits: number;
  totalEffectiveWager: number;
  totalPayout: number;
  budgetResidual?: number;
}

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '.';
  return value.toFixed(digits);
}

export default function StoryContextStrip({
  frame,
  forecasterCount,
  totalDeposits,
  totalEffectiveWager,
  totalPayout,
  budgetResidual,
}: StoryContextStripProps) {
  const showWager = frame >= 2;
  const showPayout = frame >= 6;

  return (
    <div
      aria-label="Pool summary"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        padding: '8px 16px',
        borderRadius: 6,
        background: storyPalette.pool.fill,
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        color: storyPalette.text.muted,
      }}
    >
      <span>
        <strong style={{ color: storyPalette.text.body, fontWeight: 600 }}>
          {forecasterCount}
        </strong>{' '}
        deposits = {fmt(totalDeposits)}
      </span>

      {showWager && (
        <>
          <span
            style={{
              width: 1,
              height: 16,
              background: storyPalette.surface.border,
            }}
            aria-hidden
          />
          <span>
            wager pool ={' '}
            <strong style={{ color: storyPalette.aggregate.line, fontWeight: 600 }}>
              {fmt(totalEffectiveWager)}
            </strong>
          </span>
        </>
      )}

      {showPayout && (
        <>
          <span
            style={{
              width: 1,
              height: 16,
              background: storyPalette.surface.border,
            }}
            aria-hidden
          />
          <span>
            payout ={' '}
            <strong style={{ color: storyPalette.payoutPositive, fontWeight: 600 }}>
              {fmt(totalPayout)}
            </strong>
          </span>
          {budgetResidual != null && (
            <>
              <span
                style={{
                  width: 1,
                  height: 16,
                  background: storyPalette.surface.border,
                }}
                aria-hidden
              />
              <span data-testid="budget-residual">
                residual = {budgetResidual.toExponential(1)}
              </span>
            </>
          )}
        </>
      )}
    </div>
  );
}
