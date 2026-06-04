import type {
  ExperimentMeta,
  RunSummary,
  SkillWagerPoint,
  ForecastSeriesPoint,
  CalibrationPoint,
  BehaviourScenario,
  SweepPoint,
  RoundSeries,
  FixedDepositPoint,
} from '../types';

const rng = (seed: number) => {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
};

/** Thesis question groups for experiment selector (README: aggregation, intermittency, sybil, arbitrage, adaptation). */
export type ThesisGroup =
  | 'aggregation'
  | 'intermittency'
  | 'sybil'
  | 'arbitrage'
  | 'adaptation'
  | 'core'
  | 'other';

export const mockExperiments: ExperimentMeta[] = [
  {
    name: 'skill_wager',
    displayName: 'Skill × Wager',
    description: 'Tests the interaction between online skill learning and deposit-driven effective wagers across agents with different forecast quality.',
    block: 'experiments',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 3,
    rounds: 10000,
    family: 'adaptation',
    thesisTags: ['skill', 'stake'],
  },
  {
    name: 'forecast_aggregation',
    displayName: 'Forecast Aggregation',
    description: 'Compares aggregate forecast quality across weighting rules: uniform, deposit-only, skill-only, and skill × stake.',
    block: 'experiments',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 6,
    rounds: 10000,
    family: 'aggregation',
    thesisTags: ['aggregation', 'weighting'],
  },
  {
    name: 'behaviour_matrix',
    displayName: 'Behaviour Matrix',
    description: 'Holds skill × stake fixed and varies only behaviour modules: benign baselines, realistic frictions, and adversaries.',
    block: 'behaviour',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 10,
    rounds: 10000,
    family: 'other',
    thesisTags: ['behaviour'],
  },
  {
    name: 'parameter_sweep',
    displayName: 'Parameter Sweep',
    description: 'Sweeps over λ (skill learning rate) and σ_min (minimum skill floor) to map the Pareto frontier between forecast quality and concentration.',
    block: 'experiments',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 6,
    rounds: 10000,
    family: 'adaptation',
    thesisTags: ['skill', 'sensitivity'],
  },
  {
    name: 'calibration',
    displayName: 'Calibration',
    description: 'Evaluates the calibration of the aggregate forecast by checking quantile coverage against nominal levels.',
    block: 'experiments',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 6,
    rounds: 10000,
    family: 'aggregation',
    thesisTags: ['calibration'],
  },
  {
    name: 'settlement_sanity',
    displayName: 'Settlement Sanity',
    description: 'Verifies that the settlement design is budget-balanced (zero budget gap) and payouts are non-negative across all rounds.',
    block: 'core',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 10,
    rounds: 10000,
    family: 'core',
    thesisTags: ['settlement', 'invariants'],
  },
  {
    name: 'fixed_deposit',
    displayName: 'Fixed Deposit',
    description: 'Examines skill evolution when all agents make identical fixed deposits each round, isolating the effect of forecast quality on skill trajectories.',
    block: 'experiments',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 4,
    rounds: 10000,
    family: 'adaptation',
    thesisTags: ['deposit', 'skill'],
  },
  {
    name: 'intermittency_stress_test',
    displayName: 'Intermittency Stress',
    description: 'Compares IID vs bursty vs edge-threshold vs avoid-skill-decay participation, and compares missingness handling settings.',
    block: 'behaviour',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 10,
    rounds: 10000,
    family: 'intermittency',
    thesisTags: ['participation', 'missingness'],
  },
  {
    name: 'sybil',
    displayName: 'Sybil Attack',
    description: 'Tests whether sybil splitting (one agent creating k accounts) gains an advantage under skill × stake.',
    block: 'experiments',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 6,
    rounds: 10000,
    family: 'sybil',
    thesisTags: ['identity', 'attack'],
  },
  {
    name: 'arbitrage_scan',
    displayName: 'Arbitrage Scan',
    description: 'Runs arbitrageurs across a parameter grid to see when arbitrage appears and whether it dominates wealth.',
    block: 'behaviour',
    dgp: 'baseline',
    scoringMode: 'CRPS',
    nAgents: 10,
    rounds: 10000,
    family: 'arbitrage',
    thesisTags: ['arbitrage', 'strategic'],
  },
];

export function generateMockSummary(meta: ExperimentMeta): RunSummary {
  const r = rng(meta.name.length * 31);
  return {
    experimentName: meta.name,
    finalCRPS: 0.02 + r() * 0.03,
    finalGini: 0.2 + r() * 0.3,
    finalNEff: 3 + r() * 5,
    meanHHI: 0.15 + r() * 0.15,
    meanNt: (meta.nAgents || 6) * (0.6 + r() * 0.3),
    finalRuinRate: r() > 0.7 ? r() * 0.1 : 0,
    headlineResults: {},
  };
}

