/**
 * Regime breakdown — split time series into regimes and compute
 * per-regime statistics (mean ΔCRPS, SE, 95 % CI).
 *
 * Pure functions — no side effects.
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import type { RegimeStats } from './types';

/**
 * Compute descriptive statistics for a single regime.
 *
 * - mean  = arithmetic mean of values
 * - SE    = sd / √n
 * - CI    = mean ± 1.96 × SE  (95 % normal approximation)
 *
 * Guards:
 * - Empty array → all-zero stats with the given regime name
 * - Single element → SE = 0, CI collapses to the single value
 */
export function computeRegimeStats(
  values: number[],
  regimeName: string,
): RegimeStats {
  const n = values.length;

  if (n === 0) {
    return {
      regimeName,
      nRounds: 0,
      meanDeltaCrps: 0,
      se: 0,
      ciLow: 0,
      ciHigh: 0,
    };
  }

  const mean = values.reduce((s, v) => s + v, 0) / n;

  if (n === 1) {
    return {
      regimeName,
      nRounds: 1,
      meanDeltaCrps: mean,
      se: 0,
      ciLow: mean,
      ciHigh: mean,
    };
  }

  // Sample standard deviation (n − 1 denominator)
  const variance =
    values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(n);
  const ciLow = mean - 1.96 * se;
  const ciHigh = mean + 1.96 * se;

  return {
    regimeName,
    nRounds: n,
    meanDeltaCrps: mean,
    se,
    ciLow,
    ciHigh,
  };
}

// ── helpers ──────────────────────────────────────────────────────────

/** Compute per-round ΔCRPS = crpsMechanism − crpsUniform. */
function deltaPerRound(
  series: { crpsMechanism: number; crpsUniform: number }[],
): number[] {
  return series.map((r) => r.crpsMechanism - r.crpsUniform);
}

// ── public API ───────────────────────────────────────────────────────

/**
 * Split a time series at T/2 into early and late halves, compute
 * ΔCRPS = crpsMechanism − crpsUniform per round, then stats per regime.
 *
 * Returns `[earlyStats, lateStats]`.
 */
export function computeEarlyLateBreakdown(
  timeSeries: { t: number; crpsMechanism: number; crpsUniform: number }[],
): [RegimeStats, RegimeStats] {
  if (timeSeries.length === 0) {
    return [
      computeRegimeStats([], 'Early rounds (t ≤ T/2)'),
      computeRegimeStats([], 'Late rounds (t > T/2)'),
    ];
  }

  const mid = Math.floor(timeSeries.length / 2);
  const earlyDeltas = deltaPerRound(timeSeries.slice(0, mid));
  const lateDeltas = deltaPerRound(timeSeries.slice(mid));

  return [
    computeRegimeStats(earlyDeltas, 'Early rounds (t ≤ T/2)'),
    computeRegimeStats(lateDeltas, 'Late rounds (t > T/2)'),
  ];
}

/**
 * Split a time series at a perturbation point `t0`, compute
 * ΔCRPS per round, then stats per regime.
 *
 * Rounds with `t < t0` go to the pre-perturbation regime;
 * rounds with `t >= t0` go to the post-perturbation regime.
 *
 * Returns `[preStats, postStats]`.
 */
export function computePerturbationBreakdown(
  timeSeries: { t: number; crpsMechanism: number; crpsUniform: number }[],
  t0: number,
): [RegimeStats, RegimeStats] {
  const pre = timeSeries.filter((r) => r.t < t0);
  const post = timeSeries.filter((r) => r.t >= t0);

  return [
    computeRegimeStats(deltaPerRound(pre), `Pre-perturbation (t < ${t0})`),
    computeRegimeStats(deltaPerRound(post), `Post-perturbation (t ≥ ${t0})`),
  ];
}
