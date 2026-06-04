/** Check for discrepancy (>2× difference) between real and synthetic delta CRPS. */
export function hasDiscrepancyWarning(
  realDeltaCrps: number | null,
  syntheticDeltaCrps: number | null,
): boolean {
  return (
    realDeltaCrps != null &&
    syntheticDeltaCrps != null &&
    syntheticDeltaCrps !== 0 &&
    Math.abs(realDeltaCrps / syntheticDeltaCrps) > 2
  );
}
