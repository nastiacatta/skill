/**
 * Pure helper functions for the Skill Recognition section of ResultsPage.
 * No React dependencies — these are used by the chart rendering logic
 * and are independently testable.
 */

/**
 * Returns line styling for a forecaster based on whether it is the
 * currently selected (highlighted) forecaster.
 *
 * - Selected: full opacity, thick stroke
 * - Background: faded opacity, thin stroke
 */
export function getLineStyle(
  selectedIndex: number,
  currentIndex: number,
): { opacity: number; strokeWidth: number } {
  if (selectedIndex === currentIndex) {
    return { opacity: 1.0, strokeWidth: 2.5 };
  }
  return { opacity: 0.12, strokeWidth: 1 };
}

/**
 * Scans all `sigma_0` through `sigma_{N-1}` keys in the data array and
 * returns a tight Y-axis domain: [max(0, min - 0.02), min(1, max + 0.02)].
 * Returns [0, 1] if data is empty.
 */
export function computeSigmaDomain(
  data: Record<string, number>[],
  forecasterCount: number,
): [number, number] {
  if (data.length === 0) return [0, 1];

  let min = Infinity;
  let max = -Infinity;

  for (const pt of data) {
    for (let j = 0; j < forecasterCount; j++) {
      const v = pt[`sigma_${j}`];
      if (v != null && !isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
  }

  if (!isFinite(min) || !isFinite(max)) return [0, 1];

  return [Math.max(0, min - 0.02), Math.min(1, max + 0.02)];
}

/**
 * Returns the `index` of the steady-state entry with the highest
 * `mean_sigma`, or -1 if the array is empty.
 */
export function getDefaultForecaster(
  steadyState: Array<{ index: number; mean_sigma: number }>,
): number {
  if (steadyState.length === 0) return -1;

  let bestIdx = steadyState[0].index;
  let bestSigma = steadyState[0].mean_sigma;

  for (let i = 1; i < steadyState.length; i++) {
    if (steadyState[i].mean_sigma > bestSigma) {
      bestSigma = steadyState[i].mean_sigma;
      bestIdx = steadyState[i].index;
    }
  }

  return bestIdx;
}

/**
 * Returns a new array sorted in descending order by `mean_sigma`.
 * Does not mutate the input.
 */
export function sortSteadyState<T extends { mean_sigma: number }>(
  steadyState: T[],
): T[] {
  return [...steadyState].sort((a, b) => b.mean_sigma - a.mean_sigma);
}

/**
 * Returns an array of indices `[0..N-1]` reordered so that
 * `selectedIndex` is placed last (renders on top in Recharts).
 * If `selectedIndex` is out of range, returns normal order.
 */
export function buildLineRenderOrder(
  forecasterCount: number,
  selectedIndex: number,
): number[] {
  const order: number[] = [];
  for (let i = 0; i < forecasterCount; i++) {
    order.push(i);
  }

  if (selectedIndex < 0 || selectedIndex >= forecasterCount) {
    return order;
  }

  // Move selectedIndex to the end
  const filtered = order.filter((i) => i !== selectedIndex);
  filtered.push(selectedIndex);
  return filtered;
}

/**
 * Maps steady-state entries to bar chart data with palette colours.
 * No cap on the number of entries — all forecasters are included.
 */
export function buildBarData(
  steadyState: Array<{
    forecaster: string;
    index: number;
    mean_sigma: number;
  }>,
  palette: string[],
): Array<{
  name: string;
  sigma: number;
  fill: string;
  originalIndex: number;
}> {
  return steadyState.map((entry) => ({
    name: entry.forecaster,
    sigma: entry.mean_sigma,
    fill: palette[entry.index % palette.length],
    originalIndex: entry.index,
  }));
}
