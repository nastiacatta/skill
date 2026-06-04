import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import {
  STORY_FRAME_CAPTIONS,
  STORY_STEP_LABELS,
} from '@/components/story/useStoryPipeline';
import StoryForecastPlot from '@/components/story/StoryForecastPlot';
import StoryDepositChip from '@/components/story/StoryDepositChip';
import type { StoryFrameIndex } from '@/components/story/useStoryPipeline';

const MOCK_FAN: number[][] = [
  [0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60],
  [0.30, 0.35, 0.40, 0.42, 0.45, 0.48, 0.52, 0.58, 0.62],
  [0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80],
  [0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75],
  [0.25, 0.30, 0.35, 0.38, 0.40, 0.42, 0.45, 0.50, 0.55],
  [0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80, 0.85, 0.90],
];
const MOCK_RHATQ = [0.33, 0.37, 0.42, 0.47, 0.52, 0.55, 0.60, 0.65, 0.70];
const MOCK_SCORES = [0.8, 0.6, 0.3, 0.7, 0.5, 0.2];
const MOCK_PARTICIPATED = [true, true, true, true, true, true];

describe('captions match thesis vocabulary', () => {
  const EXPECTED_CAPTIONS = [
    "A grid operator posts a forecasting task: what is tomorrow's wind power?",
    'Each forecaster submits a quantile forecast and a deposit, staking wealth on their answer.',
    'The skill gate rescales each deposit into an effective wager; weaker forecasters risk less.',
    'Reports are combined by wager-weighted averaging into a single aggregate distribution.',
    'The outcome is observed. The dashed line marks the realised value.',
    'Each report is scored against the outcome by the pinball CRPS, a strictly proper rule.',
    'The pool redistributes by relative score; the EWMA skill estimate updates for the next round.',
  ];

  it('captions match thesis vocabulary', () => {
    expect(STORY_FRAME_CAPTIONS).toEqual(EXPECTED_CAPTIONS);
  });

  it('step labels are Submit, Deposit, Gate, Aggregate, Outcome, Score, Settle', () => {
    expect(STORY_STEP_LABELS).toEqual([
      'Submit', 'Deposit', 'Gate', 'Aggregate', 'Outcome', 'Score', 'Settle',
    ]);
  });
});

describe('deposit chip and wager chip colours', () => {
  const FORECASTER_COLOUR = '#1d3461';

  it('renders deposit chip in grey at step 1 (deposit step)', () => {
    const { container } = render(
      createElement(StoryDepositChip, {
        depositPre: 1.0,
        effectiveWager: 0.8,
        forecasterColour: FORECASTER_COLOUR,
        step: 1,
      }),
    );
    const textContent = container.textContent;
    expect(textContent).toContain('Deposit');
    expect(textContent).not.toContain('Wager');
  });

  it('renders wager chip in forecaster colour at step 2 (gate step)', () => {
    const { container } = render(
      createElement(StoryDepositChip, {
        depositPre: 1.0,
        effectiveWager: 0.8,
        forecasterColour: FORECASTER_COLOUR,
        step: 2,
      }),
    );
    const textContent = container.textContent;
    expect(textContent).toContain('Wager');
    expect(textContent).not.toContain('Deposit');
  });

  it('shows refund ghost at step 2 when wager < deposit', () => {
    const { container } = render(
      createElement(StoryDepositChip, {
        depositPre: 1.0,
        effectiveWager: 0.6,
        forecasterColour: FORECASTER_COLOUR,
        step: 2,
      }),
    );
    const textContent = container.textContent;
    expect(textContent).toContain('Wager');
    expect(textContent).toContain('0.40');
  });

  it('does not render anything at step 0', () => {
    const { container } = render(
      createElement(StoryDepositChip, {
        depositPre: 1.0,
        effectiveWager: 0.8,
        forecasterColour: FORECASTER_COLOUR,
        step: 0,
      }),
    );
    expect(container.textContent).toBe('');
  });
});

describe('forecast plot minimum width at 1440px breakpoint', () => {
  it('forecast plot SVG renders with viewBox width >= 800 (1440px spec)', () => {
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 3 as StoryFrameIndex,
        fan: MOCK_FAN,
        rHatQ: MOCK_RHATQ,
        y: 0.5,
        scores: MOCK_SCORES,
        forecasterCount: 6,
        participated: MOCK_PARTICIPATED,
        width: 800,
        height: 400,
      }),
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    const viewBox = svg!.getAttribute('viewBox');
    const [, , vbWidth] = viewBox!.split(' ').map(Number);
    expect(vbWidth).toBeGreaterThanOrEqual(800);
    expect(svg!.style.minWidth).toBe('640px');
  });

  it('forecast plot uses 100% width for responsive scaling', () => {
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 3 as StoryFrameIndex,
        fan: MOCK_FAN,
        rHatQ: MOCK_RHATQ,
        y: 0.5,
        scores: MOCK_SCORES,
        forecasterCount: 6,
        participated: MOCK_PARTICIPATED,
      }),
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.style.width).toBe('100%');
  });
});