export function generateMockSkillWager(nAgents: number, T: number): SkillWagerPoint[] {
  const r = rng(42);
  const points: SkillWagerPoint[] = [];
  for (let a = 0; a < nAgents; a++) {
    let sigma = 1.0;
    let cumProfit = 0;
    for (let t = 0; t < T; t++) {
      const missing = r() < 0.3;
      const wager = missing ? 0 : 0.1 + r() * 2.5;
      const mOverB = missing ? null : sigma * (0.85 + r() * 0.15);
      const profit = missing ? 0 : (r() - 0.5) * 0.04;
      cumProfit += profit;
      if (!missing) {
        sigma = Math.max(0.5, Math.min(1.0, sigma + (r() - 0.52) * 0.03));
      }
      points.push({ agent: a, t, wager, sigma, mOverB, profit, cumProfit, missing: missing });
    }
  }
  return points;
}

export function generateMockForecastSeries(T: number): ForecastSeriesPoint[] {
  const r = rng(99);
  const points: ForecastSeriesPoint[] = [];
  let cumU = 0, cumD = 0, cumS = 0, cumM = 0, cumB = 0;
  for (let t = 0; t < T; t++) {
    const base = 0.03 + r() * 0.06;
    const u = base + r() * 0.01;
    const d = base - r() * 0.005;
    const s = base - r() * 0.008;
    const m = base - r() * 0.01;
    const b = base - 0.01 + r() * 0.015;
    cumU += u; cumD += d; cumS += s; cumM += m; cumB += b;
    points.push({
      t,
      crpsUniform: u, crpsDeposit: d, crpsSkill: s, crpsMechanism: m, crpsBestSingle: b,
      crpsUniformCum: cumU / (t + 1), crpsDepositCum: cumD / (t + 1),
      crpsSkillCum: cumS / (t + 1), crpsMechanismCum: cumM / (t + 1),
      crpsBestSingleCum: cumB / (t + 1),
    });
  }
  return points;
}

export function generateMockCalibration(): CalibrationPoint[] {
  return [
    { tau: 0.1, pHat: 0.08, nValid: 300 },
    { tau: 0.25, pHat: 0.22, nValid: 300 },
    { tau: 0.5, pHat: 0.48, nValid: 300 },
    { tau: 0.75, pHat: 0.73, nValid: 300 },
    { tau: 0.9, pHat: 0.91, nValid: 300 },
  ];
}

export function generateMockBehaviourScenarios(): BehaviourScenario[] {
  return [
    { scenario: 'benign_baseline', totalProfit: 0, meanRoundProfit: 0, finalGini: 0.43, finalNEff: 4.91 },
    { scenario: 'bursty_kelly', totalProfit: 0, meanRoundProfit: 0, finalGini: 0.37, finalNEff: 4.88 },
    { scenario: 'risk_averse_hedged', totalProfit: 0, meanRoundProfit: 0, finalGini: 0.44, finalNEff: 4.64 },
    { scenario: 'lumpy_miscalibrated', totalProfit: 0, meanRoundProfit: 0, finalGini: 0.42, finalNEff: 5.05 },
    { scenario: 'edge_threshold', totalProfit: 0, meanRoundProfit: 0, finalGini: 0.40, finalNEff: 5.78 },
    { scenario: 'sybil_split', totalProfit: 0, meanRoundProfit: 0, finalGini: 0.50, finalNEff: 14.98 },
  ];
}

export function generateMockSweep(): SweepPoint[] {
  const r = rng(77);
  const points: SweepPoint[] = [];
  for (const lam of [0.0, 0.1, 0.2, 0.3, 0.5, 0.8]) {
    for (const sigmaMin of [0.05, 0.1, 0.2, 0.3]) {
      points.push({
        lam,
        sigmaMin,
        meanCrps: 0.025 + r() * 0.01 + lam * 0.002,
        gini: 0.2 + lam * 0.05 + r() * 0.05,
        fracMeaningful: 0.95 + r() * 0.05,
      });
    }
  }
  return points;
}

export function generateMockSettlementSeries(T: number): RoundSeries[] {
  const r = rng(55);
  return Array.from({ length: T }, (_, i) => ({
    round: i,
    budgetGap: (r() - 0.5) * 1e-14,
    minPayoutActive: r() * 8,
  }));
}

export function generateMockFixedDeposit(nAgents: number, T: number): FixedDepositPoint[] {
  const r = rng(33);
  const points: FixedDepositPoint[] = [];
  for (let a = 0; a < nAgents; a++) {
    let sigma = 1.0;
    const quality = 0.8 + a * 0.05;
    for (let t = 0; t < T; t++) {
      sigma = Math.max(0.6, Math.min(1.0, sigma + (r() - (1 - quality)) * 0.02));
      const wager = 1.0;
      const mOverB = sigma * (0.85 + r() * 0.15);
      points.push({ agent: a, t, sigma, wager, mOverB });
    }
  }
  return points;
}
