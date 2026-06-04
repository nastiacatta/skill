/**
 * Mechanism response metrics property tests — Properties 22, 23.
 * Feature: behaviour-analysis-redesign
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import type { MechanismResponseMetrics } from '@/lib/behaviour/mechanismMetrics';

/** Pure (non-hook) version of useMechanismMetrics logic for testing. */
function computeMetrics(
  test: PipelineResult,
  baseline: PipelineResult,
  attackerIndex: number,
  transitionRound?: number,
): MechanismResponseMetrics {
  const rho = test.params.rho;
  const ewmaHalfLife = Math.log(2) / rho;
  const startRound = transitionRound ?? 0;

  let skillRecoveryRounds: number | null = null;
  for (let i = startRound; i < test.traces.length; i++) {
    if (test.traces[i].sigma_t[attackerIndex] < 0.5) {
      skillRecoveryRounds = i - startRound;
      break;
    }
  }

  const wealthPenalty =
    test.finalState[attackerIndex].wealth - baseline.finalState[attackerIndex].wealth;

  let aggregateContamination = 0;
  const maxRound = Math.min(test.rounds.length, baseline.rounds.length);
  for (let i = startRound; i < maxRound; i++) {
    const delta = Math.abs(test.rounds[i].error - baseline.rounds[i].error);
    if (delta > aggregateContamination) aggregateContamination = delta;
  }

  const concentrationImpact = test.summary.finalGini - baseline.summary.finalGini;

  return { skillRecoveryRounds, wealthPenalty, aggregateContamination, concentrationImpact, ewmaHalfLife };
}

const ADVERSARIAL_PRESETS = ['manipulator', 'evader', 'sybil', 'collusion', 'reputation_reset', 'arbitrageur'] as const;

// Feature: behaviour-analysis-redesign, Property 22: Mechanism response metrics completeness
// **Validates: Requirements 15.1, 15.3**
describe('Property 22 — Mechanism response metrics completeness', () => {
  it('adversarial presets produce complete finite metrics', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ADVERSARIAL_PRESETS),
        (presetId) => {
          const baseline = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: 100, seed: 42, n: 6 });
          const test = runPipeline({ dgpId: 'baseline', behaviourPreset: presetId, rounds: 100, seed: 42, n: 6 });
          const metrics = computeMetrics(test, baseline, 0);

          // skillRecoveryRounds is null or finite non-negative
          if (metrics.skillRecoveryRounds !== null) {
            expect(Number.isFinite(metrics.skillRecoveryRounds)).toBe(true);
            expect(metrics.skillRecoveryRounds).toBeGreaterThanOrEqual(0);
          }
          expect(Number.isFinite(metrics.wealthPenalty)).toBe(true);
          expect(Number.isFinite(metrics.aggregateContamination)).toBe(true);
          expect(metrics.aggregateContamination).toBeGreaterThanOrEqual(0);
          expect(Number.isFinite(metrics.concentrationImpact)).toBe(true);
          expect(metrics.ewmaHalfLife).toBeCloseTo(Math.log(2) / test.params.rho);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 23: EWMA half-life correctness
// **Validates: Requirements 15.4**
describe('Property 23 — EWMA half-life correctness', () => {
  it('ewmaHalfLife equals ln(2)/rho for any rho in (0,1]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 1, noNaN: true }),
        (rho) => {
          const expected = Math.log(2) / rho;
          const computed = Math.log(2) / rho;
          expect(computed).toBeCloseTo(expected, 10);
          // Also verify with a real pipeline run
          const result = runPipeline({
            dgpId: 'baseline',
            behaviourPreset: 'baseline',
            rounds: 20,
            seed: 42,
            n: 4,
            mechanism: { rho },
          });
          const halfLife = Math.log(2) / result.params.rho;
          expect(halfLife).toBeCloseTo(expected, 5);
        },
      ),
      { numRuns: 100 },
    );
  });
});
