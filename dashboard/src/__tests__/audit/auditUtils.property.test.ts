/**
 * Property-based tests for auditUtils.ts using fast-check.
 *
 * Feature: model-performance-audit
 * Each test validates a correctness property from the design document.
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import {
  computeForecasterStats,
  regimeBreakdown,
  rollingDifference,
  convergenceRound,
  giniCoefficient,
  effectiveN,
  spearmanRank,
  findIndistinguishable,
} from '../../lib/audit/auditUtils';

// ── Helpers ────────────────────────────────────────────────────────

/** Arbitrary for finite floats (no NaN/Infinity). */
const finiteFloat = fc.double({ min: -1e6, max: 1e6, noNaN: true });

/** Arbitrary for non-negative finite floats. */
const nonNegFloat = fc.double({ min: 0, max: 1e6, noNaN: true });

// ── Property 1: Forecaster statistics correctness ──────────────────
// Feature: model-performance-audit, Property 1: Forecaster statistics correctness

describe('Property 1: computeForecasterStats', () => {
  /**
   * **Validates: Requirements 1.1**
   *
   * For any non-empty array of finite numbers, computeForecasterStats
   * SHALL return a mean equal to the arithmetic average, a median equal
   * to the middle value, and a standard deviation equal to the population
   * standard deviation. All three statistics SHALL be finite numbers.
   */
  it('returns finite mean, median, and stddev matching arithmetic definitions', () => {
    fc.assert(
      fc.property(
        fc.array(finiteFloat, { minLength: 1, maxLength: 200 }),
        (values) => {
          const forecasterName = 'TestForecaster';
          const perAgentCrps = values.map((v) => ({ [forecasterName]: v }));
          const result = computeForecasterStats(perAgentCrps, [forecasterName]);

          expect(result).toHaveLength(1);
          const stats = result[0];

          // Mean should be finite
          expect(Number.isFinite(stats.meanCrps)).toBe(true);
          // Median should be finite
          expect(Number.isFinite(stats.medianCrps)).toBe(true);
          // Std should be finite and non-negative
          expect(Number.isFinite(stats.stdCrps)).toBe(true);
          expect(stats.stdCrps).toBeGreaterThanOrEqual(0);

          // Mean matches arithmetic average
          const expectedMean = values.reduce((s, v) => s + v, 0) / values.length;
          expect(stats.meanCrps).toBeCloseTo(expectedMean, 8);

          // Median matches sorted middle
          const sorted = [...values].sort((a, b) => a - b);
          const mid = Math.floor(sorted.length / 2);
          const expectedMedian =
            sorted.length % 2 === 0
              ? (sorted[mid - 1] + sorted[mid]) / 2
              : sorted[mid];
          expect(stats.medianCrps).toBeCloseTo(expectedMedian, 8);

          // Std matches population standard deviation
          const variance =
            values.reduce((s, v) => s + (v - expectedMean) ** 2, 0) / values.length;
          expect(stats.stdCrps).toBeCloseTo(Math.sqrt(variance), 8);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 2: Regime breakdown partitions correctly ──────────────
// Feature: model-performance-audit, Property 2: Regime breakdown partitions correctly by quartile

describe('Property 2: regimeBreakdown', () => {
  /**
   * **Validates: Requirements 1.3**
   *
   * For any array of (y, crps) pairs with at least 4 elements,
   * regimeBreakdown SHALL partition rounds such that every round in the
   * high-wind group has y >= 75th percentile and every round in the
   * low-wind group has y <= 25th percentile.
   */
  it('partitions rounds by quartile and computes correct group means', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            y: finiteFloat,
            crps: fc.double({ min: 0, max: 10, noNaN: true }),
          }),
          { minLength: 4, maxLength: 100 },
        ),
        (pairs) => {
          const forecasterName = 'F';
          const perRound = pairs.map((p, i) => ({ t: i, y: p.y }));
          const perAgentCrps = pairs.map((p) => ({ [forecasterName]: p.crps }));

          const result = regimeBreakdown(perRound, perAgentCrps, [forecasterName]);
          expect(result).toHaveLength(1);

          const stats = result[0];

          // Compute quartiles
          const sortedY = [...pairs.map((p) => p.y)].sort((a, b) => a - b);
          const n = sortedY.length;
          const q25Pos = 0.25 * (n - 1);
          const q75Pos = 0.75 * (n - 1);
          const q25 =
            sortedY[Math.floor(q25Pos)] * (1 - (q25Pos % 1)) +
            sortedY[Math.ceil(q25Pos)] * (q25Pos % 1);
          const q75 =
            sortedY[Math.floor(q75Pos)] * (1 - (q75Pos % 1)) +
            sortedY[Math.ceil(q75Pos)] * (q75Pos % 1);

          // Verify high-wind mean
          const highCrps = pairs
            .filter((p) => p.y >= q75)
            .map((p) => p.crps);
          if (highCrps.length > 0) {
            const expectedHighMean =
              highCrps.reduce((s, v) => s + v, 0) / highCrps.length;
            expect(stats.highWindCrps).toBeCloseTo(expectedHighMean, 8);
          }

          // Verify low-wind mean
          const lowCrps = pairs
            .filter((p) => p.y <= q25)
            .map((p) => p.crps);
          if (lowCrps.length > 0) {
            const expectedLowMean =
              lowCrps.reduce((s, v) => s + v, 0) / lowCrps.length;
            expect(stats.lowWindCrps).toBeCloseTo(expectedLowMean, 8);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 3: Rolling difference window correctness ──────────────
// Feature: model-performance-audit, Property 3: Rolling difference window correctness

describe('Property 3: rollingDifference', () => {
  /**
   * **Validates: Requirements 2.2**
   *
   * For any two numeric arrays of equal length and any positive window
   * size, rollingDifference SHALL produce output where each point equals
   * the mean of (A[i] − B[i]) over the preceding window elements.
   * Output length SHALL equal max(0, inputLength - window + 1).
   */
  it('produces correct output length and values', () => {
    fc.assert(
      fc.property(
        fc
          .integer({ min: 1, max: 100 })
          .chain((len) =>
            fc.tuple(
              fc.array(finiteFloat, { minLength: len, maxLength: len }),
              fc.array(finiteFloat, { minLength: len, maxLength: len }),
              fc.integer({ min: 1, max: len }),
            ),
          ),
        ([seriesA, seriesB, window]) => {
          const result = rollingDifference(seriesA, seriesB, window);
          const expectedLen = Math.max(0, seriesA.length - window + 1);
          expect(result).toHaveLength(expectedLen);

          // Verify each point
          for (let i = 0; i < result.length; i++) {
            let sum = 0;
            for (let j = i; j < i + window; j++) {
              sum += seriesA[j] - seriesB[j];
            }
            expect(result[i].diff).toBeCloseTo(sum / window, 6);
            expect(result[i].t).toBe(i + window - 1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 4: Spearman rank correlation bounds and identity ──────
// Feature: model-performance-audit, Property 4: Spearman rank correlation bounds and identity

describe('Property 4: spearmanRank', () => {
  /**
   * **Validates: Requirements 3.3**
   *
   * For any two arrays of equal length containing distinct values,
   * spearmanRank SHALL return a value in [−1, 1]. For identical orderings
   * it SHALL return 1.0. For perfectly reversed orderings it SHALL return −1.0.
   */
  it('returns value in [-1, 1] for distinct values', () => {
    fc.assert(
      fc.property(
        fc
          .uniqueArray(fc.integer({ min: -1000, max: 1000 }), { minLength: 2, maxLength: 50 })
          .chain((a) =>
            fc.tuple(
              fc.constant(a),
              fc.shuffledSubarray(a, { minLength: a.length, maxLength: a.length }),
            ),
          ),
        ([a, b]) => {
          const rho = spearmanRank(a, b);
          expect(rho).toBeGreaterThanOrEqual(-1 - 1e-10);
          expect(rho).toBeLessThanOrEqual(1 + 1e-10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns 1.0 for identical orderings', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -1000, max: 1000 }), { minLength: 2, maxLength: 50 }),
        (a) => {
          const rho = spearmanRank(a, [...a]);
          expect(rho).toBeCloseTo(1.0, 10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns -1.0 for perfectly reversed orderings', () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: -1000, max: 1000 }), { minLength: 2, maxLength: 50 }),
        (a) => {
          const reversed = [...a].sort((x, y) => x - y);
          const forward = [...reversed];
          reversed.reverse();
          const rho = spearmanRank(forward, reversed);
          expect(rho).toBeCloseTo(-1.0, 10);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 5: Convergence detection consistency ──────────────────
// Feature: model-performance-audit, Property 5: Convergence detection consistency

describe('Property 5: convergenceRound', () => {
  /**
   * **Validates: Requirements 3.4**
   *
   * For any skill history where the rank ordering is constant from round k
   * onward for at least stableWindow consecutive rounds, convergenceRound
   * SHALL return convergedAtRound ≤ k. If the ordering never stabilises,
   * it SHALL return convergedAtRound = null.
   */
  it('detects convergence when ordering is stable from round k onward', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 20 }), // k: unstable prefix length
        fc.integer({ min: 5, max: 30 }), // stableLen: stable suffix length
        fc.integer({ min: 2, max: 5 }),  // nForecasters
        (k, stableLen, nForecasters) => {
          const stableWindow = Math.min(stableLen, 10);
          if (stableLen < stableWindow) return; // skip if stable suffix too short

          const forecasters = Array.from({ length: nForecasters }, (_, i) => `F${i}`);

          // Build a stable ordering
          const stableRow: Record<string, number> = {};
          forecasters.forEach((f, i) => {
            stableRow[f] = nForecasters - i; // F0 highest, F(n-1) lowest
          });

          // Build unstable prefix with shuffled orderings
          const history: Array<Record<string, number>> = [];
          for (let i = 0; i < k; i++) {
            const row: Record<string, number> = {};
            // Reverse ordering for unstable rounds
            forecasters.forEach((f, j) => {
              row[f] = (i % 2 === 0) ? j : nForecasters - j;
            });
            history.push(row);
          }

          // Add stable suffix
          for (let i = 0; i < stableLen; i++) {
            history.push({ ...stableRow });
          }

          const result = convergenceRound(history, forecasters, stableWindow);

          if (stableLen >= stableWindow) {
            expect(result.convergedAtRound).not.toBeNull();
            expect(result.convergedAtRound!).toBeLessThanOrEqual(k);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('returns null when ordering never stabilises', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 30 }), // length
        (len) => {
          const forecasters = ['A', 'B'];
          const stableWindow = len; // require stability for entire length

          // Alternate ordering every round — never stable
          const history = Array.from({ length: len }, (_, i) => {
            if (i % 2 === 0) return { A: 2, B: 1 };
            return { A: 1, B: 2 };
          });

          const result = convergenceRound(history, forecasters, stableWindow);
          expect(result.convergedAtRound).toBeNull();
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 6: Indistinguishable skill detection completeness ─────
// Feature: model-performance-audit, Property 6: Indistinguishable skill detection completeness

describe('Property 6: findIndistinguishable', () => {
  /**
   * **Validates: Requirements 3.7**
   *
   * For any array of (forecaster, sigma) pairs, every pair where
   * |sigma_i − sigma_j| < 0.05 SHALL be flagged, and no pair where
   * |sigma_i − sigma_j| >= 0.05 SHALL be flagged.
   */
  it('flags exactly the pairs within threshold', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 5 }),
            sigma: fc.double({ min: 0, max: 1, noNaN: true }),
          }),
          { minLength: 2, maxLength: 15 },
        ),
        (forecasters) => {
          // Ensure unique names
          const seen = new Set<string>();
          const unique = forecasters.filter((f) => {
            if (seen.has(f.name)) return false;
            seen.add(f.name);
            return true;
          });
          if (unique.length < 2) return;

          const result = findIndistinguishable(unique, 0.05);

          // Check completeness: every close pair is flagged
          for (let i = 0; i < unique.length; i++) {
            for (let j = i + 1; j < unique.length; j++) {
              const diff = Math.abs(unique[i].sigma - unique[j].sigma);
              const found = result.some(
                (p) =>
                  (p.forecasterA === unique[i].name && p.forecasterB === unique[j].name) ||
                  (p.forecasterA === unique[j].name && p.forecasterB === unique[i].name),
              );
              if (diff < 0.05) {
                expect(found).toBe(true);
              } else {
                expect(found).toBe(false);
              }
            }
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ── Property 7: Concentration metrics bounds and edge cases ────────
// Feature: model-performance-audit, Property 7: Concentration metrics bounds and edge cases

describe('Property 7: giniCoefficient and effectiveN', () => {
  /**
   * **Validates: Requirements 4.4**
   *
   * For any array of non-negative weights that sum to a positive value,
   * giniCoefficient SHALL return [0, 1] and effectiveN SHALL return [1, N].
   * For equal weights, Gini SHALL be 0 and effectiveN SHALL equal N.
   * For a single non-zero weight with all others zero, Gini SHALL approach 1
   * and effectiveN SHALL equal 1.
   */
  it('gini is in [0, 1] and effectiveN is in [1, N] for positive-sum arrays', () => {
    fc.assert(
      fc.property(
        fc.array(nonNegFloat, { minLength: 1, maxLength: 50 }).filter(
          (arr) => arr.reduce((s, v) => s + v, 0) > 0,
        ),
        (weights) => {
          const g = giniCoefficient(weights);
          expect(g).toBeGreaterThanOrEqual(-1e-10);
          expect(g).toBeLessThanOrEqual(1 + 1e-10);

          const nEff = effectiveN(weights);
          expect(nEff).toBeGreaterThanOrEqual(1 - 1e-10);
          expect(nEff).toBeLessThanOrEqual(weights.length + 1e-10);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('gini is 0 and effectiveN equals N for equal weights', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.integer({ min: 1, max: 50 }),
        (w, n) => {
          const weights = Array(n).fill(w);
          expect(giniCoefficient(weights)).toBeCloseTo(0, 8);
          expect(effectiveN(weights)).toBeCloseTo(n, 8);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('effectiveN is 1 when only one weight is non-zero', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 100, noNaN: true }),
        fc.integer({ min: 2, max: 20 }),
        (w, n) => {
          const weights = Array(n).fill(0);
          weights[0] = w;
          expect(effectiveN(weights)).toBeCloseTo(1, 8);
        },
      ),
      { numRuns: 100 },
    );
  });
});
