/**
 * Shared helpers for behaviour tab components.
 *
 * Extracted from BehaviourPage.tsx to avoid duplication across tab files.
 */

import { downsample } from '@/components/lab/shared';

// ── Simulation constants ───────────────────────────────────────────────────

export const SEED = 42;
export const N = 6;
export const T = 300;

// ── Verdict helpers ────────────────────────────────────────────────────────

export type Verdict = 'good' | 'neutral' | 'bad';

/** Map verdict string to MetricDisplay variant. */
export const VERDICT_VARIANT: Record<Verdict, 'verdict-good' | 'verdict-neutral' | 'verdict-bad'> = {
  good: 'verdict-good',
  neutral: 'verdict-neutral',
  bad: 'verdict-bad',
};

// ── Cumulative average ─────────────────────────────────────────────────────

/**
 * Build cumulative-average series from two (or more) round-error arrays.
 * Returns an array of objects with `round` and one key per series name.
 */
export function cumulativeAverage(
  series: Record<string, { error: number }[]>,
  maxSamples = 300,
): Record<string, number>[] {
  const keys = Object.keys(series);
  const len = Math.min(...keys.map(k => series[k].length));
  const sums: Record<string, number> = {};
  for (const k of keys) sums[k] = 0;

  const raw = Array.from({ length: len }, (_, i) => {
    const pt: Record<string, number> = { round: i + 1 };
    for (const k of keys) {
      sums[k] += series[k][i].error;
      pt[k] = sums[k] / (i + 1);
    }
    return pt;
  });
  return downsample(raw, maxSamples);
}

// ── Placeholder banner ─────────────────────────────────────────────────────

export const PLACEHOLDER_DESCRIPTIONS: Record<string, string> = {
  Staking: 'Deposit policy strategies (budget constraints, house-money effect, Kelly sizing) affect how much forecasters commit each round. The deposit amount directly controls the effective wager and thus the forecaster\'s weight in the aggregate forecast.',
  Objectives: 'Forecasters with diverse objectives (risk aversion, loss aversion, signalling motives) may deviate from truthful reporting. Understanding these deviations helps assess mechanism stability under realistic preferences.',
  Identity: 'Identity attacks (sybil splitting, collusion, reputation reset) test whether forecasters can gain unfair advantage by manipulating their identity. The mechanism\'s narrow Lambert sybil invariance should prevent splitting gains for identical clones with conserved total wager.',
  Learning: 'Adaptive learning strategies test how forecasters who adjust their behaviour based on past outcomes interact with the mechanism\'s own learning (EWMA skill updates).',
  Operational: 'Real-world operational frictions (latency exploitation, submission errors, automation failures) test mechanism stability under imperfect conditions that arise in practice.',
};
