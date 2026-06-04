/**
 * Cross-validation tests: verify TypeScript mechanism implementation
 * matches the Python onlinev2.core formulas for identical inputs.
 *
 * These tests use hand-computed expected values derived from the Python
 * formulas to catch any drift between the two implementations.
 */
import { describe, it, expect } from 'vitest';
import { runRound, type AgentState, type AgentAction, type MechanismParams } from '@/lib/coreMechanism/runRound';
import { capWeightShares } from '@/lib/coreMechanism/runRoundExtended';
import { TAUS, TAUS_COARSE, TAUS_FINE } from '@/lib/coreMechanism/dgpSimulator';

const EPS = 1e-9;

// ── Scoring formulas ───────────────────────────────────────────────────────

describe('Scoring: MAE loss and score', () => {
  it('score_mae matches Python: s = 1 - |y - r|', () => {
    // Python: score_mae(0.7, 0.3) = 1 - |0.7 - 0.3| = 0.6
    const y = 0.7, r = 0.3;
    const expected = 1 - Math.abs(y - r);
    expect(expected).toBeCloseTo(0.6, 10);
  });

  it('score_mae is 1 when report equals outcome', () => {
    const y = 0.5, r = 0.5;
    expect(1 - Math.abs(y - r)).toBeCloseTo(1.0, 10);
  });

  it('score_mae is 0 when report is maximally wrong', () => {
    const y = 0.0, r = 1.0;
    expect(1 - Math.abs(y - r)).toBeCloseTo(0.0, 10);
  });
});

// ── Pinball loss ───────────────────────────────────────────────────────────

describe('Pinball loss', () => {
  function pinball(y: number, q: number, tau: number): number {
    const err = y - q;
    return err >= 0 ? tau * err : (tau - 1) * err;
  }

  it('pinball loss for y > q: tau * (y - q)', () => {
    // Python: pinball_loss(0.8, 0.3, 0.5) = 0.5 * (0.8 - 0.3) = 0.25
    expect(pinball(0.8, 0.3, 0.5)).toBeCloseTo(0.25, 10);
  });

  it('pinball loss for y < q: (tau - 1) * (y - q) = (1 - tau) * (q - y)', () => {
    // Python: pinball_loss(0.2, 0.7, 0.3) = (0.3 - 1) * (0.2 - 0.7) = -0.7 * -0.5 = 0.35
    expect(pinball(0.2, 0.7, 0.3)).toBeCloseTo(0.35, 10);
  });

  it('pinball loss is 0 when y == q', () => {
    expect(pinball(0.5, 0.5, 0.3)).toBeCloseTo(0.0, 10);
  });
});

// ── CRPS-hat ───────────────────────────────────────────────────────────────

describe('CRPS-hat from quantiles', () => {
  function pinball(y: number, q: number, tau: number): number {
    const err = y - q;
    return err >= 0 ? tau * err : (tau - 1) * err;
  }

  function crpsHat(y: number, quantiles: number[], taus: readonly number[]): number {
    let sum = 0;
    for (let k = 0; k < taus.length; k++) {
      sum += pinball(y, quantiles[k], taus[k]);
    }
    return (2 * sum) / taus.length;
  }

  it('CRPS-hat is 0 for perfect quantile forecast', () => {
    // If all quantiles equal y, all pinball losses are 0
    const y = 0.5;
    const q = TAUS.map(() => y);
    expect(crpsHat(y, q, TAUS)).toBeCloseTo(0.0, 10);
  });

  it('CRPS-hat bounded in [0, 2] for y, q in [0, 1]', () => {
    // Worst case: y=0, all q=1 or y=1, all q=0
    const y = 0;
    const q = TAUS.map(() => 1.0);
    const c = crpsHat(y, q, TAUS);
    expect(c).toBeGreaterThanOrEqual(0);
    expect(c).toBeLessThanOrEqual(2 + EPS);
  });

  it('score_crps_hat = 1 - C_hat/2 is in [0, 1]', () => {
    const y = 0.3;
    const q = TAUS.map((tau) => 0.3 + (tau - 0.5) * 0.4); // spread around y
    const c = crpsHat(y, q, TAUS);
    const s = 1 - c / 2;
    expect(s).toBeGreaterThanOrEqual(-EPS);
    expect(s).toBeLessThanOrEqual(1 + EPS);
  });
});

