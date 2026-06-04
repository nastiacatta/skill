/**
 * "Be a forecaster" game hook.
 *
 * The visitor occupies slot 0 of an n-member panel. Each round:
 *   1. a DGP series supplies the other forecasters' quantile reports and the
 *      realised outcome y;
 *   2. the visitor authors their own monotone quantile fan and a deposit
 *      fraction of their current wealth;
 *   3. `runComposableRound` is called with the visitor's decision injected at
 *      slot 0 and the DGP rows for slots 1..n-1;
 *   4. persistent state (L, σ, wealth) is threaded forward exactly as
 *      `runPipeline` does.
 *
 * No mechanism maths is reimplemented: the visitor's fan is scored, gated,
 * aggregated and settled by the canonical `runComposableRound`. The only thing
 * this hook adds is the UI-side state machine and the per-round outcome reveal.
 *
 * Grounding: synthetic sandbox regime; never the real-data headline.
 */
import { useCallback, useMemo, useState } from 'react';
import { generateDGP, TAUS, type DGPId } from '@/lib/coreMechanism/dgpSimulator';
import { normPpf } from '@/lib/coreMechanism/seededRng';
import {
  runComposableRound,
  DEFAULT_BUILDER_SELECTIONS,
  type AgentDecision,
  type ComposableParams,
  type RoundTrace,
} from '@/lib/coreMechanism/runRoundComposable';
import type { AgentState } from '@/lib/coreMechanism/runRound';
import { INITIAL_WEALTH } from '@/lib/coreMechanism/runPipeline';
import { honestFan } from '@/components/platform/viz/fanMaths';

export interface ForecasterGameConfig {
  n: number;
  seed: number;
  dgpId: DGPId;
  lam: number;
  eta: number;
  sigmaMin: number;
  gamma: number;
  rho: number;
}

export const DEFAULT_GAME_CONFIG: ForecasterGameConfig = {
  n: 6,
  seed: 7,
  dgpId: 'latent_fixed',
  lam: 0.3,
  eta: 1,
  sigmaMin: 0.1,
  gamma: 4,
  rho: 0.1,
};

const VISITOR = 0;

export interface SettledRound {
  trace: RoundTrace;
  /** The visitor's own submitted fan and deposit fraction. */
  submittedFan: number[];
  riskFraction: number;
}

export interface UseForecasterGameReturn {
  config: ForecasterGameConfig;
  /** Persistent state of the panel after settled rounds. */
  state: AgentState[];
  /** All settled rounds so far (oldest first). */
  history: SettledRound[];
  /** Round number about to be played (1-based). */
  currentRound: number;
  /** The visitor's wealth available to deposit this round. */
  visitorWealth: number;
  /** The visitor's current skill σ_t (carried into this round's gate). */
  visitorSkill: number;
  /** The DGP's honest fan for the visitor this round (the "be honest" target). */
  honestTarget: number[];
  /** Settle one round with the visitor's submitted fan + deposit fraction. */
  settle: (fan: number[], riskFraction: number) => SettledRound;
  /** Reset the whole game. */
  reset: () => void;
}

export function useForecasterGame(initial: Partial<ForecasterGameConfig> = {}): UseForecasterGameReturn {
  // Destructure to primitive deps so the config memo is stable across renders
  // even when a caller passes a fresh `initial` object literal each time.
  const {
    n = DEFAULT_GAME_CONFIG.n,
    seed = DEFAULT_GAME_CONFIG.seed,
    dgpId = DEFAULT_GAME_CONFIG.dgpId,
    lam = DEFAULT_GAME_CONFIG.lam,
    eta = DEFAULT_GAME_CONFIG.eta,
    sigmaMin = DEFAULT_GAME_CONFIG.sigmaMin,
    gamma = DEFAULT_GAME_CONFIG.gamma,
    rho = DEFAULT_GAME_CONFIG.rho,
  } = initial;
  const config = useMemo<ForecasterGameConfig>(
    () => ({ n, seed, dgpId, lam, eta, sigmaMin, gamma, rho }),
    [n, seed, dgpId, lam, eta, sigmaMin, gamma, rho],
  );

  const params = useMemo<ComposableParams>(() => ({
    lam: config.lam,
    eta: config.eta,
    sigma_min: config.sigmaMin,
    gamma: config.gamma,
    rho: config.rho,
    omegaMax: 0.25,
    utilityPool: 0,
    scoreThreshold: 0.7,
    fixedDeposit: 1,
    baseDepositFraction: 0.18,
    sigmaDepositScale: 0.85,
    builder: { ...DEFAULT_BUILDER_SELECTIONS, depositPolicy: 'wealth_fraction' },
  }), [config]);

  // Pre-generate a long DGP series so the panel and outcomes are reproducible.
  const dgp = useMemo(() => generateDGP(config.dgpId, config.seed, 400, config.n), [config.dgpId, config.seed, config.n]);

  const initialState = useCallback((): AgentState[] => {
    const initialL = 0.5;
    const sigma0 = config.sigmaMin + (1 - config.sigmaMin) * Math.exp(-config.gamma * initialL);
    return Array.from({ length: config.n }, (_, i) => ({ accountId: i, L: initialL, sigma: sigma0, wealth: INITIAL_WEALTH }));
  }, [config]);

  const [state, setState] = useState<AgentState[]>(initialState);
  const [history, setHistory] = useState<SettledRound[]>([]);

  const roundIndex = history.length; // index into the DGP series
  const dgpRound = dgp.rounds[roundIndex % dgp.rounds.length];

  // The DGP's honest fan for the visitor: the posterior-mean quantiles the DGP
  // assigned to slot 0 this round. Snapping to it teaches "truthful = optimal".
  const honestTarget = useMemo(() => {
    const q = dgpRound?.qReports[VISITOR];
    if (q && q.length === TAUS.length) return q.slice();
    return honestFan(normPpf(0.5), 0.4);
  }, [dgpRound]);

  const settle = useCallback((fan: number[], riskFraction: number): SettledRound => {
    const idx = history.length;
    const round = dgp.rounds[idx % dgp.rounds.length];
    const decisions: AgentDecision[] = state.map((_, i) => {
      if (i === VISITOR) {
        return {
          accountId: i,
          participate: true,
          report: fan[Math.floor(fan.length / 2)],
          qReport: fan,
          riskFraction,
        };
      }
      return {
        accountId: i,
        participate: true,
        report: round.reports[i],
        qReport: round.qReports[i],
        riskFraction: 0.18,
      };
    });

    const trace = runComposableRound(idx + 1, state, decisions, round.y, params);

    const nextState: AgentState[] = state.map((agent, i) => ({
      accountId: agent.accountId,
      L: trace.L_new[i],
      sigma: trace.sigma_new[i],
      wealth: trace.wealth_after[i],
    }));

    const settled: SettledRound = { trace, submittedFan: fan.slice(), riskFraction };
    setState(nextState);
    setHistory((h) => [...h, settled]);
    return settled;
  }, [dgp.rounds, history.length, params, state]);

  const reset = useCallback(() => {
    setState(initialState());
    setHistory([]);
  }, [initialState]);

  const visitorSkillNow = state[VISITOR]
    ? config.sigmaMin + (1 - config.sigmaMin) * Math.exp(-config.gamma * state[VISITOR].L)
    : config.sigmaMin;

  return {
    config,
    state,
    history,
    currentRound: history.length + 1,
    visitorWealth: state[VISITOR]?.wealth ?? 0,
    visitorSkill: visitorSkillNow,
    honestTarget,
    settle,
    reset,
  };
}

export const VISITOR_INDEX = VISITOR;
