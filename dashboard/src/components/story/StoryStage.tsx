import { useMemo } from 'react';
import StoryForecasterCard from './StoryForecasterCard';
import StoryContextStrip from './StoryContextStrip';
import StoryForecastPlot from './StoryForecastPlot';
import { StoryHoverProvider, useStoryHover } from './StoryHoverContext';
import { forecasterColour } from './storyPalette';
import {
  STORY_FRAMES_PER_ROUND,
  STEP_TO_FRAME,
  type FocusZone,
  type StoryFrameData,
} from './useStoryPipeline';

export interface StoryStageProps {
  frames: StoryFrameData[];
  forecasterCount: number;
  totalRounds: number;
  roundIndex: number;
  stepIndex: number;
  sybilSplit: boolean;
  focusZone?: FocusZone;
}

const SYBIL_TWIN_INDEX = 1;

function labelFor(index: number, sybilSplit: boolean): string {
  if (!sybilSplit) {
    return `F${index + 1}`;
  }
  if (index === SYBIL_TWIN_INDEX) return 'F2a';
  if (index === SYBIL_TWIN_INDEX + 1) return 'F2b';
  if (index < SYBIL_TWIN_INDEX) return `F${index + 1}`;
  return `F${index}`;
}

function sumFinite(values: number[]): number {
  return values.reduce((acc, v) => (Number.isFinite(v) ? acc + v : acc), 0);
}

function StoryStageInner({
  frames,
  forecasterCount,
  totalRounds,
  roundIndex,
  stepIndex,
  sybilSplit,
}: StoryStageProps) {
  const {
    hoveredForecaster,
    pinnedForecaster,
    activeForecaster,
    setHoveredForecaster,
    togglePin,
    clearPin,
  } = useStoryHover();

  const safeRound = Math.max(0, Math.min(totalRounds - 1, roundIndex));
  const frameIndex = STEP_TO_FRAME[stepIndex] ?? 0;
  const flatIndex = safeRound * STORY_FRAMES_PER_ROUND + frameIndex;
  const frame = frames[flatIndex] ?? frames[0];

  const totals = useMemo(() => {
    if (!frame) {
      return {
        totalDeposits: 0,
        totalEffectiveWager: 0,
        totalPayout: 0,
        budgetResidual: 0,
      };
    }
    const totalPayout = sumFinite(frame.payout);
    const totalEffectiveWager = sumFinite(frame.effectiveWager);
    return {
      totalDeposits: sumFinite(frame.depositPre),
      totalEffectiveWager,
      totalPayout,
      budgetResidual: totalPayout - totalEffectiveWager,
    };
  }, [frame]);

  if (!frame) {
    return null;
  }

  return (
    <div
      className="story-stage-layout"
      onClick={(e) => {
        if (e.target === e.currentTarget) clearPin();
      }}
    >
      {/* Context strip: pool summary */}
      <StoryContextStrip
        frame={frame.frame}
        forecasterCount={forecasterCount}
        totalDeposits={totals.totalDeposits}
        totalEffectiveWager={totals.totalEffectiveWager}
        totalPayout={totals.totalPayout}
        budgetResidual={stepIndex >= 6 ? totals.budgetResidual : undefined}
      />

      {/* Hero forecast plot with hover integration */}
      <div className="story-plot-hero">
        <StoryForecastPlot
          frame={frame.frame}
          fan={frame.fan.slice(0, forecasterCount)}
          rHatQ={frame.aggregate.rHatQ}
          y={frame.y}
          scores={frame.score}
          forecasterCount={forecasterCount}
          participated={frame.participated.slice(0, forecasterCount)}
          width={900}
          height={440}
          hoveredForecaster={activeForecaster}
          pinnedForecaster={pinnedForecaster}
          onForecasterHover={setHoveredForecaster}
          onForecasterClick={togglePin}
          sybilSplit={sybilSplit}
        />
      </div>

      {/* Forecaster cast, horizontal strip */}
      <div className="story-forecaster-strip">
        {Array.from({ length: forecasterCount }).map((_, i) => (
          <StoryForecasterCard
            key={i}
            forecasterIndex={i}
            label={labelFor(i, sybilSplit)}
            colour={forecasterColour(i)}
            frame={frame.frame}
            step={stepIndex}
            participated={frame.participated[i] ?? false}
            sigma={frame.skillBefore[i] ?? 0}
            depositPre={frame.depositPre[i] ?? 0}
            depositPost={frame.depositPost[i] ?? 0}
            effectiveWager={frame.effectiveWager[i] ?? 0}
            quantileFan={frame.fan[i] ?? []}
            score={frame.score[i] ?? 0}
            payout={frame.payout[i] ?? 0}
            isPinned={pinnedForecaster === i}
            isActive={activeForecaster === i}
            isDimmed={activeForecaster != null && activeForecaster !== i}
            onSelect={() => togglePin(i)}
            isHovered={hoveredForecaster === i}
            onHover={setHoveredForecaster}
          />
        ))}
      </div>
    </div>
  );
}

export { StoryHoverProvider };

export default function StoryStage(props: StoryStageProps) {
  return <StoryStageInner {...props} />;
}
