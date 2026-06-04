/**
 * Baseline coverage audit — check that core experiments include
 * all mandatory baselines.
 *
 * Pure function — no side effects.
 *
 * Requirements: 7.1, 7.2, 7.4, 7.6
 */

import type { BaselineCoverageEntry } from './types';
import type { ExperimentMeta } from '../types';

/** The five mandatory baselines every core experiment should compare. */
export const MANDATORY_BASELINES = [
  'equal',
  'stake-only',
  'skill-only',
  'blended',
  'bankroll',
] as const;

/**
 * Maps data-layer method names to canonical baseline names.
 * Includes identity mappings for canonical names themselves.
 *
 * Requirements: 1.1, 1.2, 1.3
 */
export const METHOD_ALIAS_MAP: Record<string, string> = {
  // Data-layer → canonical
  uniform: 'equal',
  deposit: 'stake-only',
  skill: 'skill-only',
  mechanism: 'blended',
  bankroll: 'bankroll',
  // Identity mappings (canonical → canonical)
  equal: 'equal',
  'stake-only': 'stake-only',
  'skill-only': 'skill-only',
  blended: 'blended',
  // bankroll already covered above
};

/**
 * Method names that are valid in experiment data but are not
 * baseline strategies. The audit silently skips these.
 *
 * Requirements: 8.1
 */
export const KNOWN_NON_BASELINES: readonly string[] = ['best_single'] as const;

/**
 * Resolve a data-layer method name to its canonical baseline name.
 * Returns the original name if no alias exists.
 *
 * Requirements: 1.4, 7.1, 7.2
 */
export function resolveMethodName(method: string): string {
  return METHOD_ALIAS_MAP[method] ?? method;
}

/** Set of mandatory baseline names for fast lookup. */
const MANDATORY_SET = new Set<string>(MANDATORY_BASELINES);

/** Set of known non-baseline methods for fast lookup. */
const KNOWN_NON_BASELINE_SET = new Set<string>(KNOWN_NON_BASELINES);

/**
 * Audit experiments for mandatory baseline coverage.
 *
 * Filters experiments to block = "core" or "experiments", then for each
 * experiment resolves method names through the alias map, warns on
 * unrecognised methods, and checks which mandatory baselines are present.
 *
 * Missing baselines = set difference of mandatory \ present.
 * isComplete = missingBaselines.length === 0.
 *
 * Requirements: 2.1, 3.1, 3.2, 8.2, 8.3
 */
export function auditBaselineCoverage(
  experiments: ExperimentMeta[],
  dataByExperiment: Map<string, { method: string }[]>,
): BaselineCoverageEntry[] {
  const coreExperiments = experiments.filter(
    (exp) => exp.block === 'core' || exp.block === 'experiments',
  );

  return coreExperiments.map((exp) => {
    const rows = dataByExperiment.get(exp.name) ?? [];

    // Resolve each method through the alias map and collect canonical names
    const presentSet = new Set<string>();
    for (const row of rows) {
      const raw = row.method;

      // Silently skip known non-baseline methods (Req 8.2)
      if (KNOWN_NON_BASELINE_SET.has(raw)) {
        continue;
      }

      const resolved = resolveMethodName(raw);

      // Only include resolved names that are mandatory baselines (Req 3.1, 3.2)
      if (MANDATORY_SET.has(resolved)) {
        presentSet.add(resolved);
      } else if (!(raw in METHOD_ALIAS_MAP) && !MANDATORY_SET.has(raw)) {
        // Unrecognised method: not in alias map, not a known non-baseline,
        // and not a mandatory baseline — warn for debugging (Req 8.3)
        console.warn(
          `[baselineCoverage] Unrecognised method "${raw}" in experiment "${exp.name}"`,
        );
      }
    }

    const presentBaselines = MANDATORY_BASELINES.filter((b) =>
      presentSet.has(b),
    );
    const missingBaselines = MANDATORY_BASELINES.filter(
      (b) => !presentSet.has(b),
    );

    return {
      experimentName: exp.name,
      presentBaselines: [...presentBaselines],
      missingBaselines: [...missingBaselines],
      isComplete: missingBaselines.length === 0,
    };
  });
}
