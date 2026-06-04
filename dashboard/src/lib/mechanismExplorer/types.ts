/** Single round trace: reports → widths → confidence → skill → deposits → wagers → weights → aggregate → scores → payouts → wealth */
export interface RoundTrace {
  t: number;
  y_true: number;
  active: boolean[];
  reports: (number | null)[];
  q10s: (number | null)[];
  q90s: (number | null)[];
  widths: (number | null)[];
  confidence: (number | null)[];
  sigma: number[];
  deposits: number[];
  wagers: number[];
  weights: number[];
  aggregate: { q50: number; q10: number; q90: number };
  scores: number[];
  scoreShares: number[];
  refunds: number[];
  payouts: number[];
  profits: number[];
  wealth: number[];
  hhi: number;
  nEff: number;
  totalDeposit: number;
  totalWager: number;
  totalRefund: number;
  totalPayout: number;
  U: number;
}

export interface SimResult {
  rounds: RoundTrace[];
  N: number;
  T: number;
}

export type SkillVariant = 'Fixed' | 'EWMA' | 'Fast adapt' | 'Slow adapt';
export type DepositVariant = 'Fixed unit' | 'Random' | 'Bankroll×conf' | 'Oracle-style';
export type InfluenceVariant = 'Equal' | 'Stake-only' | 'Skill-only' | 'Blended' | 'Capped blend';
export type AggregationVariant = 'Equal pool' | 'Linear pool' | '√-weight pool' | 'Log pool';
export type SettlementVariant = 'Skill-only' | 'Skill+bonus pool' | 'No-arbitrage';
export type BehaviourVariant =
  | 'Benign'
  | 'Bursty'
  | 'Risk-averse'
  | 'Manipulator'
  | 'Evader'
  | 'Sybil'
  | 'Arbitrageur'
  | 'Insider'
  | 'Collusion'
  | 'Rep. reset'
  | 'Biased'
  | 'Miscalibrated'
  | 'Noisy reporter'
  | 'Budget-constrained'
  | 'House-money'
  | 'Kelly sizer'
  | 'Rep. gamer'
  | 'Sandbagger'
  | 'RL learner'
  | 'Latency exploit';

export interface MechanismConfig {
  skill: SkillVariant;
  deposit: DepositVariant;
  influence: InfluenceVariant;
  aggregation: AggregationVariant;
  settlement: SettlementVariant;
  behaviour: BehaviourVariant;
}

export interface SimParams {
  T: number;
  N: number;
  gamma: number;
  lambda: number;
  eta: number;
  f: number;
  U: number;
}

export const RIBBON_KEYS = [
  'reports',
  'widths',
  'confidence',
  'sigma',
  'deposits',
  'wagers',
  'weights',
  'aggregate',
  'scores',
  'profits',
  'wealth',
] as const;

export type RibbonKey = (typeof RIBBON_KEYS)[number];
