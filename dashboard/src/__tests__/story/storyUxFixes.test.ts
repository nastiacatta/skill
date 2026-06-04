import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { createElement } from 'react';
import {
  STORY_FRAME_CAPTIONS,
} from '@/components/story/useStoryPipeline';
import StoryForecasterCard from '@/components/story/StoryForecasterCard';
import StoryContextStrip from '@/components/story/StoryContextStrip';
import StoryControls from '@/components/story/StoryControls';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { STORY_SEED } from '@/components/story/useStoryPipeline';
import * as fs from 'fs';
import * as path from 'path';

afterEach(cleanup);

const trace = runPipeline({
  dgpId: 'baseline',
  behaviourPreset: 'baseline',
  rounds: 5,
  seed: STORY_SEED,
  n: 6,
  builder: { depositPolicy: 'wealth_fraction' },
  mechanism: { sigma_min: 0.2 },
});

describe('wager suffix uses g(sigma)', () => {
  it('card renders "= dep x g(sigma)" not "= dep x sigma"', () => {
    const { container } = render(
      createElement(StoryForecasterCard, {
        forecasterIndex: 0,
        label: 'F1',
        colour: '#3b82f6',
        frame: 2,
        step: 2,
        participated: true,
        sigma: 0.6,
        depositPre: 1.0,
        depositPost: 1.0,
        effectiveWager: 0.72,
        quantileFan: [0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65],
        score: 0,
        payout: 0,
        isPinned: false,
        isActive: false,
        isDimmed: false,
        onSelect: () => {},
      }),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('= dep × g(σ)');
    expect(text).not.toMatch(/= dep × σ[^)]/);
  });
});

describe('payout chip shows pi prefix, no misleading +', () => {
  it('payout chip renders pi symbol without + prefix', () => {
    const { container } = render(
      createElement(StoryForecasterCard, {
        forecasterIndex: 0,
        label: 'F1',
        colour: '#3b82f6',
        frame: 7,
        step: 6,
        participated: true,
        sigma: 0.8,
        depositPre: 1.0,
        depositPost: 1.0,
        effectiveWager: 0.86,
        quantileFan: [0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70],
        score: 0.7,
        payout: 1.03,
        isPinned: false,
        isActive: false,
        isDimmed: false,
        onSelect: () => {},
      }),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('π 1.03');
    expect(text).not.toContain('+1.03');
  });
});

describe('sigma_min helper text', () => {
  it('does not use the word "silence" as a verb the user performs', () => {
    const { container } = render(
      createElement(StoryControls, {
        sigmaMin: 0.2,
        onSigmaMinChange: () => {},
        depositPolicy: 'fixed_unit' as const,
        onDepositPolicyChange: () => {},
        sybilSplit: false,
        onSybilSplitChange: () => {},
        isPlaying: false,
        onPlayPause: () => {},
        onStepBack: () => {},
        onStepForward: () => {},
        onRestart: () => {},
      }),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('protects weak forecasters');
    expect(text).not.toContain('silence low-skill');
  });
});

describe('deposit policy label', () => {
  it('renders "Skill-scaled bankroll" for sigma_scaled option', () => {
    const { container } = render(
      createElement(StoryControls, {
        sigmaMin: 0.2,
        onSigmaMinChange: () => {},
        depositPolicy: 'sigma_scaled' as const,
        onDepositPolicyChange: () => {},
        sybilSplit: false,
        onSybilSplitChange: () => {},
        isPlaying: false,
        onPlayPause: () => {},
        onStepBack: () => {},
        onStepForward: () => {},
        onRestart: () => {},
      }),
    );
    const text = container.textContent ?? '';
    expect(text).toContain('Skill-scaled bankroll');
    expect(text).not.toContain('Wealth fraction × skill');
  });
});

describe('forecastDensities comment', () => {
  it('comment mentions 9-level quantile vector, not scalar submission', () => {
    const src = fs.readFileSync(
      path.resolve(
        __dirname,
        '../../components/story/forecastDensities.ts',
      ),
      'utf-8',
    );
    expect(src).toContain('9-level quantile vector');
    expect(src).not.toContain('submits a scalar mean report');
  });
});

describe('budget-balance residual shown at settle step', () => {
  it('renders residual annotation when budgetResidual is provided', () => {
    const round = trace.traces[0];
    const totalPayout = round.totalPayoff.reduce((a, b) => a + b, 0);
    const totalWager = round.effectiveWager.reduce((a, b) => a + b, 0);
    const residual = totalPayout - totalWager;

    const { container } = render(
      createElement(StoryContextStrip, {
        frame: 7,
        forecasterCount: 6,
        totalDeposits: 6,
        totalEffectiveWager: totalWager,
        totalPayout,
        budgetResidual: residual,
      }),
    );
    const el = container.querySelector('[data-testid="budget-residual"]');
    expect(el).not.toBeNull();
    expect(el!.textContent).toContain('residual');
    expect(Math.abs(residual)).toBeLessThan(1e-10);
  });

  it('does not render residual when budgetResidual is omitted', () => {
    const { container } = render(
      createElement(StoryContextStrip, {
        frame: 7,
        forecasterCount: 6,
        totalDeposits: 6,
        totalEffectiveWager: 4.5,
        totalPayout: 4.5,
      }),
    );
    const el = container.querySelector('[data-testid="budget-residual"]');
    expect(el).toBeNull();
  });
});

describe('step 2 caption says "quantile forecast"', () => {
  it('caption at index 1 contains "quantile forecast"', () => {
    expect(STORY_FRAME_CAPTIONS[1]).toContain('quantile forecast');
    expect(STORY_FRAME_CAPTIONS[1]).not.toContain('submits a report and');
  });
});

describe('no em-dashes on story surface', () => {
  it('no caption contains an em-dash', () => {
    for (const caption of STORY_FRAME_CAPTIONS) {
      expect(caption).not.toContain('—');
    }
  });
});
