import type { StoryFrameIndex } from './useStoryPipeline';
import { storyPalette, forecasterColour } from './storyPalette';

export interface StoryForecastPlotProps {
  frame: StoryFrameIndex;
  fan: number[][];
  rHatQ: number[];
  y: number;
  scores: number[];
  forecasterCount: number;
  participated: boolean[];
  forecasterColours?: string[];
  aggregateColour?: string;
  width?: number;
  height?: number;
  hoveredForecaster?: number | null;
  pinnedForecaster?: number | null;
  onForecasterHover?: (index: number | null) => void;
  onForecasterClick?: (index: number) => void;
  sybilSplit?: boolean;
}

const DEFAULT_WIDTH = 900;
const DEFAULT_HEIGHT = 440;
const MARGIN = { top: 40, right: 32, bottom: 56, left: 56 };

const AXIS_TICKS = [0, 0.25, 0.5, 0.75, 1.0];
const AXIS_LABELS = ['0.0', '0.25', '0.5', '0.75', '1.0'];

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

function forecasterLabel(index: number, sybilSplit: boolean): string {
  if (!sybilSplit) return `F${index + 1}`;
  if (index === 1) return 'F2a';
  if (index === 2) return 'F2b';
  if (index < 1) return `F${index + 1}`;
  return `F${index}`;
}

