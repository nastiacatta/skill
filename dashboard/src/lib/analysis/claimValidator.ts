/**
 * Claim validation against loaded experiment data.
 *
 * Pure functions — no side effects.
 *
 * Priority ordering: unverifiable > contradicted > stale > valid
 *
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6
 */

import type {
  EnrichedThesisClaim,
  ClaimValidationResult,
  MasterComparisonRow,
} from './types';

/**
 * Parse the first numeric value from a metric string.
 *
 * Examples:
 *   "ΔCRPS = -21% on wind data"  → -21
 *   "Rank correlation > 0.9"     → 0.9
 *   "ΔGini ≈ 0, ΔN_eff ≈ 0"    → 0
 *   "PIT coverage gap < 5%..."   → 5
 *   "ΔCRPS close to 0"          → 0
 */
function parseStatedValue(metric: string): number | null {
  // Match optional sign, digits, optional decimal part
  const match = metric.match(/-?\d+(?:\.\d+)?/);
  return match ? parseFloat(match[0]) : null;
}

/**
 * Compute the metric value from experiment data for a given claim.
 *
 * For master_comparison data: filter rows by method matching
 * claim.evidence.comparison_method, compute mean of the metric_field.
 *
 * For skill_recovery: look for rank_correlation field.
 * For calibration: look for coverage_gap field.
 */
function computeMetricValue(
  claim: EnrichedThesisClaim,
  experimentData: MasterComparisonRow[],
): number | null {
  const { metric_field, comparison_method } = claim.evidence;

  // Special case: skill_recovery uses rank_correlation
  if (metric_field === 'rank_correlation') {
    const values = experimentData
      .map((row) => (row as unknown as Record<string, unknown>)[metric_field])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  // Special case: calibration uses coverage_gap
  if (metric_field === 'coverage_gap') {
    const values = experimentData
      .map((row) => (row as unknown as Record<string, unknown>)[metric_field])
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    if (values.length === 0) return null;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  // Default: master_comparison style — filter by comparison_method, compute mean
  const filtered = experimentData.filter(
    (row) => row.method === comparison_method,
  );

  if (filtered.length === 0) return null;

  const values = filtered
    .map((row) => (row as unknown as Record<string, unknown>)[metric_field])
    .filter((v): v is number => typeof v === 'number' && !isNaN(v));

  if (values.length === 0) return null;

  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Validate a single thesis claim against loaded experiment data.
 *
 * Priority ordering: unverifiable > contradicted > stale > valid
 *
 * - If experimentData is null → status = 'unverifiable'
 * - If computed sign differs from expected_sign → 'contradicted'
 * - If |computed - stated| / |stated| > 0.10 → 'stale'
 * - Otherwise → 'valid'
 */
export function validateClaim(
  claim: EnrichedThesisClaim,
  experimentData: MasterComparisonRow[] | null,
): ClaimValidationResult {
  const claimId = claim.id;

  // Priority 1: unverifiable
  if (experimentData === null || experimentData.length === 0) {
    return {
      claimId,
      status: 'unverifiable',
      computedValue: null,
      statedValue: null,
      discrepancyPct: null,
      message: `No experiment data available for "${claim.experimentName}"`,
    };
  }

  const computedValue = computeMetricValue(claim, experimentData);

  if (computedValue === null) {
    return {
      claimId,
      status: 'unverifiable',
      computedValue: null,
      statedValue: null,
      discrepancyPct: null,
      message: `Could not compute metric "${claim.evidence.metric_field}" from experiment data`,
    };
  }

  const statedValue = parseStatedValue(claim.metric);

  // Priority 2: contradicted — computed sign differs from expected_sign
  const { expected_sign } = claim.evidence;
  const computedIsPositive = computedValue > 0;
  const computedIsNegative = computedValue < 0;

  if (
    (expected_sign === 'positive' && computedIsNegative) ||
    (expected_sign === 'negative' && computedIsPositive)
  ) {
    return {
      claimId,
      status: 'contradicted',
      computedValue,
      statedValue,
      discrepancyPct: null,
      message: `Computed value (${computedValue.toFixed(4)}) has opposite sign to expected "${expected_sign}"`,
    };
  }

  // Priority 3: stale — relative error > 10%
  if (statedValue !== null && statedValue !== 0) {
    const discrepancyPct =
      Math.abs(computedValue - statedValue) / Math.abs(statedValue);
    if (discrepancyPct > 0.1) {
      return {
        claimId,
        status: 'stale',
        computedValue,
        statedValue,
        discrepancyPct: Math.round(discrepancyPct * 10000) / 100,
        message: `Computed value (${computedValue.toFixed(4)}) differs from stated (${statedValue}) by ${(discrepancyPct * 100).toFixed(1)}%`,
      };
    }
  }

  // Priority 4: valid
  const discrepancyPct =
    statedValue !== null && statedValue !== 0
      ? Math.round(
          (Math.abs(computedValue - statedValue) / Math.abs(statedValue)) *
            10000,
        ) / 100
      : null;

  return {
    claimId,
    status: 'valid',
    computedValue,
    statedValue,
    discrepancyPct,
    message: 'Claim is supported by loaded data',
  };
}

/**
 * Validate all thesis claims. Returns one result per claim.
 *
 * Iterates over claims, looks up data by claim.experimentName,
 * calls validateClaim for each.
 */
export function validateAllClaims(
  claims: EnrichedThesisClaim[],
  dataByExperiment: Map<string, MasterComparisonRow[]>,
): ClaimValidationResult[] {
  return claims.map((claim) => {
    const experimentData = dataByExperiment.get(claim.experimentName) ?? null;
    return validateClaim(claim, experimentData);
  });
}
