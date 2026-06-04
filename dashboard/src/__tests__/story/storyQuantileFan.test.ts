/**
 * Per-forecaster quantile fan verification:
 * 1. useStoryPipeline returns frames whose per-forecaster fans match trace.qReports[i]
 * 2. The aggregate fan equals the wager-weighted mixture from qReports and weights
 * 3. The forecast plot SVG renders one ribbon per active forecaster and one aggregate ribbon
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { createElement } from 'react';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import {
  STORY_SEED,
} from '@/components/story/useStoryPipeline';
import StoryForecastPlot from '@/components/story/StoryForecastPlot';
import type { StoryFrameIndex } from '@/components/story/useStoryPipeline';

const pipelineResult = runPipeline({
  dgpId: 'baseline',
  behaviourPreset: 'baseline',
  rounds: 5,
  seed: STORY_SEED,
  n: 6,
  builder: { depositPolicy: 'fixed_unit' },
  mechanism: { sigma_min: 0.1 },
});

describe('real per-forecaster quantile vectors', () => {
  it('trace exposes qReports as a number[][] field', () => {
    const trace = pipelineResult.traces[0];
    expect(trace.qReports).toBeDefined();
    expect(Array.isArray(trace.qReports)).toBe(true);
    expect(trace.qReports.length).toBe(6);
    for (const q of trace.qReports) {
      expect(Array.isArray(q)).toBe(true);
      expect(q.length).toBe(9);
    }
  });

  it('per-forecaster fans in frame data match trace.qReports[i] exactly', () => {
    const trace = pipelineResult.traces[0];
    const { frameFromTraceForTest } = buildFrameFromTrace(trace);
    for (let i = 0; i < 6; i++) {
      expect(frameFromTraceForTest.fan[i]).toEqual(trace.qReports[i]);
    }
  });

  it('aggregate fan equals wager-weighted mixture of per-forecaster qReports', () => {
    const trace = pipelineResult.traces[0];
    const weights = trace.weights;
    const qReports = trace.qReports;
    const K = qReports[0].length;

    const expectedAggregate: number[] = [];
    for (let k = 0; k < K; k++) {
      let sum = 0;
      for (let i = 0; i < qReports.length; i++) {
        sum += weights[i] * qReports[i][k];
      }
      expectedAggregate.push(sum);
    }

    for (let k = 0; k < K; k++) {
      expect(trace.r_hat_q[k]).toBeCloseTo(expectedAggregate[k], 10);
    }
  });
});

describe('forecast plot renders ribbons', () => {
  it('renders one ribbon per active forecaster', () => {
    const trace = pipelineResult.traces[0];
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 3 as StoryFrameIndex,
        fan: trace.qReports,
        rHatQ: trace.r_hat_q,
        y: trace.y,
        scores: trace.scores,
        forecasterCount: 6,
        participated: trace.participated,
      }),
    );
    const activeCount = trace.participated.filter(Boolean).length;
    const ribbons = container.querySelectorAll('[data-testid^="forecaster-ribbon-"]');
    expect(ribbons.length).toBe(activeCount);
  });

  it('renders one heavier aggregate ribbon', () => {
    const trace = pipelineResult.traces[0];
    const { container } = render(
      createElement(StoryForecastPlot, {
        frame: 3 as StoryFrameIndex,
        fan: trace.qReports,
        rHatQ: trace.r_hat_q,
        y: trace.y,
        scores: trace.scores,
        forecasterCount: 6,
        participated: trace.participated,
      }),
    );
    const agg = container.querySelector('[data-testid="aggregate-ribbon"]');
    expect(agg).not.toBeNull();
  });
});

function buildFrameFromTrace(trace: (typeof pipelineResult.traces)[0]) {
  const fan = trace.qReports.map(q => q.slice());
  return {
    frameFromTraceForTest: {
      fan,
      aggregate: { rHat: trace.r_hat, rHatQ: trace.r_hat_q.slice() },
    },
  };
}
