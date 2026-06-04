/**
 * React hook that generates a one-sentence auto-interpretation for a chart
 * based on its type and data.
 *
 * Uses `useMemo` to avoid recomputing on every render.
 *
 * Requirements: 22.2, 22.7
 */

import { useMemo } from 'react';

/** Input configuration for the auto-interpretation hook. */
export interface InterpretationInput {
  /** The type of chart being interpreted. */
  chartType:
    | 'delta-bar'
    | 'line-comparison'
    | 'calibration'
    | 'concentration'
    | 'heatmap';
  /** The chart's underlying data rows. */
  data: Record<string, unknown>[];
  /** Optional list of method names present in the data. */
  methods?: string[];
  /**
   * Threshold below which a delta is considered not statistically significant.
   * Defaults to 0.05.
   */
  significanceThreshold?: number;
}

const NO_SIGNIFICANCE_MSG =
  'No statistically significant difference detected';

/**
 * Safely coerce an unknown value to a finite number, returning `NaN` when
 * the value is not numeric or not finite.
 */
function toNum(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  return NaN;
}

// ── Per-chart-type interpretation helpers ────────────────────────────

/**
 * Delta-bar: find the method with the most negative delta and report its
 * improvement percentage.  A delta is only considered significant when its
 * absolute value exceeds the significance threshold.
 */
function interpretDeltaBar(
  data: Record<string, unknown>[],
  threshold: number,
): string {
  let bestMethod = '';
  let bestDelta = 0;

  for (const row of data) {
    const delta = toNum(row['delta'] ?? row['Delta'] ?? row['DELTA']);
    const method =
      String(row['method'] ?? row['Method'] ?? row['label'] ?? row['name'] ?? '');
    if (Number.isNaN(delta)) continue;
    if (delta < bestDelta) {
      bestDelta = delta;
      bestMethod = method;
    }
  }

  // No significant improvement found
  if (bestDelta === 0 || Math.abs(bestDelta) <= threshold) {
    return NO_SIGNIFICANCE_MSG;
  }

  const pct = Math.abs(bestDelta * 100).toFixed(1);
  return `${bestMethod} achieves the largest improvement at ${pct}% reduction in CRPS.`;
}

/**
 * Line-comparison: compare the final values of each method and report which
 * is best (lowest final value).
 */
function interpretLineComparison(
  data: Record<string, unknown>[],
  methods: string[],
  threshold: number,
): string {
  if (methods.length === 0 || data.length === 0) return NO_SIGNIFICANCE_MSG;

  let bestMethod = '';
  let bestValue = Infinity;

  for (const method of methods) {
    // Walk backwards to find the last row with a finite value for this method
    for (let i = data.length - 1; i >= 0; i--) {
      const v = toNum(data[i][method]);
      if (!Number.isNaN(v)) {
        if (v < bestValue) {
          bestValue = v;
          bestMethod = method;
        }
        break;
      }
    }
  }

  if (!bestMethod || !Number.isFinite(bestValue)) return NO_SIGNIFICANCE_MSG;

  // Check if the difference between best and second-best exceeds threshold
  const others = methods.filter((m) => m !== bestMethod);
  let secondBest = Infinity;
  for (const method of others) {
    for (let i = data.length - 1; i >= 0; i--) {
      const v = toNum(data[i][method]);
      if (!Number.isNaN(v)) {
        if (v < secondBest) secondBest = v;
        break;
      }
    }
  }

  if (
    Number.isFinite(secondBest) &&
    Math.abs(secondBest - bestValue) <= threshold
  ) {
    return NO_SIGNIFICANCE_MSG;
  }

  return `${bestMethod} achieves the best final value of ${bestValue.toFixed(4)}.`;
}

/**
 * Calibration: report the mean absolute deviation from the diagonal
 * (perfect calibration line where pHat === tau).
 */
function interpretCalibration(data: Record<string, unknown>[]): string {
  let sum = 0;
  let count = 0;

  for (const row of data) {
    const tau = toNum(row['tau'] ?? row['nominal'] ?? row['x']);
    const pHat = toNum(row['pHat'] ?? row['observed'] ?? row['y']);
    if (Number.isNaN(tau) || Number.isNaN(pHat)) continue;
    sum += Math.abs(pHat - tau);
    count++;
  }

  if (count === 0) return NO_SIGNIFICANCE_MSG;

  const mad = sum / count;
  return `Mean absolute deviation from perfect calibration is ${mad.toFixed(4)}.`;
}

/**
 * Concentration: report the Gini range across methods.
 */
function interpretConcentration(
  data: Record<string, unknown>[],
  methods: string[],
): string {
  const giniValues: number[] = [];

  if (methods.length > 0) {
    // Try to read Gini values keyed by method name
    for (const method of methods) {
      for (const row of data) {
        const g = toNum(row[method]);
        if (!Number.isNaN(g)) {
          giniValues.push(g);
          break; // take first valid value per method
        }
      }
    }
  }

  // Fallback: look for a 'gini' field in each row
  if (giniValues.length === 0) {
    for (const row of data) {
      const g = toNum(row['gini'] ?? row['Gini'] ?? row['GINI']);
      if (!Number.isNaN(g)) giniValues.push(g);
    }
  }

  if (giniValues.length === 0) return NO_SIGNIFICANCE_MSG;

  const min = Math.min(...giniValues);
  const max = Math.max(...giniValues);
  const range = max - min;

  return `Gini coefficient ranges from ${min.toFixed(3)} to ${max.toFixed(3)} (range ${range.toFixed(3)}).`;
}

/**
 * Heatmap: report the range of values across all cells.
 */
function interpretHeatmap(data: Record<string, unknown>[]): string {
  let min = Infinity;
  let max = -Infinity;

  for (const row of data) {
    for (const key of Object.keys(row)) {
      const v = toNum(row[key]);
      if (Number.isNaN(v)) continue;
      if (v < min) min = v;
      if (v > max) max = v;
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return NO_SIGNIFICANCE_MSG;
  }

  const range = max - min;
  return `Values range from ${min.toFixed(4)} to ${max.toFixed(4)} (range ${range.toFixed(4)}).`;
}

// ── Main hook ───────────────────────────────────────────────────────

/**
 * Generate a one-sentence auto-interpretation for a chart.
 *
 * Returns a human-readable summary string with the key statistic and method
 * name.  Falls back to "No statistically significant difference detected"
 * when the data is empty or no method achieves significance.
 */
export function useAutoInterpretation(input: InterpretationInput): string {
  const { chartType, data, methods = [], significanceThreshold = 0.05 } = input;

  return useMemo(() => {
    if (!data || data.length === 0) return NO_SIGNIFICANCE_MSG;

    switch (chartType) {
      case 'delta-bar':
        return interpretDeltaBar(data, significanceThreshold);
      case 'line-comparison':
        return interpretLineComparison(data, methods, significanceThreshold);
      case 'calibration':
        return interpretCalibration(data);
      case 'concentration':
        return interpretConcentration(data, methods);
      case 'heatmap':
        return interpretHeatmap(data);
      default:
        return NO_SIGNIFICANCE_MSG;
    }
  }, [chartType, data, methods, significanceThreshold]);
}
