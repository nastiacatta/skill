/**
 * Unit tests for auditUtils.ts — edge cases and specific examples.
 */

import { describe, it, expect } from 'vitest';

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

// ── computeForecasterStats ─────────────────────────────────────────

describe('computeForecasterStats', () => {
  it('returns NaN stats for a forecaster with no data', () => {
    const result = computeForecasterStats([], ['Missing']);
    expect(result).toHaveLength(1);
    expect(result[0].meanCrps).toBeNaN();
    expect(result[0].medianCrps).toBeNaN();
    expect(result[0].stdCrps).toBeNaN();
  });

  it('handles a single data point', () => {
    const result = computeForecasterStats([{ F: 0.5 }], ['F']);
    expect(result[0].meanCrps).toBeCloseTo(0.5);
    expect(result[0].medianCrps).toBeCloseTo(0.5);
    expect(result[0].stdCrps).toBeCloseTo(0);
  });

  it('computes correct stats for known values', () => {
    const data = [{ F: 1 }, { F: 2 }, { F: 3 }, { F: 4 }, { F: 5 }];
    const result = computeForecasterStats(data, ['F']);
    expect(result[0].meanCrps).toBeCloseTo(3);
    expect(result[0].medianCrps).toBeCloseTo(3);
    // Population std of [1,2,3,4,5] = sqrt(2)
    expect(result[0].stdCrps).toBeCloseTo(Math.sqrt(2), 5);
  });

  it('skips NaN and Infinity values', () => {
    const data = [{ F: 1 }, { F: NaN }, { F: 3 }, { F: Infinity }];
    const result = computeForecasterStats(data, ['F']);
    expect(result[0].meanCrps).toBeCloseTo(2); // mean of [1, 3]
  });
});

// ── regimeBreakdown ────────────────────────────────────────────────

describe('regimeBreakdown', () => {
  it('returns empty array for fewer than 4 data points', () => {
    const perRound = [{ t: 0, y: 1 }, { t: 1, y: 2 }, { t: 2, y: 3 }];
    const perAgentCrps = [{ F: 0.1 }, { F: 0.2 }, { F: 0.3 }];
    expect(regimeBreakdown(perRound, perAgentCrps, ['F'])).toEqual([]);
  });

  it('correctly partitions high and low wind', () => {
    // y values: 10, 20, 30, 40 → Q25=15, Q75=35
    const perRound = [
      { t: 0, y: 10 },
      { t: 1, y: 20 },
      { t: 2, y: 30 },
      { t: 3, y: 40 },
    ];
    const perAgentCrps = [{ F: 0.1 }, { F: 0.2 }, { F: 0.3 }, { F: 0.4 }];
    const result = regimeBreakdown(perRound, perAgentCrps, ['F']);

    expect(result).toHaveLength(1);
    // Low wind (y <= Q25=15): only y=10 → crps=0.1
    expect(result[0].lowWindCrps).toBeCloseTo(0.1);
    // High wind (y >= Q75=35): only y=40 → crps=0.4
    expect(result[0].highWindCrps).toBeCloseTo(0.4);
  });
});

// ── rollingDifference ──────────────────────────────────────────────

describe('rollingDifference', () => {
  it('returns empty for window larger than input', () => {
    expect(rollingDifference([1, 2], [3, 4], 5)).toEqual([]);
  });

  it('returns empty for window <= 0', () => {
    expect(rollingDifference([1, 2], [3, 4], 0)).toEqual([]);
  });

  it('computes correct rolling difference with window=1', () => {
    const result = rollingDifference([5, 10, 15], [1, 2, 3], 1);
    expect(result).toHaveLength(3);
    expect(result[0].diff).toBeCloseTo(4);
    expect(result[1].diff).toBeCloseTo(8);
    expect(result[2].diff).toBeCloseTo(12);
  });

  it('computes correct rolling difference with window=3', () => {
    const result = rollingDifference([10, 20, 30, 40], [1, 2, 3, 4], 3);
    // diffs: [9, 18, 27, 36]
    // window=3: mean(9,18,27)=18, mean(18,27,36)=27
    expect(result).toHaveLength(2);
    expect(result[0].diff).toBeCloseTo(18);
    expect(result[1].diff).toBeCloseTo(27);
  });
});

// ── convergenceRound ───────────────────────────────────────────────

