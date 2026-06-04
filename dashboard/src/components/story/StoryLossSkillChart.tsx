import { useState, useMemo } from 'react';
import { storyPalette, forecasterColour } from './storyPalette';

export interface LossSkillRound {
  loss: number;
  sigma: number;
}

export interface StoryLossSkillChartProps {
  histories: LossSkillRound[][];
  currentRound: number;
  forecasterCount: number;
}

const WIDTH = 360;
const HEIGHT = 140;
const MARGIN = { top: 24, right: 12, bottom: 24, left: 36 };

export default function StoryLossSkillChart({
  histories,
  currentRound,
  forecasterCount,
}: StoryLossSkillChartProps) {
  const [activeForecaster, setActiveForecaster] = useState<number>(0);

  const history = histories[activeForecaster] ?? [];
  const n = history.length;

  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = HEIGHT - MARGIN.top - MARGIN.bottom;

  const { lossMax, sigmaMin, sigmaMax } = useMemo(() => {
    let lMax = 0.5;
    let sMin = 1;
    let sMax = 0;
    for (const h of histories) {
      for (const r of h) {
        if (r.loss > lMax) lMax = r.loss;
        if (r.sigma < sMin) sMin = r.sigma;
        if (r.sigma > sMax) sMax = r.sigma;
      }
    }
    return { lossMax: lMax, sigmaMin: sMin, sigmaMax: sMax };
  }, [histories]);

  const xOf = (i: number) => MARGIN.left + (n > 1 ? (i / (n - 1)) * plotW : plotW / 2);
  const yLoss = (v: number) => MARGIN.top + plotH - (v / (lossMax || 1)) * plotH;
  const ySigma = (v: number) => MARGIN.top + plotH - ((v - sigmaMin) / ((sigmaMax - sigmaMin) || 1)) * plotH;

  const lossPath = history
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yLoss(r.loss).toFixed(1)}`)
    .join(' ');

  const sigmaPath = history
    .map((r, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${ySigma(r.sigma).toFixed(1)}`)
    .join(' ');

  const dotIdx = Math.min(currentRound, n - 1);
  const colour = forecasterColour(activeForecaster);

  return (
    <div data-testid="loss-skill-chart" style={{ width: '100%', maxWidth: WIDTH }}>
      {/* Forecaster selector tabs */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          marginBottom: 4,
          flexWrap: 'wrap',
        }}
      >
        {Array.from({ length: forecasterCount }).map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveForecaster(i)}
            onMouseEnter={() => setActiveForecaster(i)}
            aria-label={`Show forecaster F${i + 1}`}
            style={{
              width: 20,
              height: 16,
              borderRadius: 3,
              border: activeForecaster === i
                ? `2px solid ${forecasterColour(i)}`
                : `1px solid ${storyPalette.surface.border}`,
              background: activeForecaster === i ? forecasterColour(i) : 'transparent',
              cursor: 'pointer',
              fontSize: 8,
              fontWeight: 700,
              color: activeForecaster === i ? '#fff' : storyPalette.text.muted,
              padding: 0,
              fontFamily: 'var(--font-sans, sans-serif)',
            }}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto' }}
        role="img"
        aria-label="loss and skill co-evolution chart"
      >
        {/* Plot background */}
        <rect
          x={MARGIN.left}
          y={MARGIN.top}
          width={plotW}
          height={plotH}
          fill={storyPalette.surface.page}
          stroke={storyPalette.surface.border}
          strokeWidth={0.5}
        />

        {/* Loss line (dashed) */}
        {n > 1 && (
          <path
            d={lossPath}
            fill="none"
            stroke={storyPalette.payoutNegative}
            strokeWidth={1.5}
            strokeDasharray="3 2"
            opacity={0.8}
          />
        )}

        {/* Sigma line (solid) */}
        {n > 1 && (
          <path
            d={sigmaPath}
            fill="none"
            stroke={colour}
            strokeWidth={1.8}
            opacity={0.9}
          />
        )}

        {/* Current-round markers */}
        {n > 0 && (
          <>
            <circle
              cx={xOf(dotIdx)}
              cy={yLoss(history[dotIdx].loss)}
              r={3}
              fill={storyPalette.payoutNegative}
              stroke={storyPalette.surface.tile}
              strokeWidth={1}
            />
            <circle
              cx={xOf(dotIdx)}
              cy={ySigma(history[dotIdx].sigma)}
              r={3}
              fill={colour}
              stroke={storyPalette.surface.tile}
              strokeWidth={1}
            />
          </>
        )}

        {/* Y-axis labels */}
        <text
          x={MARGIN.left - 4}
          y={MARGIN.top + 4}
          textAnchor="end"
          fontSize={8}
          fill={colour}
          fontFamily="var(--font-mono, monospace)"
        >
          σ
        </text>
        <text
          x={WIDTH - MARGIN.right + 2}
          y={MARGIN.top + 4}
          textAnchor="start"
          fontSize={8}
          fill={storyPalette.payoutNegative}
          fontFamily="var(--font-mono, monospace)"
        >
          L
        </text>

        {/* X-axis label */}
        <text
          x={MARGIN.left + plotW / 2}
          y={HEIGHT - 4}
          textAnchor="middle"
          fontSize={9}
          fill={storyPalette.text.muted}
          fontFamily="var(--font-sans, sans-serif)"
        >
          round
        </text>
      </svg>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: 12,
          fontSize: 9,
          color: storyPalette.text.muted,
          fontFamily: 'var(--font-sans, sans-serif)',
          padding: '2px 0 0',
        }}
      >
        <span>
          <span style={{ color: colour, fontWeight: 700 }}>&#x2014;</span> σ (skill)
        </span>
        <span>
          <span style={{ color: storyPalette.payoutNegative, fontWeight: 700 }}>- -</span> L (EWMA loss)
        </span>
      </div>
    </div>
  );
}
