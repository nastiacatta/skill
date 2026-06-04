/**
 * Story-page pipeline hook.
 *
 * Calls runPipeline() with a fixed seed and the three Story switches
 * (sigmaMin, depositPolicy, sybilSplit) and returns 30 rounds × 8 frames
 * of StoryFrameData. Memoised on the four-tuple
 * [seed, sigmaMin, depositPolicy, sybilSplit] so a switch change rebuilds
 * the array atomically and the cached result survives unrelated re-renders.
 *
 * The sybil-split branch builds the seven-card panel by cloning F2's
 * trace row onto an F2b row with halved deposits, halved effective wager
 * and an identical quantile fan. This mirrors the sybil-invariance setup
 * in Lambert (2008, Proposition 3): identical reports, conserved total
 * wager. The pipeline itself runs at n=6 with the baseline behaviour
 * preset; the seventh row is post-processed client-side so the demo
 * does not depend on the noisy 'sybil' preset in the behaviour layer.
 */

import { useMemo } from 'react';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import type {
  DepositPolicy,
  RoundTrace,
} from '@/lib/coreMechanism/runRoundComposable';

export const STORY_SEED = 42;
export const STORY_ROUNDS = 30;
export const STORY_FORECASTER_COUNT = 6;
export const STORY_SYBIL_FORECASTER_COUNT = 7;
export const STORY_FRAMES_PER_ROUND = 8;

export type StoryFrameIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface StoryFrameData {
  frame: StoryFrameIndex;
  round: number;
  caption: string;
  depositPre: number[];
  depositPost: number[];
  effectiveWager: number[];
  fan: number[][];
  reportMedian: number[];
  aggregate: { rHat: number; rHatQ: number[] };
  y: number;
  score: number[];
  payout: number[];
  skillBefore: number[];
  skillAfter: number[];
  wealth: number[];
  participated: boolean[];
  weights: number[];
}

export const STORY_STEPS = 7;

export const STORY_STEP_LABELS: readonly string[] = [
  "Submit",
  "Deposit",
  "Gate",
  "Aggregate",
  "Outcome",
  "Score",
  "Settle",
] as const;

export const STORY_FRAME_CAPTIONS: readonly string[] = [
  "A grid operator posts a forecasting task: what is tomorrow's wind power?",
  "Each forecaster submits a quantile forecast and a deposit, staking wealth on their answer.",
  "The skill gate rescales each deposit into an effective wager; weaker forecasters risk less.",
  "Reports are combined by wager-weighted averaging into a single aggregate distribution.",
  "The outcome is observed. The dashed line marks the realised value.",
  "Each report is scored against the outcome by the pinball CRPS, a strictly proper rule.",
  "The pool redistributes by relative score; the EWMA skill estimate updates for the next round.",
] as const;

export const STEP_TO_FRAME: readonly StoryFrameIndex[] = [
  0, 1, 2, 3, 4, 5, 7,
] as const;

export type FocusZone = "left" | "centre" | "right" | "left-right";

export const STEP_FOCUS_ZONES: readonly FocusZone[] = [
  "centre",
  "left-right",
  "right",
  "centre",
  "centre",
  "right",
  "left-right",
] as const;

export interface UseStoryPipelineArgs {
  sigmaMin: number;
  depositPolicy: DepositPolicy;
  sybilSplit: boolean;
  seed?: number;
  rounds?: number;
}

export interface UseStoryPipelineReturn {
  frames: StoryFrameData[];
  forecasterCount: number;
  totalRounds: number;
}

const SYBIL_TWIN_INDEX = 1;

