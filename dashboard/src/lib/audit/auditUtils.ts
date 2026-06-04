/**
 * Pure utility functions for the Model Performance Audit feature.
 *
 * All functions are stateless and operate on plain arrays/objects.
 * They compute derived metrics (regime breakdowns, rolling differences,
 * convergence points, concentration metrics) from the raw data loaded
 * by the adapter layer.
 */

import type { RegimeBreakdown, ConvergenceResult, IndistinguishablePair } from './auditTypes';

// ── Helpers ────────────────────────────────────────────────────────

/** Filter out non-finite values from an array. */
function finiteOnly(arr: number[]): number[] {
  return arr.filter((v) => Number.isFinite(v));
}

/**
 * Read a value from a row by forecaster name, falling back to the indexed
 * form `${indexedPrefix}_${i}` if the name key is missing.
 *
 * This supports two shapes of serialised data:
 *   - new: row['XGBoost'] = 0.0183 (name-keyed, added July 2026)
 *   - legacy: row['crps_3']        (indexed by position in forecasters[])
 *
 * Returns undefined when neither form is present.
 */
export function rowValue(
  row: Record<string, number>,
  forecasterName: string,
  forecasters: string[],
  indexedPrefix: string,
): number | undefined {
  const named = row[forecasterName];
  if (named !== undefined) return named;
  const idx = forecasters.indexOf(forecasterName);
  if (idx < 0) return undefined;
  return row[`${indexedPrefix}_${idx}`];
}

/** Arithmetic mean of a numeric array. Returns NaN for empty arrays. */
function mean(arr: number[]): number {
  if (arr.length === 0) return NaN;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

/** Median of a numeric array. Returns NaN for empty arrays. */
function median(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/** Population standard deviation. Returns NaN for empty arrays. */
function stddev(arr: number[]): number {
  if (arr.length === 0) return NaN;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/** Quantile (0–1) of a sorted array using linear interpolation. */
function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  if (sorted.length === 1) return sorted[0];
  const pos = q * (sorted.length - 1);
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const frac = pos - lo;
  return sorted[lo] * (1 - frac) + sorted[hi] * frac;
}

// ── Public API ─────────────────────────────────────────────────────

/**
 * Compute per-forecaster CRPS statistics from per_agent_crps time series.
 *
 * Returns mean, median, std, and placeholder regime values (use
 * regimeBreakdown for regime-conditional stats).
 */
export function computeForecasterStats(
  perAgentCrps: Array<Record<string, number>>,
  forecasters: string[],
): RegimeBreakdown[] {
  return forecasters.map((name) => {
    const values = finiteOnly(
      perAgentCrps
        .map((row) => rowValue(row, name, forecasters, 'crps'))
        .filter((v): v is number => v !== undefined),
    );
    return {
      forecaster: name,
      meanCrps: mean(values),
      medianCrps: median(values),
      stdCrps: stddev(values),
      highWindCrps: NaN,
      lowWindCrps: NaN,
    };
  });
}

/**
 * Split rounds into high-wind (top quartile of y) and low-wind
 * (bottom quartile) and compute per-forecaster CRPS in each regime.
 *
 * Requires at least 4 data points to define quartiles.
 */
export function regimeBreakdown(
  perRound: Array<{ t: number; y: number }>,
  perAgentCrps: Array<Record<string, number>>,
  forecasters: string[],
): RegimeBreakdown[] {
  if (perRound.length < 4) return [];

  // Align lengths — use the shorter of the two arrays
  const len = Math.min(perRound.length, perAgentCrps.length);
  const yValues = perRound.slice(0, len).map((r) => r.y);
  const sortedY = [...yValues].sort((a, b) => a - b);
  const q25 = quantile(sortedY, 0.25);
  const q75 = quantile(sortedY, 0.75);

  return forecasters.map((name) => {
    const allValues: number[] = [];
    const highValues: number[] = [];
    const lowValues: number[] = [];

    for (let i = 0; i < len; i++) {
      const crps = rowValue(perAgentCrps[i], name, forecasters, 'crps');
      if (crps === undefined || !Number.isFinite(crps)) continue;
      allValues.push(crps);
      if (yValues[i] >= q75) highValues.push(crps);
      if (yValues[i] <= q25) lowValues.push(crps);
    }

    return {
      forecaster: name,
      meanCrps: mean(allValues),
      medianCrps: median(allValues),
      stdCrps: stddev(allValues),
      highWindCrps: mean(highValues),
      lowWindCrps: mean(lowValues),
    };
  });
}

/**
 * Compute rolling difference between two series with a given window.
 *
 * Each output point is the mean of (A[i] − B[i]) over the preceding
 * `window` elements. Output length = max(0, inputLength - window + 1).
 */
export function rollingDifference(
  seriesA: number[],
  seriesB: number[],
  window: number,
): Array<{ t: number; diff: number }> {
  const len = Math.min(seriesA.length, seriesB.length);
  if (window <= 0 || len < window) return [];

  const diffs = new Array(len);
  for (let i = 0; i < len; i++) {
    diffs[i] = seriesA[i] - seriesB[i];
  }

  const result: Array<{ t: number; diff: number }> = [];
  let windowSum = 0;

  // Initialise first window
  for (let i = 0; i < window; i++) {
    windowSum += diffs[i];
  }
  result.push({ t: window - 1, diff: windowSum / window });

  // Slide the window
  for (let i = window; i < len; i++) {
    windowSum += diffs[i] - diffs[i - window];
    result.push({ t: i, diff: windowSum / window });
  }

  return result;
}

/**
 * Find the first round after which the rank ordering of forecasters
 * (by sigma) is stable for at least `stableWindow` consecutive rounds.
 *
 * Returns convergedAtRound = null if ordering never stabilises.
 */
export function convergenceRound(
  skillHistory: Array<Record<string, number>>,
  forecasters: string[],
  stableWindow: number,
): ConvergenceResult {
  if (skillHistory.length === 0 || forecasters.length === 0) {
    return { convergedAtRound: null, stableForRounds: 0, finalOrdering: [] };
  }

  // Compute rank ordering at each round. Reads sigma via rowValue
  // (name-keyed with indexed-fallback to support legacy data files
  // that only contain 'sigma_0', 'sigma_1', … keys).
  function getRanking(row: Record<string, number>): string[] {
    return [...forecasters].sort((a, b) => {
      const va = rowValue(row, a, forecasters, 'sigma') ?? 0;
      const vb = rowValue(row, b, forecasters, 'sigma') ?? 0;
      return vb - va;
    });
  }

  function rankingsEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (a[i] !== b[i]) return false;
    }
    return true;
  }

  const finalOrdering = getRanking(skillHistory[skillHistory.length - 1]);

  let consecutiveStable = 1;
  let prevRanking = getRanking(skillHistory[0]);

  for (let i = 1; i < skillHistory.length; i++) {
    const currentRanking = getRanking(skillHistory[i]);
    if (rankingsEqual(currentRanking, prevRanking)) {
      consecutiveStable++;
      if (consecutiveStable >= stableWindow) {
        return {
          convergedAtRound: i - stableWindow + 1,
          stableForRounds: consecutiveStable,
          finalOrdering,
        };
      }
    } else {
      consecutiveStable = 1;
    }
    prevRanking = currentRanking;
  }

  return {
    convergedAtRound: null,
    stableForRounds: consecutiveStable,
    finalOrdering,
  };
}

