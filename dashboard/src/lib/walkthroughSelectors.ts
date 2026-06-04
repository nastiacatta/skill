/**
 * Derived selectors for walkthrough: build round-level inputs, DGP meta, results, next state
 * from experiment meta and loaded data, or from mechanism trace when available.
 * When trace is provided, round objects are real (reports → influence → r_hat).
 * When only roundRecords exist (no trace): values are PROXY — wager/wealth/sigma are
 * approximated from roundRecords; aggregate forecast is undefined. UI should label or hide these.
 */
import type { ExperimentMeta, SkillWagerPoint, WalkthroughInputs, WalkthroughDGPMeta, WalkthroughRoundResult, WalkthroughNextState } from './types';
import { DGP_OPTIONS } from './coreMechanism/dgpSimulator';
import type { RoundTrace } from './coreMechanism/runRoundComposable';

export function getDGPMetaFromExperiment(exp: ExperimentMeta | null): WalkthroughDGPMeta {
  if (!exp?.dgp) return {};
  const dgpOption = DGP_OPTIONS.find((d) => d.id === exp.dgp);
  if (!dgpOption) return { dgpId: exp.dgp, label: exp.dgp, description: exp.dgp };
  return {
    dgpId: dgpOption.id,
    label: dgpOption.label,
    truthSource: dgpOption.truthSource,
    description: dgpOption.description,
    formula: dgpOption.formula,
  };
}

export function getInputsFromExperiment(
  exp: ExperimentMeta | null,
  roundIndex: number,
  roundRecords?: SkillWagerPoint[] | null,
  trace?: RoundTrace | null
): WalkthroughInputs {
  if (trace) {
    const n = trace.reports.length;
    const forecasts: Record<number, number> = {};
    const wagers: Record<number, number> = {};
    const previousSkill: Record<number, number> = {};
    const previousWealth: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      if (trace.participated[i] && trace.reports[i] !== 0) forecasts[i] = trace.reports[i];
      wagers[i] = trace.deposits[i];
      previousSkill[i] = trace.sigma_t[i];
      previousWealth[i] = trace.wealth_before[i];
    }
    const activeAgentIds = trace.participated.map((_, i) => i).filter((_, i) => trace.participated[i]);
    return {
      taskType: 'point',
      scoringRule: exp?.scoringMode ?? 'CRPS',
      activeAgentIds,
      forecasts: Object.keys(forecasts).length ? forecasts : undefined,
      wagers: Object.keys(wagers).length ? wagers : undefined,
      previousSkill: Object.keys(previousSkill).length ? previousSkill : undefined,
      previousWealth: Object.keys(previousWealth).length ? previousWealth : undefined,
      roundIndex,
      nRounds: exp?.rounds,
    };
  }

  // PROXY: no trace — wager/skill/wealth from roundRecords are approximate placeholders
  const roundRecordsAtT = roundRecords?.filter((r) => r.t === roundIndex) ?? [];
  const wagers: Record<number, number> = {};
  const previousSkill: Record<number, number> = {};
  const previousWealth: Record<number, number> = {};
  roundRecordsAtT.forEach((r) => {
    wagers[r.agent] = r.wager;       // proxy: using wager as placeholder
    previousSkill[r.agent] = r.sigma;
    previousWealth[r.agent] = r.cumProfit; // proxy: cumProfit as wealth placeholder
  });
  const activeAgentIds = [...new Set(roundRecordsAtT.filter((r) => !r.missing).map((r) => r.agent))];
  return {
    taskType: 'point',
    scoringRule: exp?.scoringMode ?? 'CRPS',
    activeAgentIds,
    forecasts: undefined,
    wagers: Object.keys(wagers).length ? wagers : undefined,
    previousSkill: Object.keys(previousSkill).length ? previousSkill : undefined,
    previousWealth: Object.keys(previousWealth).length ? previousWealth : undefined,
    roundIndex,
    nRounds: exp?.rounds,
    isProxy: true as const,
  };
}

