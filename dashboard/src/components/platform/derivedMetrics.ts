/**
 * Derived per-forecaster series for the platform showcase.
 *
 * Every function here is a *pure view-side derivation* of values already on
 * the round trace (`RoundTrace`, `runRoundComposable.ts`). No mechanism maths
 * is recomputed: scores, profit, wealth, skill, weights and effective wagers
 * are read verbatim from the trace. The only things computed here are the
 * roll-ups and the calibration binning the dashboard plots need, and each is
 * documented against the draft formula it implements.
 *
 * Draft sources: `mechanism_model.md` §9 (trace-field index),
 * `draft_match_contract.md` §3 (formula lock).
 *
 * Formulae implemented (all on the synthetic sandbox regime):
 *   - bankroll trajectory  : W_{i,t}            ← trace.wealth_after[i]
 *   - skill trajectory     : σ_{i,t+1}          ← trace.sigma_new[i]
 *   - profit series        : π_i − m_i = m_i(s_i − s̄) ← trace.profit[i]
 *   - score series         : s_i = clip(1 − Ĉ_i/2, 0, 1) ← trace.scores[i]
 *   - pool share           : Σ_t π_{i,t} / Σ_t M_t  (M_t = Σ_j m_{j,t})
 *   - wager share          : Σ_t m_{i,t} / Σ_t M_t
 *   - skill premium        : pool share − wager share  (draft w_i(s_i − s̄), real:43)
 *   - reliability / PIT    : coverage_i(τ_k) = (1/T) Σ_t 1[y_t ≤ q_{i,t}(τ_k)]
 *                            ideal coverage = τ_k (calibration diagonal)
 *   - budget-balance gap   : Σ_i π_i − Σ_i m_i  (≈ 0 under skill-only settlement)
 */
