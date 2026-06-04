/**
 * Attack simulation hook for the stress view.
 *
 * Runs the SAME synthetic panel twice through the canonical simulator
 * (runPipeline): once on the baseline preset (no attack) and once on the
 * attack's behaviour preset. Both runs share the dgp regime, seed, panel size
 * and round count, so the only thing that differs between them is the attack.
 * A single clock scrubs both runs in lockstep (a small-multiple comparison,
 * representation_notes §6).
 *
 * This hook computes nothing about the mechanism itself. It re-runs the real
 * pipeline and reads per-round signals straight off the RoundTrace array.
 *
 * Grounding: this is the SYNTHETIC sandbox regime, never the real-data
 * headline (draft_match_contract.md §5 do-not-claim #8). The draft's committed
 * per-1,000-round figures are quoted separately as draft-reported values.
 */
import { useMemo, useState, useCallback, useEffect } from 'react';
import { runPipeline, type PipelineResult } from '@/lib/coreMechanism/runPipeline';
import type { DGPId } from '@/lib/coreMechanism/dgpSimulator';
import { findAttack, type AttackDef } from '@/lib/platform/attackCatalogue';

export interface AttackConfig {
  attackId: string;
  dgpId: DGPId;
  n: number;
  rounds: number;
  seed: number;
  /** Skill gate floor λ. */
  lam: number;
}

export const DEFAULT_ATTACK_CONFIG: AttackConfig = {
  attackId: 'arbitrage_seeker',
  dgpId: 'latent_fixed',
  n: 6,
  rounds: 80,
  seed: 42,
  lam: 0.3,
};

/** Clock cadence (ms/round): slow enough to read each round. Mirrors the market view. */
export const ATTACK_INTERVAL_MS = 2400;
export const ATTACK_SPEED_OPTIONS: { label: string; ms: number }[] = [
  { label: 'Slow', ms: 3200 },
  { label: 'Steady', ms: 2400 },
  { label: 'Brisk', ms: 1500 },
];

/** A per-round derived series, computed from the two runs' traces. */
export interface AttackSeries {
  /** Cumulative attacker profit per round, with the attack engaged. */
  attackerProfit: number[];
  /** Cumulative attacker profit per round, on the no-attack baseline (same seats). */
  baselineProfit: number[];
  /** Attacker (combined) weight share per round, with the attack. */
  attackerWeight: number[];
  /** Same seats' combined weight share on the no-attack baseline. */
  baselineWeight: number[];
  /** Combined effective wager of the attacker seats per round, with the attack. */
  combinedWager: number[];
  /** Combined deposit of the attacker seats per round, with the attack. */
  combinedDeposit: number[];
}

export interface UseAttackSimulationReturn {
  attack: AttackDef;
  withAttack: PipelineResult;
  withoutAttack: PipelineResult;
  series: AttackSeries;
  attackerSeats: number[];
  config: AttackConfig;
  setConfig: (patch: Partial<AttackConfig>) => void;
  round: number;
  setRound: (r: number) => void;
  isPlaying: boolean;
  toggle: () => void;
  step: (delta: number) => void;
  restart: () => void;
  totalRounds: number;
  speedMs: number;
  setSpeed: (ms: number) => void;
}

function cumulativeAttackerProfit(result: PipelineResult, seats: number[]): number[] {
  let acc = 0;
  return result.traces.map((trace) => {
    for (const seat of seats) acc += trace.profit[seat] ?? 0;
    return acc;
  });
}

function combinedWeight(result: PipelineResult, seats: number[]): number[] {
  return result.traces.map((trace) =>
    seats.reduce((sum, seat) => sum + (trace.weights[seat] ?? 0), 0),
  );
}

function combinedField(result: PipelineResult, seats: number[], field: 'effectiveWager' | 'deposits'): number[] {
  return result.traces.map((trace) =>
    seats.reduce((sum, seat) => sum + (trace[field][seat] ?? 0), 0),
  );
}

export function useAttackSimulation(
  initial: Partial<AttackConfig> = {},
): UseAttackSimulationReturn {
  const [config, setConfigState] = useState<AttackConfig>({ ...DEFAULT_ATTACK_CONFIG, ...initial });
  const [roundState, setRoundState] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeed] = useState(ATTACK_INTERVAL_MS);

  const attack = findAttack(config.attackId);
  const attackerSeats = useMemo(
    () => attack.attackerSeats(config.n).filter((s) => s >= 0 && s < config.n),
    [attack, config.n],
  );

  // Two real-simulator runs on the same panel: baseline vs attack preset.
  const withoutAttack = useMemo(
    () =>
      runPipeline({
        dgpId: config.dgpId,
        behaviourPreset: 'baseline',
        weighting: 'full',
        rounds: config.rounds,
        seed: config.seed,
        n: config.n,
        mechanism: { lam: config.lam, eta: 1, sigma_min: 0.1 },
      }),
    [config.dgpId, config.rounds, config.seed, config.n, config.lam],
  );

  const withAttack = useMemo(
    () =>
      runPipeline({
        dgpId: config.dgpId,
        behaviourPreset: attack.preset,
        weighting: 'full',
        rounds: config.rounds,
        seed: config.seed,
        n: config.n,
        mechanism: { lam: config.lam, eta: 1, sigma_min: 0.1 },
      }),
    [attack.preset, config.dgpId, config.rounds, config.seed, config.n, config.lam],
  );

  const series = useMemo<AttackSeries>(
    () => ({
      attackerProfit: cumulativeAttackerProfit(withAttack, attackerSeats),
      baselineProfit: cumulativeAttackerProfit(withoutAttack, attackerSeats),
      attackerWeight: combinedWeight(withAttack, attackerSeats),
      baselineWeight: combinedWeight(withoutAttack, attackerSeats),
      combinedWager: combinedField(withAttack, attackerSeats, 'effectiveWager'),
      combinedDeposit: combinedField(withAttack, attackerSeats, 'deposits'),
    }),
    [withAttack, withoutAttack, attackerSeats],
  );

  const totalRounds = withAttack.traces.length;
  const round = totalRounds > 0 ? Math.min(roundState, totalRounds - 1) : 0;

  const clampRound = (r: number, total: number) => {
    if (total <= 0) return 0;
    return ((r % total) + total) % total;
  };

  useEffect(() => {
    if (!isPlaying || totalRounds <= 0) return undefined;
    const id = window.setInterval(() => {
      setRoundState((prev) => {
        const next = prev + 1;
        if (next >= totalRounds - 1) {
          setIsPlaying(false);
          return totalRounds - 1;
        }
        return next;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [isPlaying, speedMs, totalRounds]);

  const setConfig = useCallback((patch: Partial<AttackConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
    // Any config change rewinds the clock so the comparison reads from round 1.
    setRoundState(0);
    setIsPlaying(false);
  }, []);

  const setRound = useCallback((r: number) => setRoundState(clampRound(r, totalRounds)), [totalRounds]);
  const step = useCallback((delta: number) => setRoundState((prev) => clampRound(prev + delta, totalRounds)), [totalRounds]);
  const toggle = useCallback(() => setIsPlaying((p) => !p), []);
  const restart = useCallback(() => {
    setRoundState(0);
    setIsPlaying(false);
  }, []);

  return {
    attack,
    withAttack,
    withoutAttack,
    series,
    attackerSeats,
    config,
    setConfig,
    round,
    setRound,
    isPlaying,
    toggle,
    step,
    restart,
    totalRounds,
    speedMs,
    setSpeed,
  };
}