/**
 * Gini coefficient from an array of non-negative values.
 *
 * Returns 0 for empty arrays or arrays where all values are zero.
 * For a single element, returns 0.
 */
export function giniCoefficient(values: number[]): number {
  const finite = finiteOnly(values).filter((v) => v >= 0);
  const n = finite.length;
  if (n <= 1) return 0;

  const total = finite.reduce((s, v) => s + v, 0);
  if (total === 0) return 0;

  const sorted = [...finite].sort((a, b) => a - b);
  let sumOfAbsDiffs = 0;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      sumOfAbsDiffs += Math.abs(sorted[i] - sorted[j]);
    }
  }

  return sumOfAbsDiffs / (2 * n * total);
}

/**
 * Effective number of forecasters: 1 / sum(w_i^2) where w_i are
 * normalised weights.
 *
 * Returns N (array length) when sum is 0 (equal-weight fallback).
 * Returns 1 for a single element.
 */
export function effectiveN(weights: number[]): number {
  const finite = finiteOnly(weights).filter((v) => v >= 0);
  const n = finite.length;
  if (n === 0) return 0;

  const total = finite.reduce((s, v) => s + v, 0);
  if (total === 0) return n;

  const normalised = finite.map((w) => w / total);
  const hhi = normalised.reduce((s, w) => s + w * w, 0);
  return 1 / hhi;
}

/**
 * Spearman rank correlation between two arrays of equal length.
 *
 * Assigns ranks (1-based, average for ties) and computes Pearson
 * correlation on the ranks.
 *
 * Returns NaN if arrays have different lengths or fewer than 2 elements.
 */
export function spearmanRank(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return NaN;
  const n = a.length;

  function assignRanks(arr: number[]): number[] {
    const indexed = arr.map((v, i) => ({ v, i }));
    indexed.sort((x, y) => x.v - y.v);
    const ranks = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j < n - 1 && indexed[j + 1].v === indexed[j].v) j++;
      const avgRank = (i + j) / 2 + 1; // 1-based average rank
      for (let k = i; k <= j; k++) {
        ranks[indexed[k].i] = avgRank;
      }
      i = j + 1;
    }
    return ranks;
  }

  const ranksA = assignRanks(a);
  const ranksB = assignRanks(b);

  // Pearson correlation on ranks
  const meanA = mean(ranksA);
  const meanB = mean(ranksB);

  let num = 0;
  let denA = 0;
  let denB = 0;
  for (let i = 0; i < n; i++) {
    const da = ranksA[i] - meanA;
    const db = ranksB[i] - meanB;
    num += da * db;
    denA += da * da;
    denB += db * db;
  }

  const den = Math.sqrt(denA * denB);
  if (den === 0) return 0;
  return num / den;
}

/**
 * Find pairs of forecasters with indistinguishable skill estimates
 * (|sigma_i − sigma_j| < threshold).
 */
export function findIndistinguishable(
  forecasters: Array<{ name: string; sigma: number }>,
  threshold: number = 0.05,
): IndistinguishablePair[] {
  const pairs: IndistinguishablePair[] = [];
  for (let i = 0; i < forecasters.length; i++) {
    for (let j = i + 1; j < forecasters.length; j++) {
      const diff = Math.abs(forecasters[i].sigma - forecasters[j].sigma);
      if (diff < threshold) {
        pairs.push({
          forecasterA: forecasters[i].name,
          forecasterB: forecasters[j].name,
          sigmaDiff: diff,
        });
      }
    }
  }
  return pairs;
}