describe('convergenceRound', () => {
  it('returns null for empty history', () => {
    const result = convergenceRound([], ['A', 'B'], 5);
    expect(result.convergedAtRound).toBeNull();
    expect(result.stableForRounds).toBe(0);
  });

  it('detects immediate convergence', () => {
    const history = Array.from({ length: 10 }, () => ({ A: 2, B: 1 }));
    const result = convergenceRound(history, ['A', 'B'], 5);
    expect(result.convergedAtRound).toBe(0);
    expect(result.finalOrdering).toEqual(['A', 'B']);
  });

  it('detects convergence after initial instability', () => {
    const history = [
      { A: 1, B: 2 }, // B > A
      { A: 2, B: 1 }, // A > B (change)
      { A: 2, B: 1 },
      { A: 2, B: 1 },
      { A: 2, B: 1 },
      { A: 2, B: 1 },
    ];
    const result = convergenceRound(history, ['A', 'B'], 4);
    expect(result.convergedAtRound).toBe(1);
  });

  it('returns null when never stable long enough', () => {
    const history = [
      { A: 2, B: 1 },
      { A: 1, B: 2 },
      { A: 2, B: 1 },
      { A: 1, B: 2 },
    ];
    const result = convergenceRound(history, ['A', 'B'], 3);
    expect(result.convergedAtRound).toBeNull();
  });
});

// ── giniCoefficient ────────────────────────────────────────────────

describe('giniCoefficient', () => {
  it('returns 0 for empty array', () => {
    expect(giniCoefficient([])).toBe(0);
  });

  it('returns 0 for single element', () => {
    expect(giniCoefficient([5])).toBe(0);
  });

  it('returns 0 for equal values', () => {
    expect(giniCoefficient([1, 1, 1, 1])).toBeCloseTo(0);
  });

  it('returns 0 for all-zero values', () => {
    expect(giniCoefficient([0, 0, 0])).toBe(0);
  });

  it('approaches 1 for maximally unequal distribution', () => {
    // One large value, rest zero
    const g = giniCoefficient([0, 0, 0, 0, 1000]);
    expect(g).toBeGreaterThan(0.7);
    expect(g).toBeLessThanOrEqual(1);
  });

  it('computes known Gini for [1, 2, 3]', () => {
    // |diffs|: |1-2|+|1-3|+|2-1|+|2-3|+|3-1|+|3-2| = 1+2+1+1+2+1 = 8
    // Gini = 8 / (2 * 3 * 6) = 8/36 ≈ 0.2222
    expect(giniCoefficient([1, 2, 3])).toBeCloseTo(8 / 36, 5);
  });
});

// ── effectiveN ─────────────────────────────────────────────────────

describe('effectiveN', () => {
  it('returns 0 for empty array', () => {
    expect(effectiveN([])).toBe(0);
  });

  it('returns N for equal weights', () => {
    expect(effectiveN([1, 1, 1, 1])).toBeCloseTo(4);
  });

  it('returns 1 for single non-zero weight', () => {
    expect(effectiveN([0, 0, 5, 0])).toBeCloseTo(1);
  });

  it('returns N for zero-sum (fallback)', () => {
    expect(effectiveN([0, 0, 0])).toBe(3);
  });

  it('returns value between 1 and N for mixed weights', () => {
    const nEff = effectiveN([1, 2, 3]);
    expect(nEff).toBeGreaterThanOrEqual(1);
    expect(nEff).toBeLessThanOrEqual(3);
  });
});

// ── spearmanRank ───────────────────────────────────────────────────

describe('spearmanRank', () => {
  it('returns NaN for mismatched lengths', () => {
    expect(spearmanRank([1, 2], [1])).toBeNaN();
  });

  it('returns NaN for arrays shorter than 2', () => {
    expect(spearmanRank([1], [1])).toBeNaN();
  });

  it('returns 1 for identical arrays', () => {
    expect(spearmanRank([1, 2, 3], [1, 2, 3])).toBeCloseTo(1);
  });

  it('returns -1 for reversed arrays', () => {
    expect(spearmanRank([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1);
  });

  it('handles ties correctly', () => {
    // With ties, correlation should still be in [-1, 1]
    const rho = spearmanRank([1, 1, 2], [2, 1, 1]);
    expect(rho).toBeGreaterThanOrEqual(-1);
    expect(rho).toBeLessThanOrEqual(1);
  });
});

// ── findIndistinguishable ──────────────────────────────────────────

describe('findIndistinguishable', () => {
  it('returns empty for well-separated forecasters', () => {
    const result = findIndistinguishable([
      { name: 'A', sigma: 0.1 },
      { name: 'B', sigma: 0.9 },
    ]);
    expect(result).toEqual([]);
  });

  it('flags close pairs', () => {
    const result = findIndistinguishable([
      { name: 'A', sigma: 0.50 },
      { name: 'B', sigma: 0.52 },
      { name: 'C', sigma: 0.90 },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].forecasterA).toBe('A');
    expect(result[0].forecasterB).toBe('B');
    expect(result[0].sigmaDiff).toBeCloseTo(0.02);
  });

  it('uses custom threshold', () => {
    const result = findIndistinguishable(
      [
        { name: 'A', sigma: 0.50 },
        { name: 'B', sigma: 0.60 },
      ],
      0.15,
    );
    expect(result).toHaveLength(1);
  });

  it('returns empty for single forecaster', () => {
    expect(findIndistinguishable([{ name: 'A', sigma: 0.5 }])).toEqual([]);
  });
});
