/**
 * Behaviour scenario simulation. Mirrors the shared dashboard logic.
 */
import { runRoundExtended } from '@/lib/coreMechanism/runRoundExtended';
import type { AgentState, AgentAction } from '@/lib/coreMechanism/runRound';
import type { ExtendedParams } from '@/lib/coreMechanism/runRoundExtended';
import type { BehaviourPresetId } from './hiddenAttributes';
import { gini, mean } from '@/components/lab/shared';

// Re-export the canonical 19-preset union from hiddenAttributes.ts
export type { BehaviourPresetId } from './hiddenAttributes';

export interface ScenarioAgent {
  id: string;
  label: string;
  role: string;
  trueSkill: number;
  wealth: number;
  ewmaLoss: number;
}

export interface AgentInput {
  id: string;
  label: string;
  report: number;
  deposit: number;
  ewmaLoss: number;
  wealth: number;
  participate: boolean;
}

export interface BehaviourControls {
  preset: BehaviourPresetId;
  rounds: number;
  seed: number;
  lam: number;
  eta: number;
  sigmaMin: number;
  gamma: number;
  rho: number;
  omegaMax: number;
  manipulation: number;
  participationShock: number;
  sybilCount: number;
}

export interface BehaviourRound {
  round: number;
  outcome: number;
  aggregate: number;
  error: number;
  participation: number;
  nEff: number;
  gini: number;
  meanSigma: number;
}

export interface BehaviourSummary {
  preset: BehaviourPresetId;
  label: string;
  description: string;
  meanError: number;
  meanParticipation: number;
  meanNEff: number;
  finalGini: number;
  finalAggregate: number;
}

export interface ScenarioResult {
  rounds: BehaviourRound[];
  finalAgents: Array<ScenarioAgent & { finalWealth: number }>;
  summary: BehaviourSummary;
}

export const PRESET_META: Record<
  BehaviourPresetId,
  { label: string; description: string; levers: string[] }
> = {
  baseline: {
    label: 'Benign baseline',
    description: 'Mostly truthful forecasters with steady participation.',
    levers: ['high participation', 'small signal noise', 'balanced deposits'],
  },
  bursty: {
    label: 'Bursty participation',
    description:
      'Participation is clustered in time, so some rounds are crowded and others sparse.',
    levers: ['attendance bursts', 'missing rounds'],
  },
  risk_averse: {
    label: 'Risk-averse hedgers',
    description: 'Agents stake less and report more cautiously.',
    levers: ['smaller deposits', 'tighter reports'],
  },
  manipulator: {
    label: 'Manipulator',
    description: 'One agent pushes reports directionally and stakes more aggressively.',
    levers: ['biased report', 'higher deposits'],
  },
  sybil: {
    label: 'Sybil split',
    description: 'A strong forecaster is split across multiple identities with slightly divergent reports. Tests the practical (not theoretical) sybil scenario.',
    levers: ['identity splitting', 'share fragmentation'],
  },
  evader: {
    label: 'Adaptive evader',
    description: 'The attacker manipulates, but softens the attack when it becomes obvious.',
    levers: ['state-dependent bias', 'stealth response'],
  },
  arbitrageur: {
    label: 'Arbitrageur',
    description: 'Participates mainly when disagreement is large.',
    levers: ['conditional participation', 'opportunistic staking'],
  },
  collusion: {
    label: 'Collusion',
    description: 'Two agents coordinate participation, reports, and staking.',
    levers: ['coordinated entry/exit', 'synchronised reports', 'concentrated staking'],
  },
  reputation_reset: {
    label: 'Reputation reset',
    description: 'Agent builds reputation honestly, then exploits it with manipulation.',
    levers: ['phase switching', 'reputation exploitation', 'delayed attack'],
  },
  // ── New 10 presets ───────────────────────────────────────────────────────
  biased: {
    label: 'Systematic bias',
    description: 'One agent adds a persistent directional bias to every report.',
    levers: ['biased report', 'skill downweighting'],
  },
  miscalibrated: {
    label: 'Miscalibrated reporter',
    description: 'Overconfident agent pushes reports away from 0.5, exaggerating deviations.',
    levers: ['overconfidence factor', 'calibration distortion'],
  },
  noisy_reporter: {
    label: 'Noisy reporter',
    description: 'Agent adds random noise to truthful reports, sloppy rather than strategic.',
    levers: ['noise scale', 'CRPS degradation'],
  },
  budget_constrained: {
    label: 'Budget-constrained',
    description: 'Agents have finite wealth that can run out, leading to ruin.',
    levers: ['finite budget', 'ruin risk'],
  },
  house_money: {
    label: 'House-money effect',
    description: 'Agents increase risk-taking after gains, decrease after losses.',
    levers: ['gain-dependent staking', 'wealth trajectory coupling'],
  },
  kelly_sizer: {
    label: 'Kelly-like sizing',
    description: 'Deposit proportional to estimated edge: σ × (1 − σ).',
    levers: ['edge-proportional staking', 'Kelly fraction'],
  },
  reputation_gamer: {
    label: 'Reputation gamer',
    description: 'Sacrifices short-term accuracy to inflate skill estimate σ by reporting near the aggregate.',
    levers: ['aggregate anchoring', 'σ inflation'],
  },
  sandbagger: {
    label: 'Sandbagger',
    description: 'Deliberately underperforms by adding large noise, lowering expectations.',
    levers: ['deliberate noise', 'expectation manipulation'],
  },
  reinforcement_learner: {
    label: 'Reinforcement learner',
    description: 'Increases participation after profitable rounds, withdraws after losses.',
    levers: ['profit-driven participation', 'adaptive entry'],
  },
  latency_exploiter: {
    label: 'Latency exploiter',
    description: 'Reports with partial outcome information due to submission latency.',
    levers: ['partial outcome info', 'information advantage'],
  },
};