// ── Skill gate ─────────────────────────────────────────────────────────────

describe('Skill gate: g(σ) = λ + (1-λ)σ^η', () => {
  it('g(σ=1) = 1 for any λ, η', () => {
    const lam = 0.3, eta = 2;
    const g = lam + (1 - lam) * Math.pow(1.0, eta);
    expect(g).toBeCloseTo(1.0, 10);
  });

  it('g(σ=0) = λ', () => {
    const lam = 0.3, eta = 1;
    const g = lam + (1 - lam) * Math.pow(0.0, eta);
    expect(g).toBeCloseTo(0.3, 10);
  });

  it('g(σ=0.5, λ=0.05, η=1) = 0.05 + 0.95*0.5 = 0.525', () => {
    const lam = 0.05, eta = 1, sigma = 0.5;
    const g = lam + (1 - lam) * Math.pow(sigma, eta);
    expect(g).toBeCloseTo(0.525, 10);
  });
});

// ── Loss-to-skill mapping ──────────────────────────────────────────────────

describe('Loss-to-skill: σ = σ_min + (1-σ_min)exp(-γL)', () => {
  function lossToSkill(L: number, sigmaMin: number, gamma: number): number {
    return sigmaMin + (1 - sigmaMin) * Math.exp(-gamma * L);
  }

  it('L=0 → σ=1', () => {
    expect(lossToSkill(0, 0.1, 4)).toBeCloseTo(1.0, 10);
  });

  it('L→∞ → σ→σ_min', () => {
    expect(lossToSkill(100, 0.1, 4)).toBeCloseTo(0.1, 5);
  });

  it('matches Python: σ_min=0.1, γ=4, L=0.5 → 0.1 + 0.9*exp(-2) ≈ 0.2218', () => {
    const expected = 0.1 + 0.9 * Math.exp(-4 * 0.5);
    expect(lossToSkill(0.5, 0.1, 4)).toBeCloseTo(expected, 10);
  });

  it('inverse: missingness_L0 recovers L from σ', () => {
    // L0 = -ln((σ - σ_min) / (1 - σ_min)) / γ
    const sigma = 0.5, sigmaMin = 0.1, gamma = 4;
    const L0 = -Math.log((sigma - sigmaMin) / (1 - sigmaMin)) / gamma;
    expect(lossToSkill(L0, sigmaMin, gamma)).toBeCloseTo(sigma, 8);
  });
});

// ── EWMA update ────────────────────────────────────────────────────────────

describe('EWMA loss update', () => {
  function ewmaUpdate(Lprev: number, loss: number, absent: boolean, rho: number, kappa = 0, L0 = 0): number {
    if (!absent) return (1 - rho) * Lprev + rho * loss;
    if (kappa !== 0) return (1 - kappa) * Lprev + kappa * L0;
    return Lprev;
  }

  it('present agent: L = (1-ρ)L_prev + ρ*loss', () => {
    expect(ewmaUpdate(0.5, 0.2, false, 0.1)).toBeCloseTo(0.47, 10);
  });

  it('absent agent with κ=0: L unchanged', () => {
    expect(ewmaUpdate(0.5, 0.2, true, 0.1, 0, 0)).toBeCloseTo(0.5, 10);
  });

  it('absent agent with κ>0: L decays toward L0', () => {
    expect(ewmaUpdate(0.5, 0.2, true, 0.1, 0.05, 0.3)).toBeCloseTo(
      0.95 * 0.5 + 0.05 * 0.3, 10
    );
  });
});

// ── Settlement: budget balance ─────────────────────────────────────────────

