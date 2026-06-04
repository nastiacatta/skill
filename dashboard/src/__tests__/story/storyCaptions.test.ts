import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import {
  STORY_FRAME_CAPTIONS,
  STORY_STEP_LABELS,
} from '@/components/story/useStoryPipeline';
import StoryForecastPlot from '@/components/story/StoryForecastPlot';
import StoryForecasterCard from '@/components/story/StoryForecasterCard';
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

describe('no em-dashes in captions', () => {
  it('no caption contains an em-dash character', () => {
    for (const caption of STORY_FRAME_CAPTIONS) {
      expect(caption).not.toContain('—');
    }
  });

  it('no step label contains an em-dash character', () => {
    for (const label of STORY_STEP_LABELS) {
      expect(label).not.toContain('—');
    }
  });
});

describe('forecaster card exposes quantile forecast', () => {
  it('renders a quantile mini-fan at step >= 1', () => {
    const { container } = render(
      createElement(StoryForecasterCard, {
        forecasterIndex: 0,
        label: 'F1',
        colour: '#1d3461',
        frame: 3,
        step: 1,
        participated: true,
        sigma: 0.85,
        depositPre: 1.0,
        depositPost: 0.8,
        effectiveWager: 0.8,
        quantileFan: [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65],
        score: 0.7,
        payout: 0.82,
        isPinned: false,
        isActive: false,
        isDimmed: false,
        onSelect: () => {},
      }),
    );
    const fanEl = container.querySelector('[data-testid="forecaster-mini-fan"]');
    expect(fanEl).not.toBeNull();
    expect(fanEl!.textContent).toContain('Quantile forecast');
  });

  it('does not render quantile mini-fan at step 0', () => {
    const { container } = render(
      createElement(StoryForecasterCard, {
        forecasterIndex: 0,
        label: 'F1',
        colour: '#1d3461',
        frame: 0,
        step: 0,
        participated: true,
        sigma: 0.85,
        depositPre: 1.0,
        depositPost: 0.8,
        effectiveWager: 0.8,
        quantileFan: [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65],
        score: 0.7,
        payout: 0.82,
        isPinned: false,
        isActive: false,
        isDimmed: false,
        onSelect: () => {},
      }),
    );
    const fanEl = container.querySelector('[data-testid="forecaster-mini-fan"]');
    expect(fanEl).toBeNull();
  });
});

describe('forecast plot renders forecaster ribbons with labels', () => {
  it('renders a ribbon for every active forecaster at frame 3+', () => {
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
    for (let i = 0; i < 6; i++) {
      const ribbon = container.querySelector(
        `[data-testid="forecaster-ribbon-${i}"]`,
      );
      expect(ribbon).not.toBeNull();
    }
  });

  it('does not render ribbons before frame 3', () => {
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 2 as StoryFrameIndex,
        fan: MOCK_FAN,
        rHatQ: MOCK_RHATQ,
        y: 0.5,
        scores: MOCK_SCORES,
        forecasterCount: 6,
        participated: MOCK_PARTICIPATED,
      }),
    );
    const ribbon = container.querySelector(
      '[data-testid="forecaster-ribbon-0"]',
    );
    expect(ribbon).toBeNull();
  });
});
