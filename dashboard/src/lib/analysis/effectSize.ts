/**
 * Effect size computation and labelling.
 *
 * Pure functions — no side effects.
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7
 */

import type { EffectSizeResult, EffectSizeLabel } from './types';

/**
 * Compute Cohen's d from per-seed paired deltas.
 *
 * d = mean(deltas) / sd(deltas)
 *
 * Guards:
 * - Empty array → d = 0, label = 'negligible'
 * - Constant array (sd = 0) → d = 0, label = 'negligible'
 */
export function computeCohensD(pairedDeltas: number[]): EffectSizeResult {
  const n = pairedDeltas.length;
  if (n === 0) {
    return { cohensD: 0, label: 'negligible' };
  }

  const mean = pairedDeltas.reduce((sum, v) => sum + v, 0) / n;

  // Compute population-style sd (using n, not n-1) consistent with
  // the design spec: d = mean(deltas) / sd(deltas).
  const variance =
    pairedDeltas.reduce((sum, v) => sum + (v - mean) ** 2, 0) / n;
  const sd = Math.sqrt(variance);

  if (sd === 0) {
    return { cohensD: 0, label: labelEffectSize(0) };
  }

  const d = mean / sd;
  return { cohensD: d, label: labelEffectSize(Math.abs(d)) };
}

/**
 * Label an effect size magnitude per conventional thresholds.
 *
 * | Range          | Label       |
 * |----------------|-------------|
 * | [0, 0.2)       | negligible  |
 * | [0.2, 0.5)     | small       |
 * | [0.5, 0.8)     | medium      |
 * | [0.8, ∞)       | large       |
 */
export function labelEffectSize(absCohensD: number): EffectSizeLabel {
  if (absCohensD < 0.2) return 'negligible';
  if (absCohensD < 0.5) return 'small';
  if (absCohensD < 0.8) return 'medium';
  return 'large';
}
