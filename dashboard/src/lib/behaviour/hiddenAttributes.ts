/**
 * Types and interfaces for the behaviour generative model.
 *
 * Defines the full 19-preset BehaviourPresetId union, hidden attributes,
 * preset configuration, behaviour families, and taxonomy items.
 *
 * Task 1.2 will update scenarioSimulator.ts to re-export from here.
 */

// ── Full 19-preset union type ──────────────────────────────────────────────

export type BehaviourPresetId =
  // Existing (9)
  | 'baseline'
  | 'bursty'
  | 'risk_averse'
  | 'manipulator'
  | 'sybil'
  | 'evader'
  | 'arbitrageur'
  | 'collusion'
  | 'reputation_reset'
  // New (10)
  | 'biased'
  | 'miscalibrated'
  | 'noisy_reporter'
  | 'budget_constrained'
  | 'house_money'
  | 'kelly_sizer'
  | 'reputation_gamer'
  | 'sandbagger'
  | 'reinforcement_learner'
  | 'latency_exploiter';

// ── Behaviour families ─────────────────────────────────────────────────────

export type BehaviourFamily =
  | 'participation'
  | 'information'
  | 'reporting'
  | 'staking'
  | 'objectives'
  | 'identity'
  | 'learning'
  | 'adversarial'
  | 'operational';

// ── Hidden attributes (sampled once per agent at creation) ─────────────────

/** Stable per-agent parameters sampled once at creation. */
export interface HiddenAttributes {
  /** Intrinsic signal precision — lower noise = better forecaster */
  intrinsicSkill: number;
  /** CRRA risk aversion parameter: 0 = risk-neutral, >0 = risk-averse, <0 = risk-seeking */
  crraGamma: number;
  /** Base probability of participating in any given round */
  participationBaseline: number;
  /** Systematic bias added to reports (positive = overestimate) */
  bias: number;
  /** Initial wealth / budget */
  initialBudget: number;
  /** Number of identities (1 = honest, >1 = sybil) */
  identityCount: number;
}

// ── Tunable parameter config ───────────────────────────────────────────────

export interface ParamConfig {
  key: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
  unit?: string;
}

// ── Preset configuration ───────────────────────────────────────────────────

/** Full configuration for a behaviour preset, including hidden attributes and policy parameters. */
export interface PresetConfig {
  id: BehaviourPresetId;
  label: string;
  description: string;
  family: BehaviourFamily;
  levers: string[];
  /** Hidden attributes for each agent role in this preset */
  agentProfiles: Array<{
    role: string;
    count: number;
    attributes: HiddenAttributes;
  }>;
  /** Adjustable parameters exposed in the config panel */
  tunableParams: ParamConfig[];
}

// ── Taxonomy item ──────────────────────────────────────────────────────────

export interface TaxonomyItem {
  name: string;
  family: BehaviourFamily;
  status: 'experiment' | 'taxonomy-only' | 'not-covered';
  presetId?: BehaviourPresetId;
  tab?: string;
}
