import { useMemo } from 'react';
import {
  runPipeline,
  type PipelineResult,
  type PipelineOptions,
} from '@/lib/coreMechanism/runPipeline';

/**
 * Wraps `runPipeline()` in a `useMemo` so the simulation only re-runs
 * when the option values actually change. Returns the result and a
 * staleness flag (always false for synchronous execution; the interface
 * supports a future async path).
 */
export function useScenarioRun(options: PipelineOptions): {
  result: PipelineResult;
  isStale: boolean;
} {
  const {
    dgpId,
    behaviourPreset,
    rounds,
    seed,
    n,
    builder,
    mechanism,
  } = options;

  // Extract stable primitives from builder/mechanism to avoid JSON.stringify in deps
  const builderDepositPolicy = builder?.depositPolicy;
  const builderInfluenceRule = builder?.influenceRule;
  const builderAggregationRule = builder?.aggregationRule;
  const builderSettlementRule = builder?.settlementRule;
  const mechanismLam = mechanism?.lam;
  const mechanismRho = mechanism?.rho;
  const mechanismSigmaMin = mechanism?.sigma_min;

  const result = useMemo(
    () => runPipeline(options),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stable primitives extracted above
    [
      dgpId,
      behaviourPreset,
      rounds,
      seed,
      n,
      builderDepositPolicy,
      builderInfluenceRule,
      builderAggregationRule,
      builderSettlementRule,
      mechanismLam,
      mechanismRho,
      mechanismSigmaMin,
    ],
  );
  return { result, isStale: false };
}
