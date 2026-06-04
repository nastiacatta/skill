/**
 * Kendall's W (coefficient of concordance).
 *
 * Pure function — no side effects.
 *
 * Requirements: 13.2
 */

/**
 * Compute Kendall's W (coefficient of concordance).
 *
 * Input: `ranks[i][j]` = rank assigned to item j by judge i.
 *
 * W = 12 * S / (k² * (n³ − n))
 *
 * where:
 *   k = number of judges (rows)
 *   n = number of items (columns)
 *   S = sum of squared deviations of column rank-sums from their mean
 *
 * Guards:
 * - Empty input → 0
 * - k < 2 or n < 2 → 0
 */
export function kendallW(ranks: number[][]): number {
  const k = ranks.length;
  if (k < 2) return 0;

  const n = ranks[0]?.length ?? 0;
  if (n < 2) return 0;

  // Compute column rank-sums: R_j = sum over all judges of rank[i][j]
  const columnSums: number[] = new Array(n).fill(0);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < n; j++) {
      columnSums[j] += ranks[i][j];
    }
  }

  // Mean of column rank-sums
  const meanColumnSum = columnSums.reduce((a, b) => a + b, 0) / n;

  // S = sum of squared deviations from the mean
  const S = columnSums.reduce(
    (sum, rj) => sum + (rj - meanColumnSum) ** 2,
    0,
  );

  const denominator = k * k * (n * n * n - n);
  if (denominator === 0) return 0;

  return (12 * S) / denominator;
}
