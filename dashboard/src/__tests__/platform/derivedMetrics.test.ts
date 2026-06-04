import { describe, it, expect } from 'vitest';
import {
  calibrationCurve,
  budgetBalanceResidual,
  rollupForecaster,
  skillGate,
  cumulative,
  bankrollSeries,
  skillSeries,
} from '@/components/platform/derivedMetrics';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import type { RoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

/** A small synthetic run reused across assertions. */
function smallRun(): RoundTrace[] {
  return runPipeline({
    dgpId: 'latent_fixed',
    behaviourPreset: 'baseline',
    rounds: 40,
    seed: 42,
    n: 6,
  }).traces;
}

describe('derivedMetrics — calibration curve', () => {
  it('computes coverage as the fraction of rounds with y ≤ q(τ_k)', () => {
    // Hand-built two-round trace: only check the formula, not the mechanism.
    const mk = (y: number, q: number[]): RoundTrace => ({
      round: 1, y,
      L_prev: [0], sigma_t: [0.5], wealth_before: [20],
      participated: [true], reports: [q[4]], deposits: [1], effectiveWager: [0.5],
      aggregationMass: [0.5], cappedAggregationMass: [0.5], weights: [1],
      r_hat: q[4], r_hat_q: q, qReports: [q],
      losses: [0], scores: [1], skillPayoff: [0.5], utilityPayoff: [0], totalPayoff: [0.5],
      profit: [0], refunds: [0.5], wealth_after: [20], L_new: [0], sigma_new: [0.5],
      activeCount: 1, hhi: 1, nEff: 1, topShare: 1,
    });
    // q = [0.1..0.9]; round A y=0.05 (below all), round B y=0.95 (above all).
    const q = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    const traces = [mk(0.05, q), mk(0.95, q)];
    const curve = calibrationCurve(traces, 0);
    // Round A: y=0.05 ≤ every q_k → +1 each. Round B: y=0.95 ≤ none → +0.
    // So coverage = 1/2 = 0.5 at every level.
    for (const point of curve) {
      expect(point.coverage).toBeCloseTo(0.5, 10);
    }
    expect(curve.map((p) => p.tau)).toEqual([...TAUS]);
  });
});

describe('derivedMetrics — budget balance', () => {
  it('residual Σπ − Σm is at machine precision under skill-only settlement', () => {
    const traces = smallRun();
    for (const t of traces) {
      expect(Math.abs(budgetBalanceResidual(t))).toBeLessThan(1e-9);
    }
  });
});

describe('derivedMetrics — rollup', () => {
  it('skill premium equals pool share minus wager share exactly', () => {
    const traces = smallRun();
    for (let i = 0; i < 6; i++) {
      const r = rollupForecaster(traces, i);
      expect(r.skillPremium).toBeCloseTo(r.poolShare - r.wagerShare, 12);
    }
  });

  it('pulls final wealth and skill from the last trace', () => {
    const traces = smallRun();
    const last = traces[traces.length - 1];
    const r = rollupForecaster(traces, 2);
    expect(r.wealth).toBe(last.wealth_after[2]);
    expect(r.sigma).toBe(last.sigma_new[2]);
  });
});

describe('derivedMetrics — skill gate', () => {
  it('matches g(σ) = λ + (1−λ)σ^η', () => {
    expect(skillGate(0.5, 0.3, 1)).toBeCloseTo(0.3 + 0.7 * 0.5, 12);
    expect(skillGate(0.5, 0.05, 2)).toBeCloseTo(0.05 + 0.95 * 0.25, 12);
    expect(skillGate(1, 0.3, 2)).toBeCloseTo(1, 12);
  });
});

describe('derivedMetrics — series helpers', () => {
  it('cumulative running sum is correct on a sample', () => {
    expect(cumulative([1, 2, 3, 4])).toEqual([1, 3, 6, 10]);
  });

  it('bankroll and skill series slice the right trace field', () => {
    const traces = smallRun();
    const bank = bankrollSeries(traces, 0);
    const skill = skillSeries(traces, 0);
    expect(bank.length).toBe(traces.length);
    expect(bank[5]).toBe(traces[5].wealth_after[0]);
    expect(skill[5]).toBe(traces[5].sigma_new[0]);
  });
});