import type { RoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

const EPS = 1e-12;

/** Pull a single forecaster's value across all rounds from a trace array. */
export function seriesForForecaster(
  traces: RoundTrace[],
  index: number,
  field: 'wealth_after' | 'sigma_new' | 'sigma_t' | 'profit' | 'scores' | 'effectiveWager' | 'deposits' | 'weights',
): number[] {
  return traces.map((t) => t[field][index] ?? 0);
}

/** Bankroll trajectory W_{i,t} (trace.wealth_after). Prepends nothing; one point per round. */
export function bankrollSeries(traces: RoundTrace[], index: number): number[] {
  return seriesForForecaster(traces, index, 'wealth_after');
}

/** Skill trajectory σ_{i,t+1} (trace.sigma_new), the EWMA-driven skill estimate. */
export function skillSeries(traces: RoundTrace[], index: number): number[] {
  return seriesForForecaster(traces, index, 'sigma_new');
}

/** Per-round profit π_i − m_i = m_i(s_i − s̄) (trace.profit). Signed. */
export function profitSeries(traces: RoundTrace[], index: number): number[] {
  return seriesForForecaster(traces, index, 'profit');
}

/** Bounded score series s_i = clip(1 − Ĉ_i/2, 0, 1) (trace.scores). */
export function scoreSeries(traces: RoundTrace[], index: number): number[] {
  return seriesForForecaster(traces, index, 'scores');
}

export interface ForecasterRollup {
  index: number;
  /** Final skill σ (last round's sigma_new). */
  sigma: number;
  /** Final wealth W (last round's wealth_after). */
  wealth: number;
  /** Mean bounded score over the window. */
  meanScore: number;
  /** Cumulative profit Σ_t (π_{i,t} − m_{i,t}). */
  totalProfit: number;
  /** Pool share Σ_t π_{i,t} / Σ_t M_t. */
  poolShare: number;
  /** Wager share Σ_t m_{i,t} / Σ_t M_t. */
  wagerShare: number;
  /** Skill premium = pool share − wager share (draft real:43). */
  skillPremium: number;
  /** Mean weight w_i over the window. */
  meanWeight: number;
}

/**
 * Roll a forecaster's whole-window summary up from the traces.
 *
 * Pool share and wager share both normalise by the *same* denominator
 * Σ_t M_t (total effective wager across the window), so skill premium =
 * pool share − wager share is exactly Σ_t (π_{i,t} − m_{i,t}) / Σ_t M_t,
 * the per-forecaster net pool share the draft reports (real:43).
 */
export function rollupForecaster(traces: RoundTrace[], index: number): ForecasterRollup {
  let payoffSum = 0;
  let wagerSum = 0;
  let totalMassSum = 0;
  let scoreSum = 0;
  let scoreCount = 0;
  let weightSum = 0;
  let profitTotal = 0;

  for (const t of traces) {
    const m = t.effectiveWager[index] ?? 0;
    payoffSum += t.totalPayoff[index] ?? 0;
    wagerSum += m;
    profitTotal += t.profit[index] ?? 0;
    weightSum += t.weights[index] ?? 0;
    totalMassSum += t.effectiveWager.reduce((s, v) => s + v, 0);
    if (t.participated[index]) {
      scoreSum += t.scores[index] ?? 0;
      scoreCount += 1;
    }
  }

  const last = traces[traces.length - 1];
  const poolShare = totalMassSum > EPS ? payoffSum / totalMassSum : 0;
  const wagerShare = totalMassSum > EPS ? wagerSum / totalMassSum : 0;

  return {
    index,
    sigma: last ? last.sigma_new[index] ?? 0 : 0,
    wealth: last ? last.wealth_after[index] ?? 0 : 0,
    meanScore: scoreCount > 0 ? scoreSum / scoreCount : 0,
    totalProfit: profitTotal,
    poolShare,
    wagerShare,
    skillPremium: poolShare - wagerShare,
    meanWeight: traces.length > 0 ? weightSum / traces.length : 0,
  };
}

/** Roll up every forecaster in the panel. */
export function rollupPanel(traces: RoundTrace[], n: number): ForecasterRollup[] {
  return Array.from({ length: n }, (_, i) => rollupForecaster(traces, i));
}

export interface CalibrationPoint {
  /** Nominal quantile level τ_k. */
  tau: number;
  /** Empirical coverage: fraction of rounds with y_t ≤ q_{i,t}(τ_k). */
  coverage: number;
}

/**
 * Reliability / calibration curve for one forecaster.
 *
 * For each quantile level τ_k, the empirical coverage is the fraction of
 * observed rounds in which the realised outcome fell at or below the
 * forecaster's predicted τ_k quantile:
 *
 *     coverage_i(τ_k) = (1/T) Σ_t 1[ y_t ≤ q_{i,t}(τ_k) ]
 *
 * A perfectly calibrated forecaster has coverage_i(τ_k) = τ_k for every k
 * (the 45-degree diagonal). This is the standard quantile-reliability
 * diagnostic (Gneiting, Balabdaoui & Raftery 2007 - calibration via the PIT;
 * the per-level coverage is the discretised PIT reliability curve). Only
 * rounds where the forecaster actually participated are counted.
 */
export function calibrationCurve(traces: RoundTrace[], index: number): CalibrationPoint[] {
  const counts = TAUS.map(() => 0);
  let n = 0;
  for (const t of traces) {
    if (!t.participated[index]) continue;
    const q = t.qReports[index];
    if (!q || q.length < TAUS.length) continue;
    n += 1;
    for (let k = 0; k < TAUS.length; k++) {
      if (t.y <= q[k]) counts[k] += 1;
    }
  }
  return TAUS.map((tau, k) => ({
    tau,
    coverage: n > 0 ? counts[k] / n : 0,
  }));
}

/**
 * Budget-balance residual for a single round: Σ_i π_i − Σ_i m_i.
 *
 * Under the skill-only settlement this is identically zero up to floating
 * point (draft Property 1, `B_properties.md`; trace fields skillPayoff vs
 * effectiveWager). We sum the gross skill payoff, not totalPayoff, so the
 * residual is meaningful only when no external utility pool is on.
 */
export function budgetBalanceResidual(trace: RoundTrace): number {
  const payoff = trace.skillPayoff.reduce((s, v) => s + v, 0);
  const wager = trace.effectiveWager.reduce((s, v) => s + v, 0);
  return payoff - wager;
}

/** Skill gate g(σ) = λ + (1 − λ) σ^η (draft eq:effective-wager). View-side mirror for labels. */
export function skillGate(sigma: number, lam: number, eta: number): number {
  const s = Math.max(0, Math.min(1, sigma));
  return lam + (1 - lam) * Math.pow(s, eta);
}

/** Mean of a numeric series (0 on empty). */
export function meanOf(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

/** Cumulative running sum of a series (same length). */
export function cumulative(values: number[]): number[] {
  const out: number[] = [];
  let acc = 0;
  for (const v of values) {
    acc += v;
    out.push(acc);
  }
  return out;
}
