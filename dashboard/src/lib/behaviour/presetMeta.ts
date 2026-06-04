/**
 * Full 19-preset configuration registry.
 *
 * Maps every BehaviourPresetId to a PresetConfig with hidden attributes,
 * tunable parameters, and family assignments.
 */

import type {
  BehaviourPresetId,
  PresetConfig,
  HiddenAttributes,
} from './hiddenAttributes';

// ── Shared attribute helpers ───────────────────────────────────────────────

const HONEST_BASE: HiddenAttributes = {
  intrinsicSkill: 0.75,
  crraGamma: 0,
  participationBaseline: 0.88,
  bias: 0,
  initialBudget: 16,
  identityCount: 1,
};

function honest(overrides?: Partial<HiddenAttributes>): HiddenAttributes {
  return { ...HONEST_BASE, ...overrides };
}

// ── Preset configs ─────────────────────────────────────────────────────────

export const PRESET_CONFIGS: Record<BehaviourPresetId, PresetConfig> = {
  // ── Existing 9 presets ───────────────────────────────────────────────────

  baseline: {
    id: 'baseline',
    label: 'Benign baseline',
    description: 'Mostly truthful forecasters with steady participation.',
    family: 'reporting',
    levers: ['high participation', 'small signal noise', 'balanced deposits'],
    agentProfiles: [
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'n', label: 'Agents', min: 3, max: 20, step: 1, default: 6 },
    ],
  },

  bursty: {
    id: 'bursty',
    label: 'Bursty participation',
    description:
      'Participation is clustered in time, so some rounds are crowded and others sparse.',
    family: 'participation',
    levers: ['attendance bursts', 'missing rounds'],
    agentProfiles: [
      { role: 'honest', count: 5, attributes: honest({ participationBaseline: 0.55 }) },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'participationShock', label: 'Burst intensity', min: 0, max: 1, step: 0.05, default: 0.5 },
    ],
  },

  risk_averse: {
    id: 'risk_averse',
    label: 'Risk-averse hedgers',
    description: 'Agents stake less and report more cautiously.',
    family: 'objectives',
    levers: ['smaller deposits', 'tighter reports'],
    agentProfiles: [
      { role: 'honest', count: 5, attributes: honest({ crraGamma: 1.5 }) },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'gamma', label: 'CRRA γ', min: 0, max: 5, step: 0.1, default: 1.5 },
    ],
  },

  manipulator: {
    id: 'manipulator',
    label: 'Manipulator',
    description:
      'One agent pushes reports directionally and stakes more aggressively.',
    family: 'adversarial',
    levers: ['biased report', 'higher deposits'],
    agentProfiles: [
      { role: 'manipulator', count: 1, attributes: honest({ bias: 0.22, intrinsicSkill: 0.62 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'manipulation', label: 'Manipulation strength', min: 0, max: 1, step: 0.05, default: 0.5 },
    ],
  },

  sybil: {
    id: 'sybil',
    label: 'Sybil split',
    description: 'A strong forecaster is split across multiple identities.',
    family: 'identity',
    levers: ['identity splitting', 'share fragmentation'],
    agentProfiles: [
      { role: 'sybil', count: 2, attributes: honest({ intrinsicSkill: 0.88, identityCount: 2, initialBudget: 8 }) },
      { role: 'honest', count: 4, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'sybilCount', label: 'Sybil identities', min: 2, max: 8, step: 1, default: 2 },
    ],
  },

  evader: {
    id: 'evader',
    label: 'Adaptive evader',
    description:
      'The attacker manipulates, but softens the attack when it becomes obvious.',
    family: 'adversarial',
    levers: ['state-dependent bias', 'stealth response'],
    agentProfiles: [
      { role: 'evader', count: 1, attributes: honest({ intrinsicSkill: 0.62 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'manipulation', label: 'Evasion strength', min: 0, max: 1, step: 0.05, default: 0.5 },
    ],
  },

  arbitrageur: {
    id: 'arbitrageur',
    label: 'Arbitrageur',
    description: 'Participates mainly when disagreement is large.',
    family: 'adversarial',
    levers: ['conditional participation', 'opportunistic staking'],
    agentProfiles: [
      { role: 'arbitrageur', count: 1, attributes: honest({ intrinsicSkill: 0.55, participationBaseline: 0.12 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'dispersionThreshold', label: 'Entry threshold', min: 0.01, max: 0.3, step: 0.01, default: 0.05, unit: 'σ' },
    ],
  },

  collusion: {
    id: 'collusion',
    label: 'Collusion',
    description:
      'Two agents coordinate participation, reports, and staking.',
    family: 'identity',
    levers: ['coordinated entry/exit', 'synchronised reports', 'concentrated staking'],
    agentProfiles: [
      { role: 'colluder', count: 2, attributes: honest({ participationBaseline: 0.8 }) },
      { role: 'honest', count: 4, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
    ],
  },

  reputation_reset: {
    id: 'reputation_reset',
    label: 'Reputation reset',
    description:
      'Agent builds reputation honestly, then exploits it with manipulation.',
    family: 'identity',
    levers: ['phase switching', 'reputation exploitation', 'delayed attack'],
    agentProfiles: [
      { role: 'reputation_reset', count: 1, attributes: honest({ intrinsicSkill: 0.75 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 100, max: 500, step: 10, default: 300 },
      { key: 'transitionRound', label: 'Attack onset round', min: 20, max: 250, step: 5, default: 100 },
    ],
  },

  // ── New 10 presets ───────────────────────────────────────────────────────

  biased: {
    id: 'biased',
    label: 'Systematic bias',
    description:
      'One agent adds a persistent directional bias to every report.',
    family: 'information',
    levers: ['biased report', 'skill downweighting'],
    agentProfiles: [
      { role: 'biased', count: 1, attributes: honest({ bias: 0.15, intrinsicSkill: 0.70 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'bias', label: 'Bias magnitude', min: 0, max: 0.5, step: 0.01, default: 0.15 },
    ],
  },

  miscalibrated: {
    id: 'miscalibrated',
    label: 'Miscalibrated reporter',
    description:
      'Overconfident agent pushes reports away from 0.5, exaggerating deviations.',
    family: 'information',
    levers: ['overconfidence factor', 'calibration distortion'],
    agentProfiles: [
      { role: 'miscalibrated', count: 1, attributes: honest({ intrinsicSkill: 0.65 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'overconfidenceFactor', label: 'Overconfidence factor', min: 1, max: 3, step: 0.1, default: 1.8 },
    ],
  },

  noisy_reporter: {
    id: 'noisy_reporter',
    label: 'Noisy reporter',
    description:
      'Agent adds random noise to truthful reports — sloppy rather than strategic.',
    family: 'reporting',
    levers: ['noise scale', 'CRPS degradation'],
    agentProfiles: [
      { role: 'noisy', count: 1, attributes: honest({ intrinsicSkill: 0.60 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'noiseScale', label: 'Noise scale', min: 0, max: 0.5, step: 0.01, default: 0.15 },
    ],
  },

  budget_constrained: {
    id: 'budget_constrained',
    label: 'Budget-constrained',
    description:
      'Agents have finite wealth that can run out, leading to ruin.',
    family: 'staking',
    levers: ['finite budget', 'ruin risk'],
    agentProfiles: [
      { role: 'budget_constrained', count: 3, attributes: honest({ initialBudget: 6 }) },
      { role: 'honest', count: 3, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'initialBudget', label: 'Starting budget', min: 1, max: 30, step: 1, default: 6, unit: '$' },
      { key: 'minDeposit', label: 'Min deposit threshold', min: 0.01, max: 2, step: 0.01, default: 0.1, unit: '$' },
    ],
  },

  house_money: {
    id: 'house_money',
    label: 'House-money effect',
    description:
      'Agents increase risk-taking after gains, decrease after losses.',
    family: 'staking',
    levers: ['gain-dependent staking', 'wealth trajectory coupling'],
    agentProfiles: [
      { role: 'house_money', count: 3, attributes: honest({ crraGamma: -0.3 }) },
      { role: 'honest', count: 3, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'houseFactor', label: 'House-money factor', min: 0, max: 2, step: 0.1, default: 0.8 },
    ],
  },

  kelly_sizer: {
    id: 'kelly_sizer',
    label: 'Kelly-like sizing',
    description:
      'Deposit proportional to estimated edge: σ × (1 − σ).',
    family: 'staking',
    levers: ['edge-proportional staking', 'Kelly fraction'],
    agentProfiles: [
      { role: 'kelly', count: 3, attributes: honest({ intrinsicSkill: 0.80 }) },
      { role: 'honest', count: 3, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'kellyFraction', label: 'Kelly fraction', min: 0.05, max: 1, step: 0.05, default: 0.5 },
    ],
  },

  reputation_gamer: {
    id: 'reputation_gamer',
    label: 'Reputation gamer',
    description:
      'Sacrifices short-term accuracy to inflate skill estimate σ by reporting near the aggregate.',
    family: 'reporting',
    levers: ['aggregate anchoring', 'σ inflation'],
    agentProfiles: [
      { role: 'reputation_gamer', count: 1, attributes: honest({ intrinsicSkill: 0.55 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'anchorWeight', label: 'Anchor weight', min: 0, max: 1, step: 0.05, default: 0.7 },
    ],
  },

  sandbagger: {
    id: 'sandbagger',
    label: 'Sandbagger',
    description:
      'Deliberately underperforms by adding large noise, lowering expectations.',
    family: 'reporting',
    levers: ['deliberate noise', 'expectation manipulation'],
    agentProfiles: [
      { role: 'sandbagger', count: 1, attributes: honest({ intrinsicSkill: 0.80 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'sandbaggingNoise', label: 'Sandbagging noise', min: 0, max: 0.5, step: 0.01, default: 0.2 },
    ],
  },

  reinforcement_learner: {
    id: 'reinforcement_learner',
    label: 'Reinforcement learner',
    description:
      'Increases participation after profitable rounds, withdraws after losses.',
    family: 'learning',
    levers: ['profit-driven participation', 'adaptive entry'],
    agentProfiles: [
      { role: 'reinforcement', count: 3, attributes: honest({ participationBaseline: 0.5 }) },
      { role: 'honest', count: 3, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'reinforceFactor', label: 'Reinforce factor', min: 0, max: 2, step: 0.1, default: 0.6 },
    ],
  },

  latency_exploiter: {
    id: 'latency_exploiter',
    label: 'Latency exploiter',
    description:
      'Reports with partial outcome information due to submission latency.',
    family: 'operational',
    levers: ['partial outcome info', 'information advantage'],
    agentProfiles: [
      { role: 'latency', count: 1, attributes: honest({ intrinsicSkill: 0.60 }) },
      { role: 'honest', count: 5, attributes: honest() },
    ],
    tunableParams: [
      { key: 'rounds', label: 'Rounds', min: 50, max: 500, step: 10, default: 300 },
      { key: 'latencyWeight', label: 'Latency weight', min: 0, max: 0.5, step: 0.01, default: 0.15 },
    ],
  },
};

/** All 19 preset IDs as an array, useful for iteration. */
export const ALL_PRESET_IDS: BehaviourPresetId[] = Object.keys(
  PRESET_CONFIGS,
) as BehaviourPresetId[];
