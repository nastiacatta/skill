export interface BlockVariant {
  formula: string;
  desc: string;
}

export interface BlockDef {
  id: keyof import('./types').MechanismConfig;
  label: string;
  num: string;
  variants: Record<string, BlockVariant>;
  default: string;
}

export const SKILL_BLOCK: BlockDef = {
  id: 'skill',
  label: 'Skill update',
  num: '01',
  default: 'Fast adapt',
  variants: {
    Fixed: { formula: 'σ = σ_min', desc: 'Skill unchanged across rounds' },
    EWMA: {
      formula: 'σ = α·σ + (1-α)·L̄',
      desc: 'Exponential smoothing of past loss',
    },
    'Fast adapt': {
      formula: 'σ = σ_min + (1-σ_min)e^{-γL}',
      desc: 'Rapid skill recovery after loss (default)',
    },
    'Slow adapt': {
      formula: 'σ = σ_min + (1-σ_min)e^{-0.2L}',
      desc: 'Conservative skill recovery',
    },
  },
};

export const DEPOSIT_BLOCK: BlockDef = {
  id: 'deposit',
  label: 'Deposit policy',
  num: '02',
  default: 'Bankroll×conf',
  variants: {
    'Fixed unit': {
      formula: 'b = min(W, b_max)',
      desc: 'Always bet maximum allowed',
    },
    Random: { formula: 'b ~ U(0, W·f)', desc: 'Random fraction of wealth' },
    'Bankroll×conf': {
      formula: 'b = min(W, f·W·c, b_max)',
      desc: 'Confidence-scaled bankroll (default)',
    },
    'Oracle-style': {
      formula: 'b = W·f if skilled else ε',
      desc: 'High deposit only when confident',
    },
  },
};

export const INFLUENCE_BLOCK: BlockDef = {
  id: 'influence',
  label: 'Influence rule',
  num: '03',
  default: 'Blended',
  variants: {
    Equal: { formula: 'm = b', desc: 'Raw deposit equals wager' },
    'Stake-only': { formula: 'm = b·λ', desc: 'Fixed stake fraction only' },
    'Skill-only': {
      formula: 'm = b·σ^η',
      desc: 'Wager scaled purely by skill',
    },
    Blended: {
      formula: 'm = b(λ + (1-λ)σ^η)',
      desc: 'Stake-skill blend (default)',
    },
    'Capped blend': {
      formula: 'm = min(b(λ + (1-λ)σ^η), cap)',
      desc: 'Blended but capped at market share',
    },
  },
};

export const AGGREGATION_BLOCK: BlockDef = {
  id: 'aggregation',
  label: 'Aggregation',
  num: '04',
  default: 'Linear pool',
  variants: {
    'Equal pool': {
      formula: 'q̂ = (1/N)Σ q_i',
      desc: 'Uniform weights over all forecasters',
    },
    'Linear pool': {
      formula: 'q̂ = Σ w̃_i q_i',
      desc: 'Wager-weighted pool (default)',
    },
    '√-weight pool': {
      formula: 'w̃_i ∝ √m_i',
      desc: 'Square-root of effective wager for weights',
    },
    'Log pool': {
      formula: 'q̂ ∝ exp(Σ w̃_i log q_i)',
      desc: 'Geometric (softmax) pool by wager weight',
    },
  },
};

export const SETTLEMENT_BLOCK: BlockDef = {
  id: 'settlement',
  label: 'Settlement',
  num: '05',
  default: 'Skill+utility',
  variants: {
    'Skill-only': {
      formula: 'pay = U·score_i/Σscore',
      desc: 'Distribute by CRPS score',
    },
    'Skill+utility': {
      formula: 'pay = refund + U·score_i/Σscore',
      desc: 'Refund unused deposit + skill reward (default)',
    },
    'No-arbitrage': {
      formula: 'pay = b + ΔWealth_mkt',
      desc: 'Market equilibrium payoff',
    },
  },
};

