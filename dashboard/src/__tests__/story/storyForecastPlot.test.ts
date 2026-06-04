/**
 * Tests for StoryForecastPlot: verifies SVG dimensions, progressive reveal,
 * and quantile ribbon rendering.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import StoryForecastPlot from '@/components/story/StoryForecastPlot';
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

describe('StoryForecastPlot', () => {
  it('renders an SVG with viewBox at least 800x400 at default dimensions', () => {
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
    const vb = svg!.getAttribute('viewBox')!.split(' ').map(Number);
    expect(vb[2]).toBeGreaterThanOrEqual(800);
    expect(vb[3]).toBeGreaterThanOrEqual(400);
  });

  it('renders an SVG with minWidth 640 and minHeight 320', () => {
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 3 as StoryFrameIndex,
        fan: MOCK_FAN,
        rHatQ: MOCK_RHATQ,
        y: 0.5,
        scores: MOCK_SCORES,
        forecasterCount: 6,
        participated: MOCK_PARTICIPATED,
        width: 640,
        height: 320,
      }),
    );
    const svg = container.querySelector('svg');
    expect(svg).not.toBeNull();
    expect(svg!.style.minWidth).toBe('640px');
    expect(svg!.style.minHeight).toBe('320px');
  });

  it('has a viewBox of 0 0 900 440 at default size', () => {
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 4 as StoryFrameIndex,
        fan: MOCK_FAN,
        rHatQ: MOCK_RHATQ,
        y: 0.5,
        scores: MOCK_SCORES,
        forecasterCount: 6,
        participated: MOCK_PARTICIPATED,
      }),
    );
    const svg = container.querySelector('svg');
    expect(svg!.getAttribute('viewBox')).toBe('0 0 900 440');
  });

  it('renders axis labels including 0.0 and 1.0', () => {
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 0 as StoryFrameIndex,
        fan: [],
        rHatQ: [],
        y: 0,
        scores: [],
        forecasterCount: 6,
        participated: [],
      }),
    );
    const texts = Array.from(container.querySelectorAll('text'));
    const labels = texts.map((t) => t.textContent);
    expect(labels).toContain('0.0');
    expect(labels).toContain('1.0');
    expect(labels).toContain('normalised wind power');
  });

  it('does not render forecaster ribbons before frame 3', () => {
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
    const ribbons = container.querySelectorAll('[data-testid^="forecaster-ribbon-"]');
    expect(ribbons.length).toBe(0);
  });

  it('renders one ribbon per active forecaster at frame 3', () => {
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
    const ribbons = container.querySelectorAll('[data-testid^="forecaster-ribbon-"]');
    expect(ribbons.length).toBe(6);
  });

  it('renders aggregate ribbon at frame 3', () => {
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
    const agg = container.querySelector('[data-testid="aggregate-ribbon"]');
    expect(agg).not.toBeNull();
  });

  it('does not render outcome marker before frame 4', () => {
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
    const lines = container.querySelectorAll('line');
    const dashedLines = Array.from(lines).filter(
      (l) => l.getAttribute('stroke-dasharray') === '5 3',
    );
    expect(dashedLines.length).toBe(0);
  });

  it('renders outcome marker at frame 4', () => {
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 4 as StoryFrameIndex,
        fan: MOCK_FAN,
        rHatQ: MOCK_RHATQ,
        y: 0.5,
        scores: MOCK_SCORES,
        forecasterCount: 6,
        participated: MOCK_PARTICIPATED,
      }),
    );
    const lines = container.querySelectorAll('line');
    const dashedLines = Array.from(lines).filter(
      (l) => l.getAttribute('stroke-dasharray') === '5 3',
    );
    expect(dashedLines.length).toBe(1);
  });

  it('skips non-participating forecasters in the ribbon layout', () => {
    const partialParticipation = [true, true, false, true, false, true];
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 3 as StoryFrameIndex,
        fan: MOCK_FAN,
        rHatQ: MOCK_RHATQ,
        y: 0.5,
        scores: MOCK_SCORES,
        forecasterCount: 6,
        participated: partialParticipation,
      }),
    );
    const ribbons = container.querySelectorAll('[data-testid^="forecaster-ribbon-"]');
    expect(ribbons.length).toBe(4);
  });
});