export function getResultFromRoundRecords(
  roundIndex: number,
  roundRecords?: SkillWagerPoint[] | null,
  outcome?: number,
  trace?: RoundTrace | null
): WalkthroughRoundResult {
  if (trace) {
    const n = trace.reports.length;
    const payoffs: Record<number, number> = {};
    const wealthChanges: Record<number, number> = {};
    const skillWeightChanges: Record<number, number> = {};
    const contributionShares: Record<number, number> = {};
    for (let i = 0; i < n; i++) {
      payoffs[i] = trace.profit[i];
      wealthChanges[i] = trace.profit[i];
      skillWeightChanges[i] = trace.sigma_new[i];
      contributionShares[i] = trace.weights[i];
    }
    const totalDistributed = trace.totalPayoff.reduce((s, v) => s + Math.max(0, v), 0);
    const totalRefunds = trace.refunds.reduce((s, v) => s + v, 0);
    const withPayoff = trace.totalPayoff.map((v, i) => ({ agentId: i, payoff: v }));
    withPayoff.sort((a, b) => b.payoff - a.payoff);
    const topWinners = withPayoff.filter((x) => x.payoff > 0).slice(0, 5);
    return {
      aggregateForecast: trace.r_hat,
      realisedOutcome: trace.y,
      payoffs: Object.keys(payoffs).length ? payoffs : undefined,
      wealthChanges: Object.keys(wealthChanges).length ? wealthChanges : undefined,
      skillWeightChanges: Object.keys(skillWeightChanges).length ? skillWeightChanges : undefined,
      contributionShares: Object.keys(contributionShares).length ? contributionShares : undefined,
      totalDistributed,
      totalRefunds,
      concentrationHHI: trace.hhi,
      topShare: trace.topShare,
      topWinners: topWinners.length ? topWinners : undefined,
      nEff: trace.nEff,
    };
  }

  // PROXY: no trace — aggregate undefined; payoffs/wealth from roundRecords
  const atT = roundRecords?.filter((r) => r.t === roundIndex) ?? [];
  const payoffs: Record<number, number> = {};
  const wealthChanges: Record<number, number> = {};
  const skillWeightChanges: Record<number, number> = {};
  atT.forEach((r) => {
    payoffs[r.agent] = r.profit;
    wealthChanges[r.agent] = r.profit;
    skillWeightChanges[r.agent] = r.sigma;
  });
  return {
    aggregateForecast: undefined,
    realisedOutcome: outcome,
    payoffs: Object.keys(payoffs).length ? payoffs : undefined,
    wealthChanges: Object.keys(wealthChanges).length ? wealthChanges : undefined,
    skillWeightChanges: Object.keys(skillWeightChanges).length ? skillWeightChanges : undefined,
    isProxy: true as const,
  };
}

export function getNextStateFromRoundRecords(
  roundIndex: number,
  roundRecords?: SkillWagerPoint[] | null,
  trace?: RoundTrace | null
): WalkthroughNextState {
  if (trace) {
    const n = trace.wealth_after.length;
    const wealth: Record<number, number> = {};
    const skill: Record<number, number> = {};
    const eligibility: Record<number, boolean> = {};
    for (let i = 0; i < n; i++) {
      wealth[i] = trace.wealth_after[i];
      skill[i] = trace.sigma_new[i];
      eligibility[i] = trace.participated[i];
    }
    return {
      wealth: Object.keys(wealth).length ? wealth : undefined,
      skill: Object.keys(skill).length ? skill : undefined,
      eligibility: Object.keys(eligibility).length ? eligibility : undefined,
    };
  }

  const atT = roundRecords?.filter((r) => r.t === roundIndex) ?? [];
  const wealth: Record<number, number> = {};
  const skill: Record<number, number> = {};
  const eligibility: Record<number, boolean> = {};
  atT.forEach((r) => {
    wealth[r.agent] = r.cumProfit;
    skill[r.agent] = r.sigma;
    eligibility[r.agent] = !r.missing;
  });
  return {
    wealth: Object.keys(wealth).length ? wealth : undefined,
    skill: Object.keys(skill).length ? skill : undefined,
    eligibility: Object.keys(eligibility).length ? eligibility : undefined,
  };
}