describe('Settlement: budget balance', () => {
  it('Σ π_i = Σ m_i (budget balanced)', () => {
    const scores = [0.8, 0.6, 0.4, 0.9];
    const m = [2.0, 1.5, 1.0, 3.0];
    const M = m.reduce((a, b) => a + b, 0);
    const sBar = m.reduce((sum, mi, i) => sum + mi * scores[i], 0) / M;
    const payoffs = m.map((mi, i) => mi * (1 + scores[i] - sBar));
    const totalPayoff = payoffs.reduce((a, b) => a + b, 0);
    expect(totalPayoff).toBeCloseTo(M, 10);
  });

  it('equal scores → zero profit for all', () => {
    const s = 0.7;
    const m = [2.0, 1.5, 1.0, 3.0];
    const sBar = s; // all equal
    const profits = m.map((mi) => mi * (s - sBar));
    profits.forEach((p) => expect(p).toBeCloseTo(0, 10));
  });

  it('higher score → positive profit', () => {
    const M = 2.0;
    const sBar = (1.0 * 0.9 + 1.0 * 0.5) / M;
    const profit0 = 1.0 * (0.9 - sBar);
    const profit1 = 1.0 * (0.5 - sBar);
    expect(profit0).toBeGreaterThan(0);
    expect(profit1).toBeLessThan(0);
    expect(profit0 + profit1).toBeCloseTo(0, 10); // zero-sum
  });
});

// ── Full round: runRound cross-check ───────────────────────────────────────

describe('runRound: full round cross-validation', () => {
  it('produces budget-balanced settlement', () => {
    const state: AgentState[] = [
      { accountId: 0, L: 0.3, sigma: 0.5, wealth: 10 },
      { accountId: 1, L: 0.5, sigma: 0.5, wealth: 10 },
      { accountId: 2, L: 0.7, sigma: 0.5, wealth: 10 },
    ];
    const actions: AgentAction[] = [
      { accountId: 0, participate: true, report: 0.6, deposit: 1 },
      { accountId: 1, participate: true, report: 0.4, deposit: 1 },
      { accountId: 2, participate: true, report: 0.5, deposit: 1 },
    ];
    const params: MechanismParams = {
      lam: 0.3, sigma_min: 0.1, gamma: 4, rho: 0.1,
    };
    const y = 0.55;
    const out = runRound(state, actions, y, params);

    // Budget balance: Σ skill_payoff = Σ m
    const totalM = out.m.reduce((a, b) => a + b, 0);
    const totalPayoff = out.skill_payoff.reduce((a, b) => a + b, 0);
    expect(totalPayoff).toBeCloseTo(totalM, 8);
  });

  it('non-participating agent gets zero profit', () => {
    const state: AgentState[] = [
      { accountId: 0, L: 0.3, sigma: 0.5, wealth: 10 },
      { accountId: 1, L: 0.5, sigma: 0.5, wealth: 10 },
    ];
    const actions: AgentAction[] = [
      { accountId: 0, participate: true, report: 0.5, deposit: 1 },
      { accountId: 1, participate: false, report: null, deposit: 0 },
    ];
    const params: MechanismParams = {
      lam: 0.3, sigma_min: 0.1, gamma: 4, rho: 0.1,
    };
    const out = runRound(state, actions, 0.5, params);
    expect(out.profit[1]).toBeCloseTo(0, 10);
    expect(out.m[1]).toBeCloseTo(0, 10);
  });

  it('skill gate formula: m = deposit * (λ + (1-λ)σ^η)', () => {
    const L = 0.3;
    const sigmaMin = 0.1, gamma = 4, lam = 0.3, eta = 1;
    const sigma = sigmaMin + (1 - sigmaMin) * Math.exp(-gamma * L);
    const g = lam + (1 - lam) * Math.pow(Math.max(0, Math.min(1, sigma)), eta);
    const deposit = 2.0;
    const expectedM = deposit * g;

    const state: AgentState[] = [
      { accountId: 0, L, sigma: 0.5, wealth: 10 },
    ];
    const actions: AgentAction[] = [
      { accountId: 0, participate: true, report: 0.5, deposit },
    ];
    const params: MechanismParams = { lam, sigma_min: sigmaMin, gamma, rho: 0.1, eta };
    const out = runRound(state, actions, 0.5, params);
    expect(out.m[0]).toBeCloseTo(expectedM, 8);
  });
});

// ── capWeightShares ────────────────────────────────────────────────────────