export default function StoryForecastPlot({
  frame,
  fan,
  rHatQ,
  y,
  scores,
  forecasterCount,
  participated,
  forecasterColours,
  aggregateColour,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  hoveredForecaster = null,
  pinnedForecaster = null,
  onForecasterHover,
  onForecasterClick,
  sybilSplit = false,
}: StoryForecastPlotProps) {
  const plotW = width - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const aggColour = aggregateColour ?? storyPalette.aggregate.line;

  const showForecasts = frame >= 3;
  const showAggregate = frame >= 3;
  const showOutcome = frame >= 4;
  const showScores = frame >= 5;

  const activeCount = participated.slice(0, forecasterCount).filter(Boolean).length;
  const slotHeight = activeCount > 0 ? plotH / activeCount : plotH;
  const ribbonHeight = Math.min(slotHeight * 0.6, 36);

  const xScale = (v: number) => MARGIN.left + clamp01(v) * plotW;

  const getColour = (i: number): string =>
    forecasterColours?.[i] ?? forecasterColour(i);

  const slotOf = (i: number): number => {
    let slot = 0;
    for (let j = 0; j < i; j++) {
      if (participated[j]) slot++;
    }
    return slot;
  };

  const slotY = (slot: number): number =>
    MARGIN.top + slot * slotHeight + slotHeight / 2;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="forecast distribution plot"
      style={{ width: '100%', height: 'auto', minWidth: 640, minHeight: 320 }}
      data-testid="story-forecast-plot"
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

      {/* Vertical grid lines at axis ticks */}
      {AXIS_TICKS.map((tick) => {
        const x = xScale(tick);
        return (
          <line
            key={`vgrid-${tick}`}
            x1={x}
            x2={x}
            y1={MARGIN.top}
            y2={MARGIN.top + plotH}
            stroke={storyPalette.surface.border}
            strokeWidth={0.5}
            opacity={0.6}
          />
        );
      })}

      {/* X-axis ticks + labels */}
      {AXIS_TICKS.map((tick, i) => {
        const x = xScale(tick);
        return (
          <g key={tick}>
            <line
              x1={x}
              x2={x}
              y1={MARGIN.top + plotH}
              y2={MARGIN.top + plotH + 6}
              stroke={storyPalette.text.muted}
              strokeWidth={1}
            />
            <text
              x={x}
              y={MARGIN.top + plotH + 22}
              textAnchor="middle"
              fontSize={14}
              fill={storyPalette.text.body}
              fontFamily="var(--font-mono, monospace)"
            >
              {AXIS_LABELS[i]}
            </text>
          </g>
        );
      })}

      {/* X-axis title */}
      <text
        x={MARGIN.left + plotW / 2}
        y={height - 10}
        textAnchor="middle"
        fontSize={14}
        fill={storyPalette.text.body}
        fontFamily="var(--font-sans, sans-serif)"
        fontWeight={500}
      >
        normalised wind power
      </text>

      {/* Y-axis title */}
      <text
        x={16}
        y={MARGIN.top + plotH / 2}
        textAnchor="middle"
        fontSize={13}
        fill={storyPalette.text.muted}
        fontFamily="var(--font-sans, sans-serif)"
        transform={`rotate(-90, 16, ${MARGIN.top + plotH / 2})`}
      >
        forecaster
      </text>

      {/* Per-forecaster quantile ribbons */}
      {showForecasts &&
        Array.from({ length: forecasterCount }).map((_, i) => {
          if (!participated[i]) return null;
          const q = fan[i];
          if (!q || q.length < 2) return null;

          const slot = slotOf(i);
          const cy = slotY(slot);
          const q10 = q[0];
          const q50 = q[Math.floor(q.length / 2)];
          const q90 = q[q.length - 1];

          const x1 = xScale(q10);
          const x2 = xScale(q90);
          const xMed = xScale(q50);
          const yTop = cy - ribbonHeight / 2;

          const isHovered = hoveredForecaster === i;
          const isPinned = pinnedForecaster === i;
          const dimmed = hoveredForecaster != null && !isHovered && !isPinned;

          return (
            <g
              key={`fan-${i}`}
              data-testid={`forecaster-ribbon-${i}`}
              style={{ cursor: 'pointer', transition: 'opacity 0.15s ease' }}
              opacity={isHovered || isPinned ? 1 : dimmed ? 0.3 : 0.85}
              onMouseEnter={() => onForecasterHover?.(i)}
              onMouseLeave={() => onForecasterHover?.(null)}
              onClick={() => onForecasterClick?.(i)}
            >
              {/* q10..q90 ribbon */}
              <rect
                x={x1}
                y={yTop}
                width={Math.max(0, x2 - x1)}
                height={ribbonHeight}
                rx={3}
                fill={getColour(i)}
                opacity={0.25}
              />
              {/* q10..q90 border */}
              <rect
                x={x1}
                y={yTop}
                width={Math.max(0, x2 - x1)}
                height={ribbonHeight}
                rx={3}
                fill="none"
                stroke={getColour(i)}
                strokeWidth={isHovered || isPinned ? 2 : 1}
              />
              {/* Median tick */}
              <line
                x1={xMed}
                x2={xMed}
                y1={yTop}
                y2={yTop + ribbonHeight}
                stroke={getColour(i)}
                strokeWidth={2.5}
              />
              {/* Forecaster label */}
              <text
                x={MARGIN.left + 6}
                y={cy + 4}
                fontSize={11}
                fontWeight={600}
                fill={getColour(i)}
                fontFamily="var(--font-sans, sans-serif)"
              >
                {forecasterLabel(i, sybilSplit)}
              </text>
            </g>
          );
        })}

      {/* Aggregate forecast ribbon (heavier, on top of individual fans) */}
      {showAggregate && rHatQ.length >= 2 && (
        (() => {
          const q10 = rHatQ[0];
          const q50 = rHatQ[Math.floor(rHatQ.length / 2)];
          const q90 = rHatQ[rHatQ.length - 1];
          const x1 = xScale(q10);
          const x2 = xScale(q90);
          const xMed = xScale(q50);
          const aggY = MARGIN.top + plotH + 32;
          const aggH = 14;

          return (
            <g data-testid="aggregate-ribbon">
              {/* Aggregate background band spanning the full plot height as subtle highlight */}
              <rect
                x={x1}
                y={MARGIN.top}
                width={Math.max(0, x2 - x1)}
                height={plotH}
                fill={storyPalette.aggregate.band}
                opacity={0.15}
              />
              {/* Aggregate median line spanning full height */}
              <line
                x1={xMed}
                x2={xMed}
                y1={MARGIN.top}
                y2={MARGIN.top + plotH}
                stroke={aggColour}
                strokeWidth={3}
                opacity={0.8}
              />
              {/* Aggregate ribbon below plot */}
              <rect
                x={x1}
                y={aggY}
                width={Math.max(0, x2 - x1)}
                height={aggH}
                rx={3}
                fill={aggColour}
                opacity={0.35}
              />
              <rect
                x={x1}
                y={aggY}
                width={Math.max(0, x2 - x1)}
                height={aggH}
                rx={3}
                fill="none"
                stroke={aggColour}
                strokeWidth={2}
              />
              <line
                x1={xMed}
                x2={xMed}
                y1={aggY}
                y2={aggY + aggH}
                stroke={aggColour}
                strokeWidth={3}
              />
              <text
                x={MARGIN.left + 6}
                y={aggY + aggH / 2 + 4}
                fontSize={11}
                fontWeight={700}
                fill={aggColour}
                fontFamily="var(--font-sans, sans-serif)"
              >
                Aggregate forecast
              </text>
            </g>
          );
        })()
      )}

      {/* Outcome marker (dashed vertical line, rendered last to sit on top) */}
      {showOutcome && (
        <>
          <line
            x1={xScale(y)}
            x2={xScale(y)}
            y1={MARGIN.top}
            y2={MARGIN.top + plotH}
            stroke={storyPalette.outcome}
            strokeWidth={2.5}
            strokeDasharray="5 3"
          />
          <text
            x={xScale(y) + 8}
            y={MARGIN.top + 20}
            fontSize={13}
            fill={storyPalette.outcome}
            fontFamily="var(--font-mono, monospace)"
            fontWeight={600}
          >
            y = {y.toFixed(2)}
          </text>
        </>
      )}

      {/* Per-forecaster score annotations */}
      {showScores &&
        Array.from({ length: forecasterCount }).map((_, i) => {
          if (!participated[i]) return null;
          const score = scores[i] ?? 0;
          const slot = slotOf(i);
          const cy = slotY(slot);
          const isGood = score >= 0.5;
          return (
            <g key={`score-${i}`}>
              <circle
                cx={MARGIN.left + plotW + 18}
                cy={cy}
                r={6}
                fill={
                  isGood
                    ? storyPalette.scoreBadge.positive.bg
                    : storyPalette.scoreBadge.negative.bg
                }
                stroke={getColour(i)}
                strokeWidth={1.5}
              />
              <text
                x={MARGIN.left + plotW + 18}
                y={cy + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={8}
                fill={
                  isGood
                    ? storyPalette.scoreBadge.positive.fg
                    : storyPalette.scoreBadge.negative.fg
                }
                fontWeight={600}
              >
                {score.toFixed(1)}
              </text>
            </g>
          );
        })}

      {/* X-axis baseline */}
      <line
        x1={MARGIN.left}
        x2={MARGIN.left + plotW}
        y1={MARGIN.top + plotH}
        y2={MARGIN.top + plotH}
        stroke={storyPalette.text.muted}
        strokeWidth={1}
      />

      {/* Y-axis line */}
      <line
        x1={MARGIN.left}
        x2={MARGIN.left}
        y1={MARGIN.top}
        y2={MARGIN.top + plotH}
        stroke={storyPalette.text.muted}
        strokeWidth={1}
      />
    </svg>
  );
}
