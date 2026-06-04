/**
 * Per-forecaster density curve construction for the StoryForecastPlot.
 *
 * FORMULA: Gaussian reconstruction from a scalar report.
 *
 *   Each forecaster submits a 9-level quantile vector q_i(τ_k). For
 *   visualisation, we approximate a density curve by assuming a Gaussian
 *   centred at the median report r_i with standard deviation σ_spread.
 *
 *   σ_spread is derived from the aggregate fan width:
 *     σ_spread = (q90 − q10) / (2 × z_0.9)
 *   where z_0.9 ≈ 1.2816 (the 90th percentile of N(0,1)).
 *
 *   Then for each τ in the TAUS grid:
 *     q_i(τ) = clip(r_i + σ_spread × Φ⁻¹(τ), 0, 1)
 *
 *   This gives a per-forecaster quantile fan consistent with the
 *   aggregate band width, centred at their individual report.
 *
 * For the density curve (PDF approximation), we evaluate the Gaussian
 * density at N evenly spaced points in [0, 1] and return (x, y) pairs
 * suitable for SVG path rendering.
 */

import { TAUS } from '@/lib/coreMechanism/dgpSimulator';

const Z_90 = 1.2816;
const DENSITY_POINTS = 80;

export interface DensityCurvePoint {
  x: number;
  y: number;
}

function gaussianPdf(x: number, mu: number, sigma: number): number {
  if (sigma <= 0) return x === mu ? 1 : 0;
  const z = (x - mu) / sigma;
  return Math.exp(-0.5 * z * z) / (sigma * Math.sqrt(2 * Math.PI));
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function computeSpread(rHatQ: number[]): number {
  if (rHatQ.length < 2) return 0.1;
  const q10 = rHatQ[0];
  const q90 = rHatQ[rHatQ.length - 1];
  const spread = (q90 - q10) / (2 * Z_90);
  return Math.max(0.02, spread);
}

export function forecasterQuantiles(
  report: number,
  spread: number,
): number[] {
  const normPpfApprox = (p: number): number => {
    // Rational approximation (Abramowitz & Stegun 26.2.23)
    if (p <= 0) return -4;
    if (p >= 1) return 4;
    if (p === 0.5) return 0;
    const sign = p < 0.5 ? -1 : 1;
    const pp = p < 0.5 ? p : 1 - p;
    const t = Math.sqrt(-2 * Math.log(pp));
    const c0 = 2.515517, c1 = 0.802853, c2 = 0.010328;
    const d1 = 1.432788, d2 = 0.189269, d3 = 0.001308;
    return sign * (t - (c0 + c1 * t + c2 * t * t) /
      (1 + d1 * t + d2 * t * t + d3 * t * t * t));
  };

  return TAUS.map((tau) => clamp01(report + spread * normPpfApprox(tau)));
}

export function forecasterDensityCurve(
  report: number,
  spread: number,
): DensityCurvePoint[] {
  const points: DensityCurvePoint[] = [];
  for (let i = 0; i <= DENSITY_POINTS; i++) {
    const x = i / DENSITY_POINTS;
    const y = gaussianPdf(x, report, spread);
    points.push({ x, y });
  }
  return points;
}

export function maxDensityHeight(
  reports: number[],
  spread: number,
): number {
  let max = 0;
  for (const r of reports) {
    const peak = gaussianPdf(r, r, spread);
    if (peak > max) max = peak;
  }
  return max || 1;
}

export { TAUS };
