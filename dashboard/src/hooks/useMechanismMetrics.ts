import { useMemo } from 'react';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import type { MechanismResponseMetrics } from '@/lib/behaviour/mechanismMetrics';

/**
 * Computes mechanism response metrics by comparing a test pipeline run
 * against a baseline. Derives skill recovery time, wealth penalty,
 * aggregate contamination, and concentration impact.
 */
export function useMechanismMetrics(
  test: PipelineResult,
  baseline: PipelineResult,
  attackerIndex: number,
  transitionRound?: number,
): MechanismResponseMetrics {
  return useMemo(() => {
    const rho = test.params.rho;
    const ewmaHalfLife = Math.log(2) / rho;

    // Skill recovery: rounds for attacker's σ to drop below 0.5 after attack onset
    const startRound = transitionRound ?? 0;
    let skillRecoveryRounds: number | null = null;
    for (let i = startRound; i < test.traces.length; i++) {
      if (test.traces[i].sigma_t[attackerIndex] < 0.5) {
        skillRecoveryRounds = i - startRound;
        break;
      }
    }

    // Wealth penalty: attacker's final wealth vs baseline
    const wealthPenalty =
      test.finalState[attackerIndex].wealth -
      baseline.finalState[attackerIndex].wealth;

    // Aggregate contamination: peak |Δ CRPS| during attack window
    let aggregateContamination = 0;
    const maxRound = Math.min(test.rounds.length, baseline.rounds.length);
    for (let i = startRound; i < maxRound; i++) {
      const delta = Math.abs(test.rounds[i].error - baseline.rounds[i].error);
      if (delta > aggregateContamination) aggregateContamination = delta;
    }

    // Concentration impact: Δ Gini
    const concentrationImpact =
      test.summary.finalGini - baseline.summary.finalGini;

    return {
      skillRecoveryRounds,
      wealthPenalty,
      aggregateContamination,
      concentrationImpact,
      ewmaHalfLife,
    };
  }, [test, baseline, attackerIndex, transitionRound]);
}
