import type { StoryFrameData } from './useStoryPipeline';
import { storyPalette } from './storyPalette';
import StoryForecastPlot from './StoryForecastPlot';

export interface StoryTaskTileProps {
  frame: StoryFrameData['frame'];
  round: number;
  totalRounds: number;
  rHatQ: number[];
  y: number;
  fan?: number[][];
  scores?: number[];
  participated?: boolean[];
  forecasterCount?: number;
}

export default function StoryTaskTile({
  frame,
  round,
  totalRounds,
  rHatQ,
  y,
  fan = [],
  scores = [],
  participated = [],
  forecasterCount = 6,
}: StoryTaskTileProps) {
  return (
    <div
      style={{
        background: storyPalette.surface.tile,
        border: `1px solid ${storyPalette.surface.border}`,
        borderLeft: `3px solid ${storyPalette.pool.stroke}`,
        borderRadius: 4,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 8 }}>
        <p
          className="eyebrow"
          style={{ color: storyPalette.pool.stroke, margin: 0 }}
        >
          Task
        </p>
        <span
          style={{
            fontSize: 13,
            color: storyPalette.text.muted,
            fontFamily: 'var(--font-mono)',
          }}
        >
          round {round + 1} of {totalRounds}
        </span>
      </div>

      <div
        className="font-serif"
        style={{
          fontSize: 17,
          fontWeight: 600,
          color: storyPalette.text.body,
          lineHeight: 1.3,
          marginBottom: 8,
        }}
      >
        Tomorrow&rsquo;s wind power
      </div>

      <div className="story-forecast-plot-container" style={{ flex: 1, minWidth: 0 }}>
        <StoryForecastPlot
          frame={frame}
          fan={fan}
          rHatQ={rHatQ}
          y={y}
          scores={scores}
          participated={participated}
          forecasterCount={forecasterCount}
          width={800}
          height={400}
        />
      </div>
    </div>
  );
}