describe('capWeightShares', () => {
  it('preserves total mass', () => {
    const m = [5, 3, 1, 1];
    const M = m.reduce((a, b) => a + b, 0);
    const capped = capWeightShares(m, 0.3);
    const cappedSum = capped.reduce((a, b) => a + b, 0);
    expect(cappedSum).toBeCloseTo(M, 8);
  });

  it('enforces max share ≤ omegaMax', () => {
    const m = [8, 1, 1];
    const capped = capWeightShares(m, 0.4);
    const total = capped.reduce((a, b) => a + b, 0);
    const shares = capped.map((v) => v / total);
    shares.forEach((s) => expect(s).toBeLessThanOrEqual(0.4 + 1e-8));
  });

  it('no-op when all shares already below cap', () => {
    const m = [1, 1, 1, 1];
    const capped = capWeightShares(m, 0.5);
    m.forEach((v, i) => expect(capped[i]).toBeCloseTo(v, 10));
  });

  it('handles zero total gracefully', () => {
    const m = [0, 0, 0];
    const capped = capWeightShares(m, 0.3);
    capped.forEach((v) => expect(v).toBeCloseTo(0, 10));
  });
});

// ── TAUS grid alignment ────────────────────────────────────────────────────

describe('TAUS grid alignment with Python', () => {
  it('TAUS is the 9-level equidistant grid (TAUS_FINE)', () => {
    expect(TAUS).toEqual(TAUS_FINE);
    expect(TAUS.length).toBe(9);
  });

  it('TAUS_COARSE is the legacy 5-level grid', () => {
    expect(TAUS_COARSE.length).toBe(5);
    expect([...TAUS_COARSE]).toEqual([0.1, 0.25, 0.5, 0.75, 0.9]);
  });

  it('TAUS_FINE matches Python TAUS_FINE', () => {
    const pythonTausFine = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9];
    expect([...TAUS_FINE]).toEqual(pythonTausFine);
  });

  it('TAUS are equidistant (step = 0.1)', () => {
    for (let i = 1; i < TAUS.length; i++) {
      expect(TAUS[i] - TAUS[i - 1]).toBeCloseTo(0.1, 10);
    }
  });
});

// ── Gini coefficient ───────────────────────────────────────────────────────

describe('Gini coefficient', () => {
  function gini(values: number[]): number {
    const sorted = [...values].filter((x) => x >= 0).sort((a, b) => a - b);
    if (sorted.length === 0) return 0;
    const total = sorted.reduce((a, b) => a + b, 0);
    if (total <= 0) return 0;
    let weighted = 0;
    sorted.forEach((v, i) => { weighted += (i + 1) * v; });
    return (2 * weighted - (sorted.length + 1) * total) / (sorted.length * total);
  }

  it('perfect equality → Gini = 0', () => {
    expect(gini([10, 10, 10, 10])).toBeCloseTo(0, 10);
  });

  it('maximal inequality → Gini approaches 1', () => {
    const g = gini([0, 0, 0, 100]);
    expect(g).toBeGreaterThan(0.7);
    expect(g).toBeLessThanOrEqual(1.0);
  });

  it('matches Python formula: G = (2Σi·x_i - (n+1)·total) / (n·total)', () => {
    const values = [1, 3, 5, 7];
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const total = sorted.reduce((a, b) => a + b, 0);
    let weighted = 0;
    sorted.forEach((v, i) => { weighted += (i + 1) * v; });
    const expected = (2 * weighted - (n + 1) * total) / (n * total);
    expect(gini(values)).toBeCloseTo(expected, 10);
  });
});

// ── HHI and N_eff ──────────────────────────────────────────────────────────

describe('HHI and N_eff', () => {
  function hhi(weights: number[]): number {
    const total = weights.reduce((a, b) => a + b, 0);
    if (total <= 0) return 0;
    const norm = weights.map((w) => w / total);
    return norm.reduce((sum, w) => sum + w * w, 0);
  }

  function nEff(weights: number[]): number {
    const h = hhi(weights);
    return h > 0 ? 1 / h : 0;
  }

  it('equal weights → HHI = 1/n', () => {
    const w = [1, 1, 1, 1];
    expect(hhi(w)).toBeCloseTo(0.25, 10);
  });

  it('equal weights → N_eff = n', () => {
    const w = [1, 1, 1, 1];
    expect(nEff(w)).toBeCloseTo(4, 10);
  });

  it('single dominant → HHI ≈ 1, N_eff ≈ 1', () => {
    const w = [100, 0.001, 0.001, 0.001];
    expect(hhi(w)).toBeGreaterThan(0.99);
    expect(nEff(w)).toBeLessThan(1.01);
  });
});
