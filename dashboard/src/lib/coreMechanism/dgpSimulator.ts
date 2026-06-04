/**
 * Client-side DGP simulators for the Core mechanism demo.
 * Mirrors onlinev2 DGPs: baseline (exogenous), latent_fixed (exogenous),
 * aggregation_method1 (endogenous), aggregation_method3 (endogenous).
 */
import { createSeededRng, normCdf, normPpf } from './seededRng';

export type DGPId = 'baseline' | 'latent_fixed' | 'aggregation_method1' | 'aggregation_method3';

/**
 * Quantile grids for CRPS scoring.
 *
 * TAUS_COARSE: 5-level non-equidistant grid (legacy). Adequate for quick checks
 * but produces a less accurate CRPS approximation because the trapezoidal rule
 * is not exact on non-equidistant grids.
 *
 * TAUS_FINE: 9-level equidistant grid. Recommended for new experiments and
 * aligned with Python onlinev2.core.scoring.TAUS_FINE. Provides better CRPS
 * approximation quality.
 *
 * TAUS: alias for TAUS_FINE (the recommended default).
 */
export const TAUS_COARSE = [0.1, 0.25, 0.5, 0.75, 0.9] as const;
export const TAUS_FINE = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9] as const;
export const TAUS = TAUS_FINE;
export type Taus = typeof TAUS;

export interface DGPOption {
  id: DGPId;
  label: string;
  truthSource: 'exogenous' | 'endogenous';
  description: string;
  formula: string;
}

export const DGP_OPTIONS: DGPOption[] = [
  {
    id: 'baseline',
    label: 'Baseline (exogenous)',
    truthSource: 'exogenous',
    description: 'Truth is drawn independently each round. Forecasters see y plus noise.',
    formula: 'y \\sim U(0,1);\\; r_i = \\mathrm{clip}(y + \\varepsilon_i, 0, 1)',
  },
  {
    id: 'latent_fixed',
    label: 'Latent-fixed (exogenous)',
    truthSource: 'exogenous',
    description: 'Latent Z is drawn first; y = Φ(Z). Forecasters see noisy signals of Z; reports = Φ(posterior mean).',
    formula: 'Z \\sim N(0,\\sigma_Z^2),\\; y = \\Phi(Z);\\; r_i = \\Phi(\\mu_{i,t})',
  },
  {
    id: 'aggregation_method1',
    label: 'Aggregation method 1 (endogenous)',
    truthSource: 'endogenous',
    description: 'Truth is a weighted mix of forecaster latent signals plus noise. Shared AR(1) state.',
    formula: 'y = \\Phi(w^\\top x_{\\mathrm{latent}} + \\varepsilon);\\; \\mu_t \\; \\mathrm{AR}(1)',
  },
  {
    id: 'aggregation_method3',
    label: 'Aggregation method 3 (endogenous)',
    truthSource: 'endogenous',
    description: 'Like method 1, plus per-forecaster mean shocks η so each forecaster has a time-varying centre.',
    formula: 'y = \\Phi(w^\\top x + \\varepsilon);\\; x_i = \\mu_t + \\eta_{i,t} + \\sigma_i \\xi_{i,t}',
  },
];

export interface RoundData {
  t: number;
  y: number;
  reports: number[];
  /** Quantile reports: qReports[i][k] = forecaster i's τ_k quantile. */
  qReports: number[][];
}

export interface DGPSeries {
  rounds: RoundData[];
  tauTrue?: number[]; // forecaster noise / skill (DGP-side)
  meta?: Record<string, unknown>;
}