export const BEHAVIOUR_BLOCK: BlockDef = {
  id: 'behaviour',
  label: 'Behaviour layer',
  num: '06',
  default: 'Benign',
  variants: {
    Benign: {
      formula: 'q ~ N(y, σ_i)',
      desc: 'Honest unbiased forecasters',
    },
    Bursty: {
      formula: 'active ~ Bernoulli(p_on)',
      desc: 'Intermittent participation',
    },
    'Risk-averse': {
      formula: 'Conservative reports, lower stake',
      desc: 'Hedgers: reports closer to centre',
    },
    Manipulator: {
      formula: 'Biased report, higher deposits',
      desc: 'One agent pushes away from consensus',
    },
    Evader: {
      formula: 'State-dependent bias, stealth',
      desc: 'Adaptive evader when manipulation obvious',
    },
    Sybil: {
      formula: 'N_extra clones, split wealth',
      desc: 'Identity-splitting attack',
    },
    Arbitrageur: {
      formula: 'Participate when disagreement large',
      desc: 'Opportunistic staking',
    },
    Insider: {
      formula: 'q ~ N(y, 0.1σ) with prob p_ins',
      desc: 'Some forecasters see near-true outcome',
    },
  },
};

export const BLOCK_DEFS = [
  SKILL_BLOCK,
  DEPOSIT_BLOCK,
  INFLUENCE_BLOCK,
  AGGREGATION_BLOCK,
  SETTLEMENT_BLOCK,
  BEHAVIOUR_BLOCK,
];

export interface ParamDef {
  id: keyof import('./types').SimParams;
  label: string;
  min: number;
  max: number;
  step: number;
  val: number;
}

export const PARAM_DEFS: ParamDef[] = [
  { id: 'T', label: 'Rounds (T)', min: 10, max: 80, step: 5, val: 40 },
  { id: 'N', label: 'Forecasters (N)', min: 3, max: 12, step: 1, val: 6 },
  { id: 'gamma', label: 'γ (skill decay)', min: 0.1, max: 5, step: 0.1, val: 1.5 },
  { id: 'lambda', label: 'λ (stake weight)', min: 0, max: 1, step: 0.05, val: 0.3 },
  { id: 'eta', label: 'η (skill exponent)', min: 0.5, max: 3, step: 0.1, val: 1.0 },
  { id: 'f', label: 'f (max fraction)', min: 0.1, max: 0.9, step: 0.05, val: 0.4 },
  { id: 'U', label: 'U (utility per round)', min: 10, max: 200, step: 10, val: 50 },
];

export interface RibbonStepDef {
  key: import('./types').RibbonKey;
  sym: string;
  label: string;
}

export const RIBBON_STEPS: RibbonStepDef[] = [
  { key: 'reports', sym: 'q_i', label: 'Report' },
  { key: 'widths', sym: 'Δ_i', label: 'Width' },
  { key: 'confidence', sym: 'c_i', label: 'Conf.' },
  { key: 'sigma', sym: 'σ_i', label: 'Skill' },
  { key: 'deposits', sym: 'b_i', label: 'Deposit' },
  { key: 'wagers', sym: 'm_i', label: 'Wager' },
  { key: 'weights', sym: 'w̃_i', label: 'Weight' },
  { key: 'aggregate', sym: 'q̂', label: 'Aggregate' },
  { key: 'scores', sym: 's_i', label: 'Score' },
  { key: 'profits', sym: 'π_i', label: 'Profit' },
  { key: 'wealth', sym: 'W_i', label: 'Wealth' },
];

export const STEP_DESC: Record<string, string> = {
  reports:
    'Each forecaster submits a predictive distribution. The median is shown here.',
  widths:
    'Interval width Δ_i = q(0.9) − q(0.1) measures uncertainty. Narrower → more confident.',
  confidence:
    'c_i = clip(e^{−β·Δ_i}, c_min, c_max). High confidence means a tight forecast.',
  sigma:
    'σ_i ∈ [σ_min,1] tracks historical skill via past CRPS loss. Updates each round.',
  deposits:
    'b_i = min(W_i, f·W_i·c_i, b_max). Wealth staked this round.',
  wagers:
    'm_i = b_i(λ + (1−λ)σ_i^η). Effective wager amplified by skill–stake blend.',
  weights:
    'w̃_i = m_i / Σm_j. Normalised market share. Drives the pooled forecast.',
  aggregate:
    'q̂ = Σw̃_i·q_i. Wager-weighted mixture of forecaster distributions.',
  scores:
    'CRPS score: lower is better. Measures calibration + sharpness simultaneously.',
  profits:
    'π_i = payout − deposit. Negative if forecaster loses money this round.',
  wealth: 'W_i ← W_i + π_i. Persistent wealth carries forward to next round.',
};
