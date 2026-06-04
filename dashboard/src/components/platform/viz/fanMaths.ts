/**
 * Quantile-fan maths shared by the interactive composer and its tests.
 *
 * The editable fan is parameterised by a (median, spread) pair and produces a
 * monotone, clamped 9-quantile vector using the *same* generator the DGP uses
 * (`quantilesFromLatent`, `dgpSimulator.ts`):
 *
 *     q_k = Φ( Φ⁻¹(median) + spread · z_{τ_k} ),   z_{τ_k} = Φ⁻¹(τ_k)
 *
 * then monotonised (q_k ≥ q_{k-1}) and clamped to [0, 1]. This guarantees the
 * non-crossing property fan charts require (Bank of England fan-chart
 * convention; Chernozhukov et al. 2010 on quantile rearrangement) and means a
 * visitor-authored fan is scored by exactly the rule the simulator applies to
 * the DGP panel - no faked or mismatched distribution.
 *
 * Spread is the latent standard deviation; larger spread = wider interval.
 */
import { normCdf, normPpf } from '@/lib/coreMechanism/seededRng';
import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

const Z_TAU = TAUS.map((tau) => normPpf(tau));

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** Enforce q_k ≥ q_{k-1} in place-safe copy, clamped to [0, 1]. */
export function monotonise(q: number[]): number[] {
  const out = q.map(clamp01);
  for (let k = 1; k < out.length; k++) {
    if (out[k] < out[k - 1]) out[k] = out[k - 1];
  }
  return out;
}

/**
 * Build a monotone, clamped quantile fan from a median and a latent spread.
 * Mirrors `quantilesFromLatent` in the DGP so the visitor's fan is a valid
 * member of the same family the panel draws from.
 */
export function fanFromMedianSpread(median: number, spread: number): number[] {
  const m = clamp01(median);
  const s = Math.max(0.01, spread);
  const latent = normPpf(m);
  const raw = Z_TAU.map((z) => normCdf(latent + s * z));
  return monotonise(raw);
}

/** Recover an approximate (median, spread) from an existing quantile vector. */
export function medianSpreadFromFan(q: number[]): { median: number; spread: number } {
  const mid = Math.floor(q.length / 2);
  const median = clamp01(q[mid]);
  // Estimate spread from the 80% interval width in latent space:
  // q10 = Φ(latent + s·z10), q90 = Φ(latent + s·z90) ⇒ s ≈ (Φ⁻¹(q90) − Φ⁻¹(q10)) / (z90 − z10).
  const z10 = Z_TAU[0];
  const z90 = Z_TAU[Z_TAU.length - 1];
  const lo = normPpf(clamp01(q[0]));
  const hi = normPpf(clamp01(q[q.length - 1]));
  const spread = Math.max(0.01, (hi - lo) / (z90 - z10));
  return { median, spread };
}

/** The "be honest" target: the DGP's true conditional quantiles for a latent point. */
export function honestFan(pointLatent: number, sigma: number): number[] {
  const raw = Z_TAU.map((z) => normCdf(pointLatent + sigma * z));
  return monotonise(raw);
}
