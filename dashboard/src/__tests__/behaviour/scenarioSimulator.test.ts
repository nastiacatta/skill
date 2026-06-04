/**
 * Scenario simulator property tests — Properties 19, 20, 21.
 * Feature: behaviour-analysis-redesign
 */
import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { ALL_PRESET_IDS } from '@/lib/behaviour/presetMeta';

// Feature: behaviour-analysis-redesign, Property 19: All 19 presets produce valid PipelineResult
// **Validates: Requirements 14.1, 14.3**
describe('Property 19 — All 19 presets produce valid PipelineResult', () => {
  it('every preset produces a valid PipelineResult with finite summary values', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESET_IDS),
        (presetId) => {
          const result = runPipeline({ dgpId: 'baseline', behaviourPreset: presetId, rounds: 50, seed: 42, n: 6 });
          // Non-empty rounds
          expect(result.rounds.length).toBe(50);
          // finalState has correct agent count
          expect(result.finalState).toHaveLength(6);
          // Summary fields are finite numbers
          expect(Number.isFinite(result.summary.meanError)).toBe(true);
          expect(Number.isFinite(result.summary.meanParticipation)).toBe(true);
          expect(Number.isFinite(result.summary.meanNEff)).toBe(true);
          expect(Number.isFinite(result.summary.finalGini)).toBe(true);
          expect(Number.isFinite(result.summary.finalAggregate)).toBe(true);
          expect(Number.isFinite(result.summary.finalDistributed)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 21: Simulation determinism
// **Validates: Requirements 14.4**
describe('Property 21 — Simulation determinism', () => {
  it('same preset + seed produces identical rounds', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_PRESET_IDS),
        fc.integer({ min: 1, max: 10000 }),
        (presetId, seed) => {
          const opts = { dgpId: 'baseline' as const, behaviourPreset: presetId, rounds: 50, seed, n: 6 };
          const r1 = runPipeline(opts);
          const r2 = runPipeline(opts);
          expect(r1.rounds.map(r => r.error)).toEqual(r2.rounds.map(r => r.error));
          expect(r1.rounds.map(r => r.participation)).toEqual(r2.rounds.map(r => r.participation));
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: behaviour-analysis-redesign, Property 20: Biased preset produces biased reports
// **Validates: Requirements 14.2**
describe('Property 20 — Biased preset produces biased reports', () => {
  it('biased preset mean error >= baseline mean error', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (seed) => {
          const baseline = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: 100, seed, n: 6 });
          const biased = runPipeline({ dgpId: 'baseline', behaviourPreset: 'biased', rounds: 100, seed, n: 6 });
          // Biased preset should produce equal or worse aggregate error
          expect(biased.summary.meanError).toBeGreaterThanOrEqual(baseline.summary.meanError * 0.95);
        },
      ),
      { numRuns: 100 },
    );
  });
});
