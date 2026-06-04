import { storyPalette } from './storyPalette';

export interface StoryForecasterCardProps {
  forecasterIndex: number;
  label: string;
  colour: string;
  frame: number;
  step: number;
  participated: boolean;
  sigma: number;
  depositPre: number;
  depositPost: number;
  effectiveWager: number;
  quantileFan: number[];
  score: number;
  payout: number;
  isPinned: boolean;
  isActive: boolean;
  isDimmed: boolean;
  onSelect: () => void;
  isHovered?: boolean;
  onHover?: (index: number | null) => void;
}

function fmt(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return '.';
  return value.toFixed(digits);
}

function MiniFan({ quantiles, colour }: { quantiles: number[]; colour: string }) {
  if (quantiles.length < 2) return null;
  const w = 80;
  const h = 14;
  const q10 = quantiles[0];
  const q50 = quantiles[Math.floor(quantiles.length / 2)];
  const q90 = quantiles[quantiles.length - 1];
  const xOf = (v: number) => Math.max(0, Math.min(1, v)) * w;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label="quantile fan">
      <rect
        x={xOf(q10)}
        y={2}
        width={Math.max(0, xOf(q90) - xOf(q10))}
        height={h - 4}
        rx={2}
        fill={colour}
        opacity={0.2}
      />
      <rect
        x={xOf(q10)}
        y={2}
        width={Math.max(0, xOf(q90) - xOf(q10))}
        height={h - 4}
        rx={2}
        fill="none"
        stroke={colour}
        strokeWidth={1}
      />
      <line
        x1={xOf(q50)}
        x2={xOf(q50)}
        y1={1}
        y2={h - 1}
        stroke={colour}
        strokeWidth={2}
      />
    </svg>
  );
}

export default function StoryForecasterCard({
  forecasterIndex,
  label,
  colour,
  step,
  participated,
  sigma,
  depositPre,
  effectiveWager,
  quantileFan,
  score,
  payout,
  isPinned,
  isActive,
  isDimmed,
  onSelect,
  isHovered = false,
  onHover,
}: StoryForecasterCardProps) {
  const inactive = !participated;
  const showDeposit = step >= 1;
  const showWager = step >= 2;
  const showFan = step >= 1;
  const showScore = step >= 5;
  const showPayout = step >= 6;
  const scorePositive = score >= 0.5;
  const ratio = depositPre > 0 ? effectiveWager / depositPre : 1;

  const accent = inactive ? storyPalette.inactive : colour;
  const highlighted = isActive || isHovered;

  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => onHover?.(forecasterIndex)}
      onMouseLeave={() => onHover?.(null)}
      aria-pressed={isPinned}
      aria-label={`Forecaster ${label}`}
      className="text-left transition-colors"
      data-testid={`forecaster-card-${forecasterIndex}`}
      style={{
        background: storyPalette.surface.tile,
        border: 'none',
        borderTop: `3px solid ${accent}`,
        borderRadius: 8,
        padding: '12px 14px',
        opacity: inactive ? 0.5 : isDimmed ? 0.55 : 1,
        cursor: 'pointer',
        width: '100%',
        outline: 'none',
        boxShadow: isPinned
          ? `0 2px 12px rgba(27, 42, 74, 0.18), 0 0 0 2.5px ${accent}`
          : highlighted
            ? `0 2px 12px rgba(27, 42, 74, 0.14), 0 0 0 2px ${accent}`
            : '0 1px 6px rgba(27, 42, 74, 0.07)',
        transition: 'box-shadow 0.15s ease, opacity 0.15s ease',
        minWidth: 130,
      }}
    >
      {/* 1. Header: badge + sigma */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <span
          aria-hidden
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            background: accent,
            color: storyPalette.surface.page,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 11,
            fontWeight: 700,
            fontFamily: 'var(--font-sans)',
            letterSpacing: '0.02em',
            flexShrink: 0,
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.18)',
          }}
        >
          {label}
        </span>
        {showWager && (
          <span
            className="tabular-nums"
            style={{
              fontSize: 11,
              color: storyPalette.text.muted,
              fontFamily: 'var(--font-mono)',
            }}
          >
            {'σ'} {fmt(sigma, 2)}
          </span>
        )}
      </div>

      {/* 2. Deposit bar */}
      {showDeposit && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div
            style={{
              flex: 1,
              height: 18,
              borderRadius: 9,
              background: storyPalette.surface.border,
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
            }}
          >
            <span
              className="tabular-nums"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: storyPalette.text.body,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Deposit {fmt(depositPre)}
            </span>
          </div>
        </div>
      )}

      {/* 3. Wager bar */}
      {showWager && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <div
            style={{
              width: `${Math.max(ratio * 100, 30)}%`,
              height: 18,
              borderRadius: 9,
              background: accent,
              display: 'flex',
              alignItems: 'center',
              padding: '0 8px',
              transition: 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
            }}
          >
            <span
              className="tabular-nums"
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: storyPalette.surface.page,
                whiteSpace: 'nowrap',
                fontFamily: 'var(--font-mono)',
              }}
            >
              Wager {fmt(effectiveWager)}
            </span>
          </div>
          <span
            style={{
              fontSize: 10,
              color: storyPalette.text.muted,
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            = dep {'×'} g({'σ'})
          </span>
        </div>
      )}

      {/* 4. Quantile forecast mini-fan */}
      {showFan && quantileFan.length > 0 && (
        <div
          data-testid="forecaster-mini-fan"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 4,
          }}
        >
          <span
            style={{
              fontSize: 9,
              fontWeight: 500,
              color: storyPalette.text.muted,
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}
          >
            Quantile forecast
          </span>
          <MiniFan quantiles={quantileFan} colour={colour} />
        </div>
      )}

      {/* 5. Score / payout chip */}
      {(showScore || showPayout) && (
        <div
          style={{
            marginTop: 4,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
          }}
        >
          {showScore && (
            <span
              className="font-mono tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 999,
                background: scorePositive
                  ? storyPalette.scoreBadge.positive.bg
                  : storyPalette.scoreBadge.negative.bg,
                color: scorePositive
                  ? storyPalette.scoreBadge.positive.fg
                  : storyPalette.scoreBadge.negative.fg,
              }}
            >
              {fmt(score, 2)}
            </span>
          )}
          {showPayout && (
            <span
              className="font-mono tabular-nums"
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: storyPalette.text.body,
              }}
            >
              {'π'} {fmt(payout, 2)}
            </span>
          )}
        </div>
      )}

      {inactive && (
        <span
          style={{
            fontSize: 10,
            color: storyPalette.text.muted,
            fontStyle: 'italic',
            marginTop: 6,
            display: 'block',
          }}
        >
          out
        </span>
      )}
    </button>
  );
}