function splitTraceForSybil(trace: RoundTrace): RoundTrace {
  const inject = <T>(source: T[], value: T): T[] => {
    const next = source.slice();
    next.splice(SYBIL_TWIN_INDEX + 1, 0, value);
    return next;
  };
  const halveAt = (source: number[]): number[] => {
    const halved = source.slice();
    halved[SYBIL_TWIN_INDEX] = halved[SYBIL_TWIN_INDEX] / 2;
    return inject(halved, halved[SYBIL_TWIN_INDEX]);
  };
  const cloneAt = (source: number[]): number[] =>
    inject(source, source[SYBIL_TWIN_INDEX]);
  const cloneFlagAt = (source: boolean[]): boolean[] =>
    inject(source, source[SYBIL_TWIN_INDEX]);
  const cloneQAt = (source: number[][]): number[][] =>
    inject(source, source[SYBIL_TWIN_INDEX].slice());

  return {
    ...trace,
    L_prev: cloneAt(trace.L_prev),
    sigma_t: cloneAt(trace.sigma_t),
    wealth_before: halveAt(trace.wealth_before),

    participated: cloneFlagAt(trace.participated),
    reports: cloneAt(trace.reports),
    qReports: cloneQAt(trace.qReports),
    deposits: halveAt(trace.deposits),
    effectiveWager: halveAt(trace.effectiveWager),

    aggregationMass: halveAt(trace.aggregationMass),
    cappedAggregationMass: halveAt(trace.cappedAggregationMass),
    weights: halveAt(trace.weights),

    losses: cloneAt(trace.losses),
    scores: cloneAt(trace.scores),

    skillPayoff: halveAt(trace.skillPayoff),
    utilityPayoff: halveAt(trace.utilityPayoff),
    totalPayoff: halveAt(trace.totalPayoff),
    profit: halveAt(trace.profit),
    refunds: halveAt(trace.refunds),

    wealth_after: halveAt(trace.wealth_after),
    L_new: cloneAt(trace.L_new),
    sigma_new: cloneAt(trace.sigma_new),

    activeCount: trace.participated.filter(Boolean).length
      + (trace.participated[SYBIL_TWIN_INDEX] ? 1 : 0),
  };
}

function frameFromTrace(
  trace: RoundTrace,
  frame: StoryFrameIndex,
): StoryFrameData {
  const depositPre = trace.deposits.slice();
  const depositPost = trace.deposits.map(
    (deposit, i) => deposit - trace.refunds[i],
  );
  const fan = trace.qReports.map(q => q.slice());

  return {
    frame,
    round: trace.round,
    caption: STORY_FRAME_CAPTIONS[frame],
    depositPre,
    depositPost,
    effectiveWager: trace.effectiveWager.slice(),
    fan,
    reportMedian: trace.reports.slice(),
    aggregate: { rHat: trace.r_hat, rHatQ: trace.r_hat_q.slice() },
    y: trace.y,
    score: trace.scores.slice(),
    payout: trace.totalPayoff.slice(),
    skillBefore: trace.sigma_t.slice(),
    skillAfter: trace.sigma_new.slice(),
    wealth: trace.wealth_after.slice(),
    participated: trace.participated.slice(),
    weights: trace.weights.slice(),
  };
}

export function useStoryPipeline({
  sigmaMin,
  depositPolicy,
  sybilSplit,
  seed = STORY_SEED,
  rounds = STORY_ROUNDS,
}: UseStoryPipelineArgs): UseStoryPipelineReturn {
  return useMemo(() => {
    const result = runPipeline({
      dgpId: 'baseline',
      behaviourPreset: 'baseline',
      rounds,
      seed,
      n: STORY_FORECASTER_COUNT,
      builder: { depositPolicy },
      mechanism: { sigma_min: sigmaMin },
    });

    const traces = sybilSplit
      ? result.traces.map(splitTraceForSybil)
      : result.traces;

    const frames: StoryFrameData[] = [];
    for (const trace of traces) {
      for (let f = 0; f < STORY_FRAMES_PER_ROUND; f++) {
        frames.push(frameFromTrace(trace, f as StoryFrameIndex));
      }
    }

    return {
      frames,
      forecasterCount: sybilSplit
        ? STORY_SYBIL_FORECASTER_COUNT
        : STORY_FORECASTER_COUNT,
      totalRounds: traces.length,
    };
  }, [seed, sigmaMin, depositPolicy, sybilSplit, rounds]);
}
