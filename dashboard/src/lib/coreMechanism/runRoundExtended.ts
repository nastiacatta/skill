/**
 * Extended mechanism with weight cap (omegaMax), utility pool.
 * Aligned with onlinev2.core and staking.cap_weight_shares.
 */
import type { AgentState, AgentAction, MechanismParams, StepOutputs } from './runRound';
import { runRound } from './runRound';

const EPS = 1e-12;

export interface ExtendedParams extends MechanismParams {
  omegaMax?: number;
  utilityPool?: number;
  scoreThreshold?: number;
}

/** Cap weight shares per onlinev2 staking.cap_weight_shares.
 *  Projects shares onto the simplex with max share ≤ omegaMax.
 *  Returns rescaled values that sum to the original total M.
 *  Invariants: sum preserved, each share ≤ omegaMax, all non-negative. */
export function capWeightShares(m: number[], omegaMax: number): number[] {
  const cleaned = m.map((v) => Math.max(0, v));
  const M = cleaned.reduce((a, b) => a + b, 0);
  if (M <= EPS) return cleaned;
  const n = cleaned.length;
  const om = Math.max(1 / n, Math.min(1, omegaMax));

  const shares = cleaned.map((v) => v / M);
  const capped = new Array(n).fill(false);

  for (let iter = 0; iter < n; iter++) {
    let excess = 0;
    let freeTotal = 0;
    let freeCount = 0;

    for (let i = 0; i < n; i++) {
      if (capped[i]) continue;
      if (shares[i] > om + EPS) {
        excess += shares[i] - om;
        shares[i] = om;
        capped[i] = true;
      } else {
        freeTotal += shares[i];
        freeCount++;
      }
    }

    if (excess <= EPS) break;
    if (freeCount === 0) break;

    // Redistribute excess proportionally among free agents
    for (let i = 0; i < n; i++) {
      if (capped[i]) continue;
      shares[i] += (freeTotal > EPS ? shares[i] / freeTotal : 1 / freeCount) * excess;
    }
  }

  // Rescale back to original total
  const shareSum = shares.reduce((a, b) => a + b, 0);
  const result = shareSum > EPS ? shares.map((s) => (s / shareSum) * M) : cleaned;

  // Validate invariants (match Python assertions)
  if (import.meta.env.DEV) {
    const resultSum = result.reduce((a, b) => a + b, 0);
    const massTol = Math.max(EPS, 1e-8);
    if (Math.abs(resultSum - M) > massTol) {
      console.warn(`capWeightShares: mass not preserved: sum=${resultSum}, M=${M}`);
    }
    const resultShares = resultSum > EPS ? result.map((v) => v / resultSum) : result;
    const maxShare = Math.max(...resultShares);
    if (maxShare > om + massTol) {
      console.warn(`capWeightShares: cap violated: maxShare=${maxShare}, om=${om}`);
    }
    if (result.some((v) => v < -EPS)) {
      console.warn(`capWeightShares: negative value found`);
    }
  }

  return result;
}

export interface ExtendedStepOutputs extends StepOutputs {
  cappedWager: number[];
  weight: number[];
  utilityPayoff: number[];
}

/** Run one round with weight cap and optional utility pool. */
export function runRoundExtended(
  state: AgentState[],
  actions: AgentAction[],
  y_t: number,
  params: ExtendedParams
): ExtendedStepOutputs {
  const base = runRound(state, actions, y_t, params);
  const omegaMax = params.omegaMax ?? 1;
  const U = params.utilityPool ?? 0;
  const sClient = params.scoreThreshold ?? 0;

  let capped = base.m.slice();
  let weights = base.m.map((mi) => {
    const M = base.m.reduce((a, b) => a + b, 0);
    return M > EPS ? mi / M : 0;
  });

  if (omegaMax < 1) {
    capped = capWeightShares(base.m, omegaMax);
    const totalCapped = capped.reduce((a, b) => a + b, 0);
    weights = totalCapped > EPS ? capped.map((c) => c / totalCapped) : capped.map(() => 0);
  }

  const r_hat =
    base.m.reduce((a, b) => a + b, 0) > EPS
      ? weights.reduce((sum, w, i) => sum + w * (base.alpha[i] === 0 ? base.reports[i] : 0), 0)
      : base.r_hat;

  let utilityPayoff = base.m.map(() => 0);
  if (U > 0 && sClient >= 0) {
    const sTildeM = base.scores.map((s, i) =>
      s > sClient ? s * base.m[i] : 0
    );
    const denom = sTildeM.reduce((a, b) => a + b, 0);
    if (denom > EPS) {
      utilityPayoff = base.m.map((mi, i) =>
        base.scores[i] > sClient
          ? (base.scores[i] * mi * U) / denom
          : 0
      );
    }
  }

  const totalPayoff = base.skill_payoff.map((pi, i) => pi + utilityPayoff[i]);
  const profit = totalPayoff.map((tp, i) => tp - base.m[i]);
  const refundExt = base.deposits.map((d, i) => Math.max(0, d - base.m[i]));
  const wealth_new = state.map((s, i) => Math.max(0, s.wealth - base.deposits[i] + totalPayoff[i] + refundExt[i]));

  return {
    ...base,
    r_hat,
    cappedWager: capped,
    weight: weights,
    utilityPayoff,
    skill_payoff: base.skill_payoff,
    profit,
    wealth_new,
  };
}
