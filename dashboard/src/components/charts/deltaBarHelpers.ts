/** Determine if a bar's 95% CI excludes zero → statistically significant. */
export function isSignificant(delta: number, se: number): boolean {
  if (se <= 0) return false;
  return Math.abs(delta) > 1.96 * se;
}

/** Compute 95% CI bounds. */
export function ciBounds(delta: number, se: number): [number, number] {
  const half = 1.96 * se;
  return [delta - half, delta + half];
}
