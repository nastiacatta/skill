/**
 * Converts composable pipeline RoundTrace (point forecasts, MAE) into the
 * display shape expected by RoundInspectorTab and OutcomeStudioTab (legacy
 * RoundTrace with aggregate q10/q50/q90 for forecast bar, etc.).
 */
import type { RoundTrace as ComposableRoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import type { RoundTrace as DisplayRoundTrace, SimResult } from './types';

const EPS = 1e-9;

function normalise(arr: number[]): number[] {
  const sum = arr.reduce((a, b) => a + b, 0);
  if (sum <= EPS) return arr.map(() => 0);
  return arr.map((v) => v / sum);
}

export function composableTraceToDisplayTrace(
  t: ComposableRoundTrace,
  utilityPool: number,
): DisplayRoundTrace {
  const N = t.reports.length;
  const totalDeposit = t.deposits.reduce((a, b) => a + b, 0);
  const totalWager = t.effectiveWager.reduce((a, b) => a + b, 0);
  const totalRefund = t.refunds.reduce((a, b) => a + b, 0);
  const totalPayout = t.totalPayoff.reduce((a, b) => a + b, 0);
  const scoreShares = normalise(t.scores.map((s) => Math.max(0, s)));

  return {
    t: t.round - 1,
    y_true: t.y,
    active: t.participated,
    reports: t.reports.map((r) => r),
    q10s: t.reports.map((r) => r - 0.05),
    q90s: t.reports.map((r) => r + 0.05),
    widths: Array(N).fill(null),
    confidence: Array(N).fill(null),
    sigma: t.sigma_t,
    deposits: t.deposits,
    wagers: t.effectiveWager,
    weights: t.weights,
    aggregate: {
      q50: t.r_hat,
      q10: t.r_hat - 0.05,
      q90: t.r_hat + 0.05,
    },
    scores: t.scores,
    scoreShares,
    refunds: t.refunds,
    payouts: t.totalPayoff,
    profits: t.profit,
    wealth: t.wealth_after,
    hhi: t.hhi,
    nEff: t.nEff,
    totalDeposit,
    totalWager,
    totalRefund,
    totalPayout,
    U: utilityPool,
  };
}

export function pipelineToSimResult(
  traces: ComposableRoundTrace[],
  N: number,
  utilityPool: number,
): SimResult {
  return {
    rounds: traces.map((t) => composableTraceToDisplayTrace(t, utilityPool)),
    N,
    T: traces.length,
  };
}
