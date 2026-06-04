/**
 * Cross-experiment result consistency analysis.
 *
 * Ranks methods per experiment by mean CRPS, computes Kendall's W
 * for concordance, and detects contradictions where method A beats
 * method B in one experiment but not another.
 *
 * Pure functions — no side effects.
 *
 * Requirements: 3.1, 3.2, 3.5, 13.1, 13.2, 13.3, 13.4
 */

import type { MethodRank, ConsistencyResult } from './types';
import { kendallW } from './kendallW';

/**
 * Rank methods by ascending mean CRPS (lower = better = rank 1).
 * Ties (identical meanCrps) receive the same rank.
 */
export function rankMethods(
  methods: { method: string; meanCrps: number }[],
): { method: string; rank: number; meanCrps: number }[] {
  if (methods.length === 0) return [];

  // Sort ascending by meanCrps
  const sorted = [...methods].sort((a, b) => a.meanCrps - b.meanCrps);

  const ranked: { method: string; rank: number; meanCrps: number }[] = [];
  let currentRank = 1;

  for (let i = 0; i < sorted.length; i++) {
    // If this item has the same CRPS as the previous, assign the same rank
    if (i > 0 && sorted[i].meanCrps === sorted[i - 1].meanCrps) {
      ranked.push({
        method: sorted[i].method,
        rank: ranked[i - 1].rank,
        meanCrps: sorted[i].meanCrps,
      });
    } else {
      ranked.push({
        method: sorted[i].method,
        rank: currentRank,
        meanCrps: sorted[i].meanCrps,
      });
    }
    currentRank++;
  }

  return ranked;
}

/**
 * Compute the cross-experiment consistency matrix.
 *
 * For each experiment, ranks the methods by ascending mean CRPS.
 * Builds a MethodRank[] matrix and a numeric rank matrix for
 * Kendall's W computation. Detects contradictions where method A
 * beats method B in one experiment but the reverse holds in another.
 *
 * Returns ConsistencyResult with matrix, kendallW, isConsistent
 * (W > 0.7), and contradictions.
 */
export function computeConsistencyMatrix(
  experimentResults: Map<string, { method: string; meanCrps: number }[]>,
): ConsistencyResult {
  const experiments = Array.from(experimentResults.keys());

  if (experiments.length === 0) {
    return {
      matrix: [],
      kendallW: 0,
      isConsistent: false,
      contradictions: [],
    };
  }

  // Collect all unique method names across experiments
  const allMethods = new Set<string>();
  for (const results of experimentResults.values()) {
    for (const r of results) {
      allMethods.add(r.method);
    }
  }
  const methodList = Array.from(allMethods).sort();

  if (methodList.length < 2) {
    return {
      matrix: [],
      kendallW: 0,
      isConsistent: false,
      contradictions: [],
    };
  }

  // Build MethodRank[] matrix and per-experiment rank maps
  const matrix: MethodRank[] = [];
  const ranksByExperiment = new Map<string, Map<string, number>>();

  for (const experiment of experiments) {
    const results = experimentResults.get(experiment)!;
    const ranked = rankMethods(results);

    const rankMap = new Map<string, number>();
    for (const r of ranked) {
      rankMap.set(r.method, r.rank);
      matrix.push({
        experiment,
        method: r.method,
        rank: r.rank,
        meanCrps: r.meanCrps,
      });
    }
    ranksByExperiment.set(experiment, rankMap);
  }

  // Build numeric rank matrix for kendallW: ranks[experiment][method]
  // Each experiment is a "judge", each method is an "item"
  const rankMatrix: number[][] = [];
  for (const experiment of experiments) {
    const rankMap = ranksByExperiment.get(experiment)!;
    const row: number[] = methodList.map((m) => rankMap.get(m) ?? methodList.length);
    rankMatrix.push(row);
  }

  const w = kendallW(rankMatrix);

  // Detect contradictions: method A beats method B in one experiment
  // but method B beats method A in another
  const contradictions: ConsistencyResult['contradictions'] = [];
  const seen = new Set<string>();

  for (let i = 0; i < experiments.length; i++) {
    for (let j = i + 1; j < experiments.length; j++) {
      const expA = experiments[i];
      const expB = experiments[j];
      const ranksA = ranksByExperiment.get(expA)!;
      const ranksB = ranksByExperiment.get(expB)!;

      for (let mi = 0; mi < methodList.length; mi++) {
        for (let mj = mi + 1; mj < methodList.length; mj++) {
          const methodA = methodList[mi];
          const methodB = methodList[mj];

          const rankA_inExpA = ranksA.get(methodA);
          const rankB_inExpA = ranksA.get(methodB);
          const rankA_inExpB = ranksB.get(methodA);
          const rankB_inExpB = ranksB.get(methodB);

          // Skip if either method is missing from an experiment
          if (
            rankA_inExpA === undefined ||
            rankB_inExpA === undefined ||
            rankA_inExpB === undefined ||
            rankB_inExpB === undefined
          ) {
            continue;
          }

          // Contradiction: A beats B in one experiment, B beats A in another
          const aBeatsBInExpA = rankA_inExpA < rankB_inExpA;
          const bBeatsAInExpB = rankB_inExpB < rankA_inExpB;

          if (aBeatsBInExpA && bBeatsAInExpB) {
            const key = `${methodA}-${methodB}-${expA}-${expB}`;
            if (!seen.has(key)) {
              seen.add(key);
              contradictions.push({
                experimentA: expA,
                experimentB: expB,
                methodA,
                methodB,
                description: `${methodA} beats ${methodB} in ${expA} (rank ${rankA_inExpA} vs ${rankB_inExpA}) but ${methodB} beats ${methodA} in ${expB} (rank ${rankB_inExpB} vs ${rankA_inExpB})`,
              });
            }
          }
        }
      }
    }
  }

  return {
    matrix,
    kendallW: w,
    isConsistent: w > 0.7,
    contradictions,
  };
}