function clip(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function boxMuller(rng: () => number): number {
  const u1 = rng(), u2 = rng();
  if (u1 < 1e-12) return boxMuller(rng);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Pre-computed z_tau = Φ⁻¹(τ) for each quantile level. */
const Z_TAU = TAUS.map(tau => normPpf(tau));

/** Generate quantile reports from a latent-space point and noise level.
 *  q_k = Φ(pointLatent + sigma * z_tau_k), monotonised. */
function quantilesFromLatent(pointLatent: number, sigma: number): number[] {
  const raw = Z_TAU.map(z => normCdf(pointLatent + sigma * z));
  // Enforce monotonicity
  for (let k = 1; k < raw.length; k++) {
    if (raw[k] < raw[k - 1]) raw[k] = raw[k - 1];
  }
  return raw;
}

/** Baseline: y ~ U(0,1), reports_i = clip(y + N(0, tau_i^2), 0, 1). */
export function generateBaseline(
  seed: number,
  T: number,
  n: number
): DGPSeries {
  const rng = createSeededRng(seed);
  const tau: number[] = [];
  for (let i = 0; i < n; i++) {
    const ln = Math.log(rng()) * 0.4 - 2.5;
    tau.push(Math.max(0.01, Math.exp(ln)));
  }
  const rounds: RoundData[] = [];
  for (let t = 0; t < T; t++) {
    const y = rng();
    const reports: number[] = [];
    const qReports: number[][] = [];
    for (let i = 0; i < n; i++) {
      const eps = boxMuller(rng) * tau[i];
      const pointLatent = normPpf(clip(y + eps, 1e-6, 1 - 1e-6));
      reports.push(clip(y + eps, 0, 1));
      qReports.push(quantilesFromLatent(pointLatent, tau[i]));
    }
    rounds.push({ t, y, reports, qReports });
  }
  return { rounds, tauTrue: tau, meta: {} };
}

/** Latent-fixed: Z ~ N(0, sigma_z^2), y = Φ(Z); X_i = Z + beta_i + tau_i*eps; mu = (sigma_z^2/(sigma_z^2+tau_i^2))*(X_i - beta_i); reports = Φ(mu). */
export function generateLatentFixed(
  seed: number,
  T: number,
  n: number,
  sigmaZ: number = 1,
  tau_i?: number[],
  beta_i?: number[],
): DGPSeries {
  const rng = createSeededRng(seed);
  const tau = tau_i ?? Array.from({ length: n }, () => 0.3 + rng() * 0.5);
  const beta = beta_i ?? Array.from({ length: n }, () => 0);
  const sigmaZ2 = sigmaZ * sigmaZ;
  const rounds: RoundData[] = [];
  for (let t = 0; t < T; t++) {
    const Z = boxMuller(rng) * sigmaZ;
    const y = normCdf(Z);
    const reports: number[] = [];
    const qReports: number[][] = [];
    for (let i = 0; i < n; i++) {
      const eps = boxMuller(rng);
      const X = Z + beta[i] + tau[i] * eps;
      const denom = sigmaZ2 + tau[i] * tau[i];
      const mu = (sigmaZ2 / denom) * (X - beta[i]);
      const postVar = (sigmaZ2 * tau[i] * tau[i]) / denom;
      const postSd = Math.sqrt(postVar);
      reports.push(normCdf(mu));
      qReports.push(quantilesFromLatent(mu, postSd));
    }
    rounds.push({ t, y, reports, qReports });
  }
  return { rounds, tauTrue: tau, meta: { sigma_z: sigmaZ } };
}

/** AR(1): mu[0]=mu0, mu[t] = rho*mu[t-1] + sigma_state * z_t. */
function ar1(T: number, rng: () => number, rho: number, sigmaState: number, mu0: number): number[] {
  const mu: number[] = [mu0];
  for (let t = 1; t < T; t++) {
    mu.push(rho * mu[t - 1] + sigmaState * boxMuller(rng));
  }
  return mu;
}

/** Aggregation: x_latent[i,t] = centre[i,t] + sigmas[i]*xi[i,t]; y_latent = w@x_latent + sigma_eps*eps; y = link(y_latent); reports = link(x_latent). Method 3 adds eta. */
export function generateAggregation(
  seed: number,
  T: number,
  n: number,
  method: 1 | 3,
  w?: number[],
  sigmas?: number[],
  sigmaEps: number = 0.25,
  rhoMu: number = 0.98,
  sigmaState: number = 0.35,
  sigmaMuNoise: number = 1
): DGPSeries {
  const rng = createSeededRng(seed);
  const W = w ?? Array.from({ length: n }, () => 1 / n);
  // Use raw weights as-is — do NOT normalise to simplex.
  // The LMS learner should recover the structural weights, not a normalised version.
  const sigs = sigmas ?? Array.from({ length: n }, () => 0.5);
  const mu_t = ar1(T, rng, rhoMu, sigmaState, 0);
  const rounds: RoundData[] = [];
  for (let t = 0; t < T; t++) {
    const eta = method === 3
      ? Array.from({ length: n }, () => sigmaMuNoise * boxMuller(rng))
      : Array(n).fill(0);
    const xLatent: number[] = [];
    for (let i = 0; i < n; i++) {
      const centre = mu_t[t] + eta[i];
      xLatent.push(centre + sigs[i] * boxMuller(rng));
    }
    const yLatent = xLatent.reduce((sum, x, i) => sum + W[i] * x, 0) + sigmaEps * boxMuller(rng);
    const y = normCdf(yLatent);
    const reports = xLatent.map(z => normCdf(z));
    const qReports = xLatent.map((z, i) => quantilesFromLatent(z, sigs[i]));
    rounds.push({ t, y, reports, qReports });
  }
  return {
    rounds,
    tauTrue: sigs,
    meta: { method, w: W },
  };
}

export function generateDGP(
  dgpId: DGPId,
  seed: number,
  T: number,
  n: number
): DGPSeries {
  switch (dgpId) {
    case 'baseline':
      return generateBaseline(seed, T, n);
    case 'latent_fixed':
      return generateLatentFixed(seed, T, n);
    case 'aggregation_method1':
      return generateAggregation(seed, T, n, 1);
    case 'aggregation_method3':
      return generateAggregation(seed, T, n, 3);
    default:
      return generateBaseline(seed, T, n);
  }
}
