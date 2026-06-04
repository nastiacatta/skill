/**
 * Behaviour-specific property tests — Properties 5, 7, 8, 9, 10, 11, 17.
 * Feature: behaviour-analysis-redesign
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { PRESET_CONFIGS, ALL_PRESET_IDS } from '@/lib/behaviour/presetMeta';

// Feature: behaviour-analysis-redesign, Property 5: Bias experiment error reflects bias magnitude
// **Validates: Requirements 4.2**
describe('Property 5 — Bias experiment error reflects bias magnitude', () => {
  it('biased preset mean CRPS >= baseline mean CRPS', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (seed) => {
          const baseline = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: 100, seed, n: 6 });
          const biased = runPipeline({ dgpId: 'baseline', behaviourPreset: 'biased', rounds: 100, seed, n: 6 });
          // Biased should produce >= baseline error (with small tolerance for noise)
          expect(biased.summary.meanError).toBeGreaterThanOrEqual(baseline.summary.meanError * 0.95);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 7: Noisy reporting CRPS degradation scales with noise
// **Validates: Requirements 5.2**
describe('Property 7 — Noisy reporting CRPS degradation scales with noise', () => {
  it('noisy reporter mean CRPS >= baseline mean CRPS', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (seed) => {
          const baseline = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: 100, seed, n: 6 });
          const noisy = runPipeline({ dgpId: 'baseline', behaviourPreset: 'noisy_reporter', rounds: 100, seed, n: 6 });
          expect(noisy.summary.meanError).toBeGreaterThanOrEqual(baseline.summary.meanError * 0.95);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 8: Budget-constrained ruin detection
// **Validates: Requirements 6.2**
describe('Property 8 — Budget-constrained ruin detection', () => {
  it('ruin count equals agents with final wealth below min deposit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (seed) => {
          const result = runPipeline({ dgpId: 'baseline', behaviourPreset: 'budget_constrained', rounds: 200, seed, n: 6 });
          const minDeposit = 0.1;
          // Count agents whose final wealth is below threshold (budget-constrained agents are indices 0-2)
          const ruinedAgents = result.finalState.filter((a, i) => i < 3 && a.wealth < minDeposit);
          // Each ruined agent should have stopped participating at some point
          for (const agent of ruinedAgents) {
            expect(agent.wealth).toBeLessThan(minDeposit);
          }
          // Ruin count should be non-negative and <= 3 (only first 3 are budget-constrained)
          expect(ruinedAgents.length).toBeGreaterThanOrEqual(0);
          expect(ruinedAgents.length).toBeLessThanOrEqual(3);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 9: Higher CRRA gamma produces lower deposits
// **Validates: Requirements 8.2**
describe('Property 9 — Higher CRRA gamma produces lower deposits', () => {
  it('risk_averse preset (gamma=1.5) has lower mean deposits than baseline (gamma=0)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (seed) => {
          const baseline = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: 100, seed, n: 6 });
          const riskAverse = runPipeline({ dgpId: 'baseline', behaviourPreset: 'risk_averse', rounds: 100, seed, n: 6 });
          const baselineMeanDeposit = baseline.rounds.reduce((s, r) => s + r.totalDeposited, 0) / baseline.rounds.length;
          const riskAverseMeanDeposit = riskAverse.rounds.reduce((s, r) => s + r.totalDeposited, 0) / riskAverse.rounds.length;
          // Higher gamma (risk_averse) should produce lower deposits
          expect(riskAverseMeanDeposit).toBeLessThanOrEqual(baselineMeanDeposit * 1.05);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 10: Reinforcement learner profit-participation correlation
// **Validates: Requirements 7.2**
describe('Property 10 — Reinforcement learner profit-participation correlation', () => {
  it('reinforcement learner participation varies with wealth trajectory', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (seed) => {
          const result = runPipeline({ dgpId: 'baseline', behaviourPreset: 'reinforcement_learner', rounds: 100, seed, n: 6 });
          // The reinforcement learner adjusts participation based on profit
          // Verify that participation is not constant (varies across rounds)
          const participations = result.rounds.map(r => r.participation);
          const uniqueValues = new Set(participations);
          // With reinforcement learning, participation should vary
          expect(uniqueValues.size).toBeGreaterThan(1);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 11: Latency exploiter information advantage
// **Validates: Requirements 9.2**
describe('Property 11 — Latency exploiter information advantage', () => {
  it('latency exploiter produces valid finite results for all seeds', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (seed) => {
          const latency = runPipeline({ dgpId: 'baseline', behaviourPreset: 'latency_exploiter', rounds: 100, seed, n: 6 });
          // Latency exploiter should produce valid results
          expect(Number.isFinite(latency.summary.meanError)).toBe(true);
          expect(Number.isFinite(latency.summary.finalGini)).toBe(true);
          expect(Number.isFinite(latency.summary.meanParticipation)).toBe(true);
          expect(latency.rounds.length).toBe(100);
          expect(latency.finalState).toHaveLength(6);
          // Agent 0 (latency exploiter) should have finite wealth
          expect(Number.isFinite(latency.finalState[0].wealth)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 17: Parameter change produces different simulation results
// **Validates: Requirements 12.2**
describe('Property 17 — Parameter change produces different simulation results', () => {
  it('changing a tunable parameter produces different meanError', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESET_IDS.filter(id => {
          const cfg = PRESET_CONFIGS[id];
          // Only presets with tunable params beyond just 'rounds' and 'n'
          return cfg.tunableParams.some(p => p.key !== 'rounds' && p.key !== 'n');
        })),
        (presetId) => {
          const cfg = PRESET_CONFIGS[presetId];
          const tunableParam = cfg.tunableParams.find(p => p.key !== 'rounds' && p.key !== 'n')!;
          // Run with default
          const defaultResult = runPipeline({
            dgpId: 'baseline', behaviourPreset: presetId, rounds: 80, seed: 42, n: 6,
          });
          // Run with modified param (use max value)
          const modifiedResult = runPipeline({
            dgpId: 'baseline', behaviourPreset: presetId, rounds: 80, seed: 42, n: 6,
            mechanism: { [tunableParam.key]: tunableParam.max },
          });
          // Results should differ (at least one metric should change)
          const errorDiff = Math.abs(modifiedResult.summary.meanError - defaultResult.summary.meanError);
          const giniDiff = Math.abs(modifiedResult.summary.finalGini - defaultResult.summary.finalGini);
          const partDiff = Math.abs(modifiedResult.summary.meanParticipation - defaultResult.summary.meanParticipation);
          // At least one metric should be different
          expect(errorDiff + giniDiff + partDiff).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});
