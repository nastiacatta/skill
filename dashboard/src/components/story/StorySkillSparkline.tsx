import { storyPalette } from './storyPalette';

export interface StorySkillSparklineProps {
  sigmaHistory: number[];
  currentRound: number;
  colour: string;
  globalMin: number;
  globalMax: number;
  emphasised?: boolean;
  enlarged?: boolean;
}

const WIDTH = 100;
const HEIGHT = 24;
const HEIGHT_ENLARGED = 32;
const PAD_X = 2;
const PAD_Y = 3;

export default function StorySkillSparkline({
  sigmaHistory,
  currentRound,
  colour,
  globalMin,
  globalMax,
  emphasised = false,
  enlarged = false,
}: StorySkillSparklineProps) {
  const n = sigmaHistory.length;
  if (n < 2) return null;

  const h = enlarged ? HEIGHT_ENLARGED : HEIGHT;
  const range = globalMax - globalMin || 1;
  const plotW = WIDTH - PAD_X * 2;
  const plotH = h - PAD_Y * 2;

  const xOf = (i: number) => PAD_X + (i / (n - 1)) * plotW;
  const yOf = (v: number) => PAD_Y + plotH - ((v - globalMin) / range) * plotH;

  const pathD = sigmaHistory
    .map((s, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(s).toFixed(1)}`)
    .join(' ');

  const dotIdx = Math.min(currentRound, n - 1);
  const cx = xOf(dotIdx);
  const cy = yOf(sigmaHistory[dotIdx]);

  return (
    <svg
      width={WIDTH}
      height={h}
      viewBox={`0 0 ${WIDTH} ${h}`}
      role="img"
      aria-label="skill trajectory sparkline"
      data-testid="skill-sparkline"
      style={{
        display: 'block',
        opacity: emphasised ? 1 : 0.6,
        transition: 'opacity 0.15s ease, height 0.2s ease',
      }}
    >
      <path
        d={pathD}
        fill="none"
        stroke={colour}
        strokeWidth={emphasised ? 1.8 : 1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={cx}
        cy={cy}
        r={emphasised ? 3 : 2.5}
        fill={colour}
        stroke={storyPalette.surface.tile}
        strokeWidth={1}
      />
    </svg>
  );
}
