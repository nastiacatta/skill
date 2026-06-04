/**
 * Full behaviour taxonomy: 46 items across 9 families with coverage status.
 *
 * Sourced from the project taxonomy and BEHAVIOUR_COVERAGE.md audit.
 */

import type { TaxonomyItem } from './hiddenAttributes';

export const TAXONOMY_ITEMS: TaxonomyItem[] = [
  // ── Participation (7 items) ──────────────────────────────────────────────
  { name: 'Availability', family: 'participation', status: 'taxonomy-only' },
  { name: 'Burstiness', family: 'participation', status: 'experiment', presetId: 'bursty', tab: 'Participation' },
  { name: 'Deadline effects', family: 'participation', status: 'not-covered' },
  { name: 'Selection on edge', family: 'participation', status: 'taxonomy-only' },
  { name: 'Selection on confidence', family: 'participation', status: 'not-covered' },
  { name: 'Avoiding skill decay', family: 'participation', status: 'taxonomy-only' },
  { name: 'Task choice', family: 'participation', status: 'not-covered' },

  // ── Information (6 items) ────────────────────────────────────────────────
  { name: 'Signal precision', family: 'information', status: 'taxonomy-only' },
  { name: 'Systematic bias', family: 'information', status: 'experiment', presetId: 'biased', tab: 'Information' },
  { name: 'Miscalibration', family: 'information', status: 'experiment', presetId: 'miscalibrated', tab: 'Information' },
  { name: 'Correlated errors', family: 'information', status: 'taxonomy-only' },
  { name: 'Drift adaptation', family: 'information', status: 'experiment', tab: 'Information' },
  { name: 'Costly information', family: 'information', status: 'not-covered' },

  // ── Reporting (6 items) ──────────────────────────────────────────────────
  { name: 'Truthful reporting', family: 'reporting', status: 'experiment', presetId: 'baseline', tab: 'Reporting' },
  { name: 'Noisy reporting', family: 'reporting', status: 'experiment', presetId: 'noisy_reporter', tab: 'Reporting' },
  { name: 'Hedged reports', family: 'reporting', status: 'experiment', presetId: 'risk_averse', tab: 'Reporting' },
  { name: 'Strategic misreporting', family: 'reporting', status: 'experiment', presetId: 'manipulator', tab: 'Adversarial' },
  { name: 'Reputation gaming', family: 'reporting', status: 'experiment', presetId: 'reputation_gamer', tab: 'Reporting' },
  { name: 'Sandbagging', family: 'reporting', status: 'experiment', presetId: 'sandbagger', tab: 'Reporting' },

  // ── Staking (4 items) ────────────────────────────────────────────────────
  { name: 'Budget constraints', family: 'staking', status: 'experiment', presetId: 'budget_constrained', tab: 'Staking' },
  { name: 'Deposit policies', family: 'staking', status: 'experiment', tab: 'Staking' },
  { name: 'House-money effect', family: 'staking', status: 'experiment', presetId: 'house_money', tab: 'Staking' },
  { name: 'Kelly-like sizing', family: 'staking', status: 'experiment', presetId: 'kelly_sizer', tab: 'Staking' },

  // ── Objectives (5 items) ─────────────────────────────────────────────────
  { name: 'Expected value vs CRRA', family: 'objectives', status: 'experiment', tab: 'Objectives' },
  { name: 'Risk aversion', family: 'objectives', status: 'experiment', presetId: 'risk_averse', tab: 'Objectives' },
  { name: 'Loss aversion', family: 'objectives', status: 'taxonomy-only' },
  { name: 'Signalling', family: 'objectives', status: 'taxonomy-only' },
  { name: 'Leaderboard motives', family: 'objectives', status: 'taxonomy-only' },

  // ── Identity (5 items) ───────────────────────────────────────────────────
  { name: 'Single identity', family: 'identity', status: 'experiment', presetId: 'baseline', tab: 'Identity' },
  { name: 'Sybil split', family: 'identity', status: 'experiment', presetId: 'sybil', tab: 'Identity' },
  { name: 'Collusion', family: 'identity', status: 'experiment', presetId: 'collusion', tab: 'Identity' },
  { name: 'Reputation reset', family: 'identity', status: 'experiment', presetId: 'reputation_reset', tab: 'Identity' },
  { name: 'Dormancy/reactivation', family: 'identity', status: 'taxonomy-only' },

  // ── Learning (3 items) ───────────────────────────────────────────────────
  { name: 'Reinforcement from profits', family: 'learning', status: 'experiment', presetId: 'reinforcement_learner', tab: 'Learning' },
  { name: 'Rule learning', family: 'learning', status: 'taxonomy-only' },
  { name: 'Exploration vs exploitation', family: 'learning', status: 'not-covered' },

  // ── Adversarial (6 items) ────────────────────────────────────────────────
  { name: 'Manipulation', family: 'adversarial', status: 'experiment', presetId: 'manipulator', tab: 'Adversarial' },
  { name: 'Arbitrage', family: 'adversarial', status: 'experiment', presetId: 'arbitrageur', tab: 'Adversarial' },
  { name: 'Evasion', family: 'adversarial', status: 'experiment', presetId: 'evader', tab: 'Adversarial' },
  { name: 'Sybil attack', family: 'adversarial', status: 'experiment', presetId: 'sybil', tab: 'Identity' },
  { name: 'Collusion attack', family: 'adversarial', status: 'experiment', presetId: 'collusion', tab: 'Identity' },
  { name: 'Volume gaming', family: 'adversarial', status: 'taxonomy-only' },

  // ── Operational (4 items) ────────────────────────────────────────────────
  { name: 'Latency', family: 'operational', status: 'experiment', presetId: 'latency_exploiter', tab: 'Operational' },
  { name: 'Missed rounds', family: 'operational', status: 'experiment', presetId: 'bursty', tab: 'Participation' },
  { name: 'Interface errors', family: 'operational', status: 'taxonomy-only' },
  { name: 'Automation patterns', family: 'operational', status: 'taxonomy-only' },
];