function clamp(v: number, lo = 0, hi = 1): number {
  return Math.min(hi, Math.max(lo, v));
}

function inverseLossFromSkill(sigma: number, sigmaMin: number, gamma: number): number {
  const num = Math.max(sigma - sigmaMin, 1e-6);
  const den = Math.max(1 - sigmaMin, 1e-6);
  return -Math.log(num / den) / Math.max(gamma, 1e-6);
}

function makeRng(seed: number): () => number {
  let s = (Math.floor(seed) || 1) % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 48271) % 2147483647;
    return s / 2147483647;
  };
}

function normalSample(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = Math.max(rng(), 1e-9);
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function getBaseScenarioAgents(sigmaMin: number, gamma: number): ScenarioAgent[] {
  const base = [
    { id: 'c1', label: 'Alpha', role: 'honest', trueSkill: 0.88 },
    { id: 'c2', label: 'Beta', role: 'honest', trueSkill: 0.76 },
    { id: 'c3', label: 'Gamma', role: 'honest', trueSkill: 0.65 },
    { id: 'c4', label: 'Delta', role: 'honest', trueSkill: 0.58 },
    { id: 'c5', label: 'Epsilon', role: 'honest', trueSkill: 0.49 },
  ];
  return base.map((a) => ({
    ...a,
    wealth: 16,
    ewmaLoss: inverseLossFromSkill(a.trueSkill, sigmaMin, gamma),
  }));
}

function scenarioPopulation(preset: BehaviourPresetId, ctrl: BehaviourControls): ScenarioAgent[] {
  const base = getBaseScenarioAgents(ctrl.sigmaMin, ctrl.gamma);
  if (preset === 'manipulator' || preset === 'evader') {
    return [
      ...base,
      {
        id: preset === 'manipulator' ? 'manip' : 'evader',
        label: preset === 'manipulator' ? 'Manipulator' : 'Evader',
        role: preset,
        trueSkill: 0.62,
        wealth: 18,
        ewmaLoss: inverseLossFromSkill(0.62, ctrl.sigmaMin, ctrl.gamma),
      },
    ];
  }
  if (preset === 'arbitrageur') {
    return [
      ...base,
      {
        id: 'arb',
        label: 'Arbitrageur',
        role: 'arbitrageur',
        trueSkill: 0.55,
        wealth: 16,
        ewmaLoss: inverseLossFromSkill(0.55, ctrl.sigmaMin, ctrl.gamma),
      },
    ];
  }
  if (preset === 'sybil') {
    const [first, ...rest] = base;
    const count = Math.max(ctrl.sybilCount, 1);
    const perWealth = first.wealth / count;
    const clones = Array.from({ length: count }, (_, i) => ({
      id: `sybil_${i + 1}`,
      label: `Sybil ${i + 1}`,
      role: 'sybil',
      trueSkill: first.trueSkill,
      wealth: perWealth,
      ewmaLoss: inverseLossFromSkill(first.trueSkill, ctrl.sigmaMin, ctrl.gamma),
    }));
    return [...clones, ...rest];
  }
  return base;
}

function behaviourDecision(
  agent: ScenarioAgent,
  preset: BehaviourPresetId,
  ctrl: BehaviourControls,
  round: number,
  outcome: number,
  prevAgg: number,
  dispersion: number,
  rng: () => number
): AgentInput {
  let pPart = 0.88;
  let bias = 0;
  let depFrac = 0.22 + 0.12 * agent.trueSkill;
  let noiseScale = 0.04 + (1 - agent.trueSkill) * 0.22;

  if (preset === 'bursty') {
    const burst = 0.5 + 0.5 * Math.sin((round + agent.trueSkill * 10) / 4);
    pPart = clamp(0.22 + burst * (1 - ctrl.participationShock * 0.6), 0.15, 0.95);
  }
  if (preset === 'risk_averse') {
    depFrac *= 0.55;
    noiseScale *= 0.8;
  }
  if (agent.role === 'manipulator') {
    bias = ctrl.manipulation * 0.24 * Math.sign(0.5 - prevAgg || 1);
    depFrac *= 1.4;
  }
  if (agent.role === 'evader') {
    const stealth = dispersion > 0.18 ? 0.5 : 1;
    bias = ctrl.manipulation * 0.2 * stealth * Math.sign(0.5 - prevAgg || 1);
    depFrac *= 1.15 * stealth;
  }
  if (agent.role === 'arbitrageur') {
    pPart = dispersion > 0.12 ? 0.92 : 0.12;
    depFrac = dispersion > 0.12 ? 0.34 : 0.05;
    noiseScale = 0.08;
  }
  if (agent.role === 'sybil') {
    depFrac *= 0.95;
    noiseScale *= 0.9;
  }

  const participate = rng() < pPart;
  const honest = clamp(outcome + normalSample(rng) * noiseScale);
  const anchor = agent.role === 'arbitrageur' ? prevAgg : honest;
  const report = clamp(anchor + bias + normalSample(rng) * noiseScale * 0.4);
  const deposit = participate ? Math.min(agent.wealth, agent.wealth * depFrac) : 0;

  return {
    id: agent.id,
    label: agent.label,
    report,
    deposit,
    ewmaLoss: agent.ewmaLoss,
    wealth: agent.wealth,
    participate,
  };
}

export function simulateScenario(preset: BehaviourPresetId, ctrl: BehaviourControls): ScenarioResult {
  const rng = makeRng(1000 + ctrl.seed * 17 + ctrl.rounds);
  let agents = scenarioPopulation(preset, ctrl);
  let prevAgg = 0.5;
  const rounds: BehaviourRound[] = [];

  const params: ExtendedParams = {
    lam: ctrl.lam,
    eta: ctrl.eta,
    sigma_min: ctrl.sigmaMin,
    gamma: ctrl.gamma,
    rho: ctrl.rho,
    omegaMax: ctrl.omegaMax,
    utilityPool: 0,
    scoreThreshold: 0.7,
  };

  for (let t = 1; t <= ctrl.rounds; t++) {
    const outcome = clamp(
      0.5 +
        0.22 * Math.sin((t + ctrl.seed) / 6) +
        0.14 * Math.cos((t + ctrl.seed) / 11) +
        normalSample(rng) * 0.08
    );

    const preview = agents.map((a) =>
      clamp(outcome + normalSample(rng) * (0.03 + (1 - a.trueSkill) * 0.2))
    );
    const centre = mean(preview);
    const dispersion = Math.sqrt(mean(preview.map((v) => (v - centre) ** 2)));

    const roundAgents = agents.map((a) =>
      behaviourDecision(a, preset, ctrl, t, outcome, prevAgg, dispersion, rng)
    );

    const state: AgentState[] = agents.map((a) => ({
      accountId: 0,
      L: a.ewmaLoss,
      sigma: 0.5,
      wealth: a.wealth,
    }));

    const actions: AgentAction[] = roundAgents.map((a, i) => ({
      accountId: i,
      participate: a.participate,
      report: a.report,
      deposit: a.deposit,
    }));

    const result = runRoundExtended(state, actions, outcome, params);
    prevAgg = result.r_hat;

    const hhi = result.weight.reduce((s, w) => s + w * w, 0);
    const nEff = hhi > 0 ? 1 / hhi : 0;

    rounds.push({
      round: t,
      outcome,
      aggregate: result.r_hat,
      error: Math.abs(outcome - result.r_hat),
      participation: roundAgents.filter((a) => a.participate).length,
      nEff,
      gini: gini(result.wealth_new),
      meanSigma: mean(result.sigma_t),
    });

    agents = agents.map((a, i) => ({
      ...a,
      wealth: result.wealth_new[i],
      ewmaLoss: result.L_new[i],
    }));
  }

  const meta = PRESET_META[preset];
  return {
    rounds,
    finalAgents: agents.map((a) => ({ ...a, finalWealth: a.wealth })),
    summary: {
      preset,
      label: meta.label,
      description: meta.description,
      meanError: mean(rounds.map((r) => r.error)),
      meanParticipation: mean(rounds.map((r) => r.participation)),
      meanNEff: mean(rounds.map((r) => r.nEff)),
      finalGini: rounds.length > 0 ? rounds[rounds.length - 1].gini : 0,
      finalAggregate: rounds.length > 0 ? rounds[rounds.length - 1].aggregate : 0,
    },
  };
}
