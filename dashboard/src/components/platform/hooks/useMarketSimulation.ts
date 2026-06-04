/**
 * Living-market simulation hook.
 *
 * Runs `runPipeline` over a configurable synthetic panel and exposes a
 * scrub/step/play clock over the resulting per-round traces. Every value the
 * market view shows is read from `RoundTrace`; this hook computes nothing about
 * the mechanism itself, it only re-runs the canonical simulator when the
 * visitor changes a setting and threads a clock over the trace array.
 *
 * Grounding: this is the SYNTHETIC sandbox regime (γ, ρ, λ, η = 4, 0.1, 0.3, 1
 * by default, the simulator's own defaults). It is never the real-data headline
 * (draft_match_contract.md §5 do-not-claim #8).
 */
import { useMemo, useState, useCallback, useEffect } from 'react';
import { runPipeline, type PipelineResult } from '@/lib/coreMechanism/runPipeline';
import type { DGPId } from '@/lib/coreMechanism/dgpSimulator';
import type { BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';
import type { InfluenceRule } from '@/lib/coreMechanism/runRoundComposable';

export type MarketEvent = 'none' | 'sybil' | 'reputation_reset' | 'manipulator';

export interface MarketConfig {
  n: number;
  rounds: number;
  seed: number;
  dgpId: DGPId;
  /** Skill gate floor λ. */
  lam: number;
  /** Skill-gate exponent η. */
  eta: number;
  /** Skill floor σ_min. */
  sigmaMin: number;
  /** Influence rule (full mechanism vs uniform vs skill-only). */
  influenceRule: InfluenceRule;
  /** Injected market event → behaviour preset. */
  event: MarketEvent;
}

export const DEFAULT_MARKET_CONFIG: MarketConfig = {
  n: 6,
  rounds: 60,
  seed: 42,
  dgpId: 'latent_fixed',
  lam: 0.3,
  eta: 1,
  sigmaMin: 0.1,
  influenceRule: 'skill_stake',
  event: 'none',
};

function eventToPreset(event: MarketEvent): BehaviourPresetId {
  switch (event) {
    case 'sybil':
      return 'sybil';
    case 'reputation_reset':
      return 'reputation_reset';
    case 'manipulator':
      return 'manipulator';
    default:
      return 'baseline';
  }
}

function influenceToWeighting(rule: InfluenceRule) {
  switch (rule) {
    case 'uniform':
      return 'uniform' as const;
    case 'deposit_only':
      return 'deposit' as const;
    case 'skill_only':
      return 'skill' as const;
    default:
      return 'full' as const;
  }
}

/**
 * Default clock cadence (ms per round). Slow enough that a first-time viewer
 * can read each round before the next one lands. The speed control steps
 * around this default (see SPEED_OPTIONS).
 */
export const DEFAULT_INTERVAL_MS = 2400;

/** Selectable cadences, slowest first. Labels are plain-English, not numbers. */
export const SPEED_OPTIONS: { label: string; ms: number }[] = [
  { label: 'Slow', ms: 3200 },
  { label: 'Steady', ms: 2400 },
  { label: 'Brisk', ms: 1500 },
];

export interface UseMarketSimulationReturn {
  result: PipelineResult;
  config: MarketConfig;
  setConfig: (patch: Partial<MarketConfig>) => void;
  round: number;
  setRound: (r: number) => void;
  isPlaying: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  step: (delta: number) => void;
  restart: () => void;
  totalRounds: number;
  /** Current clock cadence in ms per round. */
  speedMs: number;
  setSpeed: (ms: number) => void;
}

export function useMarketSimulation(
  initial: Partial<MarketConfig> = {},
  intervalMs = DEFAULT_INTERVAL_MS,
): UseMarketSimulationReturn {
  const [config, setConfigState] = useState<MarketConfig>({ ...DEFAULT_MARKET_CONFIG, ...initial });
  const [roundState, setRoundState] = useState(0);
  // Start paused on round 1: no auto-play on load (the viewer presses play).
  const [isPlaying, setIsPlaying] = useState(false);
  const [speedMs, setSpeed] = useState(intervalMs);

  const result = useMemo(
    () =>
      runPipeline({
        dgpId: config.dgpId,
        behaviourPreset: eventToPreset(config.event),
        weighting: influenceToWeighting(config.influenceRule),
        rounds: config.rounds,
        seed: config.seed,
        n: config.n,
        mechanism: { lam: config.lam, eta: config.eta, sigma_min: config.sigmaMin },
      }),
    [config],
  );

  const totalRounds = result.traces.length;

  // Derive a clamped round at read-time, so a shrinking trace array never needs
  // a corrective setState (no clamp effect, no cascading render).
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
          setIsPlaying(false); // auto-pause at the final round
          return totalRounds - 1;
        }
        return next;
      });
    }, speedMs);
    return () => window.clearInterval(id);
  }, [isPlaying, speedMs, totalRounds]);

  const setConfig = useCallback((patch: Partial<MarketConfig>) => {
    setConfigState((prev) => ({ ...prev, ...patch }));
  }, []);

  const setRound = useCallback((r: number) => setRoundState(clampRound(r, totalRounds)), [totalRounds]);
  const step = useCallback((delta: number) => setRoundState((prev) => clampRound(prev + delta, totalRounds)), [totalRounds]);
  const play = useCallback(() => {
    setRoundState((prev) => (prev >= totalRounds - 1 ? 0 : prev));
    setIsPlaying(true);
  }, [totalRounds]);
  const pause = useCallback(() => setIsPlaying(false), []);
  const toggle = useCallback(() => setIsPlaying((p) => !p), []);
  const restart = useCallback(() => {
    setRoundState(0);
    setIsPlaying(false);
  }, []);

  return {
    result,
    config,
    setConfig,
    round,
    setRound,
    isPlaying,
    play,
    pause,
    toggle,
    step,
    restart,
    totalRounds,
    speedMs,
    setSpeed,
  };
}
