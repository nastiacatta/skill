/**
 * Sensitivity analysis — process parameter sweep data to identify
 * the most/least sensitive parameters and detect crossover points.
 *
 * Pure function — no side effects.
 *
 * Requirements: 4.1, 4.2, 4.3, 4.4, 4.5
 */

import type {
  SensitivityPoint,
  SensitivitySummary,
  SweepPoint,
} from './types';

/**
 * Process sweep data into a sensitivity analysis summary.
 *
 * For each unique parameter (e.g. lam, sigmaMin), extracts a series of
 * (paramValue, deltaCrps) points. Detects crossover points where
 * deltaCrps changes sign between consecutive points. Identifies the
 * most sensitive parameter (largest range of deltaCrps) and the least
 * sensitive parameter (smallest range).
 */
export function computeSensitivity(
  sweepData: SweepPoint[],
  defaultParams: Record<string, number>,
): SensitivitySummary {
  if (sweepData.length === 0) {
    return {
      points: [],
      mostSensitiveParam: '',
      leastSensitiveParam: '',
      crossoverPoints: [],
      summaryText: 'No sweep data available.',
    };
  }

  // ── Extract per-parameter series ─────────────────────────────────
  // Each sweep point varies one parameter while others stay at defaults.
  // We detect which parameter varies by comparing against defaultParams.
  const paramKeys = Object.keys(defaultParams);
  const seriesByParam = new Map<string, { paramValue: number; deltaCrps: number }[]>();

  for (const point of sweepData) {
    for (const key of paramKeys) {
      const pointValue = getSweepValue(point, key);
      if (pointValue == null) continue;

      // A point belongs to this parameter's series if the other
      // parameters are at (or near) their default values.
      const othersAtDefault = paramKeys.every((otherKey) => {
        if (otherKey === key) return true;
        const otherVal = getSweepValue(point, otherKey);
        if (otherVal == null) return true;
        const defaultVal = defaultParams[otherKey];
        if (defaultVal == null) return true;
        return Math.abs(otherVal - defaultVal) < 1e-9;
      });

      if (!othersAtDefault) continue;

      if (!seriesByParam.has(key)) {
        seriesByParam.set(key, []);
      }

      // deltaCrps: use meanCrps relative to the default configuration's meanCrps
      // We compute deltaCrps as the difference from the baseline (default) point
      seriesByParam.get(key)!.push({
        paramValue: pointValue,
        deltaCrps: point.meanCrps,
      });
    }
  }

  // ── Normalise deltaCrps relative to default ──────────────────────
  // Find the baseline meanCrps (the point where all params are at default)
  const baselinePoint = sweepData.find((point) =>
    paramKeys.every((key) => {
      const val = getSweepValue(point, key);
      if (val == null) return true;
      const def = defaultParams[key];
      if (def == null) return true;
      return Math.abs(val - def) < 1e-9;
    }),
  );
  const baselineCrps = baselinePoint?.meanCrps ?? 0;

  const allPoints: SensitivityPoint[] = [];
  const crossoverPoints: { paramName: string; value: number }[] = [];
  const rangeByParam = new Map<string, number>();

  for (const [paramName, series] of seriesByParam) {
    // Sort by paramValue
    series.sort((a, b) => a.paramValue - b.paramValue);

    // Convert to deltaCrps relative to baseline
    const normalisedSeries = series.map((s) => ({
      paramName,
      paramValue: s.paramValue,
      deltaCrps: s.deltaCrps - baselineCrps,
    }));

    allPoints.push(...normalisedSeries);

    // Compute range of deltaCrps for this parameter
    if (normalisedSeries.length > 0) {
      const crpsValues = normalisedSeries.map((s) => s.deltaCrps);
      const minCrps = Math.min(...crpsValues);
      const maxCrps = Math.max(...crpsValues);
      rangeByParam.set(paramName, maxCrps - minCrps);
    }

    // Detect crossovers: consecutive points where deltaCrps changes sign
    for (let i = 0; i < normalisedSeries.length - 1; i++) {
      const curr = normalisedSeries[i];
      const next = normalisedSeries[i + 1];

      if (hasSignChange(curr.deltaCrps, next.deltaCrps)) {
        // Interpolate the crossover value
        const crossoverValue = interpolateCrossover(
          curr.paramValue,
          curr.deltaCrps,
          next.paramValue,
          next.deltaCrps,
        );
        crossoverPoints.push({ paramName, value: crossoverValue });
      }
    }
  }

  // ── Identify most / least sensitive parameters ───────────────────
  let mostSensitiveParam = '';
  let leastSensitiveParam = '';
  let maxRange = -Infinity;
  let minRange = Infinity;

  for (const [param, range] of rangeByParam) {
    if (range > maxRange) {
      maxRange = range;
      mostSensitiveParam = param;
    }
    if (range < minRange) {
      minRange = range;
      leastSensitiveParam = param;
    }
  }

  // ── Generate summary text ────────────────────────────────────────
  const summaryText = generateSummaryText(
    mostSensitiveParam,
    leastSensitiveParam,
    crossoverPoints,
  );

  return {
    points: allPoints,
    mostSensitiveParam,
    leastSensitiveParam,
    crossoverPoints,
    summaryText,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

/** Extract a numeric value from a SweepPoint by parameter name. */
function getSweepValue(point: SweepPoint, key: string): number | null {
  const val = (point as unknown as Record<string, unknown>)[key];
  return typeof val === 'number' ? val : null;
}

/** Check if two values have opposite signs (one positive, one negative). */
function hasSignChange(a: number, b: number): boolean {
  return (a > 0 && b < 0) || (a < 0 && b > 0);
}

/** Linear interpolation to find the zero-crossing parameter value. */
function interpolateCrossover(
  p1: number,
  d1: number,
  p2: number,
  d2: number,
): number {
  // d1 + (d2 - d1) * (p - p1) / (p2 - p1) = 0
  // p = p1 - d1 * (p2 - p1) / (d2 - d1)
  const denom = d2 - d1;
  if (Math.abs(denom) < 1e-15) return (p1 + p2) / 2;
  return p1 - d1 * (p2 - p1) / denom;
}

function generateSummaryText(
  mostSensitive: string,
  leastSensitive: string,
  crossovers: { paramName: string; value: number }[],
): string {
  if (!mostSensitive && !leastSensitive) {
    return 'No sweep data available.';
  }

  let text = `Results are most sensitive to ${mostSensitive}`;
  if (leastSensitive && leastSensitive !== mostSensitive) {
    text += ` and least sensitive to ${leastSensitive}`;
  }
  text += '.';

  if (crossovers.length > 0) {
    const crossoverDescs = crossovers.map(
      (c) => `${c.paramName} ≈ ${c.value.toFixed(3)}`,
    );
    text += ` Sign flips occur at: ${crossoverDescs.join(', ')}.`;
  }

  return text;
}
