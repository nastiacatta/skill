import { useMemo } from 'react';
import { runPipeline, type PipelineResult } from '@/lib/coreMechanism/runPipeline';
import { PRESET_CONFIGS } from '@/lib/behaviour/presetMeta';
import { FAMILY_COLORS } from '@/lib/palette';
import type { BehaviourFamily, BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ComparisonRow {
  name: string;
  presetId: string;
  family: string;
  /** Plain-English description of the behaviour (from PRESET_CONFIGS). */
  description: string;
  meanCrps: number;
  deltaCrpsPct: number;
  gini: number;
  nEff: number;
  participation: number;
  color: string;
  deltaPct: number;
}

export interface FamilyImpactDatum {
  family: string;
  worstDeltaCrpsPct: number;
  color: string;
}

export interface SweepPoint {
  lam: number;
  sig: number;
  error: number;
  gini: number;
}

export interface BehaviourSimulations {
  /** Individual pipeline results keyed by preset ID */
  pipelines: Record<string, PipelineResult>;
  /** Baseline pipeline (convenience alias) */
  baseline: PipelineResult;
  /** 18-row comparison summary */
  summary: ComparisonRow[];
  /** Worst-case delta per family */
  familyImpact: FamilyImpactDatum[];
  /** λ × σ_min sensitivity sweep */
  sweep: SweepPoint[];
}

// ── Helpers ────────────────────────────────────────────────────────────────

/** Compare two pipelines: returns {deltaPct, deltaAbs}. */
export function compare(test: PipelineResult, base: PipelineResult) {
  const d = test.summary.meanError - base.summary.meanError;
  const pct = base.summary.meanError > 0 ? (d / base.summary.meanError * 100) : 0;
  return { deltaAbs: d, deltaPct: pct };
}

// ── Preset run list (excludes reinforcement_learner) ───────────────────────

const PRESET_COLORS: Record<string, string> = {
  baseline: '#94a3b8',
  bursty: '#0ea5e9',
  risk_averse: '#6366f1',
  manipulator: '#ef4444',
  arbitrageur: '#f59e0b',
  sybil: '#f97316',
  collusion: '#ec4899',
  reputation_reset: '#dc2626',
  evader: '#a855f7',
  biased: '#3b82f6',
  miscalibrated: '#2563eb',
  noisy_reporter: '#8b5cf6',
  budget_constrained: '#14b8a6',
  house_money: '#0d9488',
  kelly_sizer: '#059669',
  reputation_gamer: '#7c3aed',
  sandbagger: '#9333ea',
  latency_exploiter: '#64748b',
};

const PRESET_IDS = Object.keys(PRESET_COLORS) as string[];

// ── Hook ───────────────────────────────────────────────────────────────────

export function useBehaviourSimulations(config?: {
  seed?: number;
  n?: number;
  rounds?: number;
}): BehaviourSimulations {
  const seed = config?.seed ?? 42;
  const n = config?.n ?? 6;
  const rounds = config?.rounds ?? 300;

  // Run all 18 preset pipelines + baseline
  const pipelines = useMemo(() => {
    const result: Record<string, PipelineResult> = {};
    for (const id of PRESET_IDS) {
      try {
        result[id] = runPipeline({
          dgpId: 'baseline',
          behaviourPreset: id as BehaviourPresetId,
          rounds,
          seed,
          n,
        });
      } catch (e) {
        console.warn(`Pipeline failed for preset "${id}":`, e);
        // Fallback: zeroed summary metrics
        result[id] = {
          summary: { meanError: 0, finalGini: 0, meanNEff: 0, meanParticipation: 0 },
          rounds: [],
          traces: [],
          finalState: [],
        } as unknown as PipelineResult;
      }
    }
    return result;
  }, [seed, n, rounds]);

  const baseline = pipelines.baseline;

  // Sensitivity sweep
  const sweep = useMemo(() => {
    const lams = [0.0, 0.1, 0.2, 0.3, 0.5, 0.7, 1.0];
    const sigs = [0.05, 0.1, 0.2, 0.3, 0.5];
    return lams.flatMap(lam =>
      sigs.map(sig => {
        const p = runPipeline({
          dgpId: 'baseline',
          behaviourPreset: 'baseline',
          rounds,
          seed,
          n,
          mechanism: { lam, sigma_min: sig } as Record<string, number>,
        });
        return { lam, sig, error: p.summary.meanError, gini: p.summary.finalGini };
      }),
    );
  }, [seed, n, rounds]);

  // 18-row comparison summary
  const summary = useMemo(() => {
    return PRESET_IDS.map(id => {
      const pipeline = pipelines[id];
      const config = PRESET_CONFIGS[id as BehaviourPresetId];
      const { deltaPct } = compare(pipeline, baseline);
      return {
        name: config?.label ?? id,
        family: config?.family ?? 'reporting',
        description: config?.description ?? '',
        meanCrps: pipeline.summary.meanError,
        deltaCrpsPct: deltaPct,
        gini: pipeline.summary.finalGini,
        nEff: pipeline.summary.meanNEff,
        participation: pipeline.summary.meanParticipation,
        color: PRESET_COLORS[id] ?? '#94a3b8',
        presetId: id,
        deltaPct,
      };
    });
  }, [pipelines, baseline]);

  // Worst-case delta per family
  const familyImpact = useMemo(() => {
    const byFamily = new Map<string, number>();
    for (const row of summary) {
      const config = PRESET_CONFIGS[row.presetId as BehaviourPresetId];
      if (!config) continue;
      const current = byFamily.get(config.family) ?? 0;
      if (Math.abs(row.deltaPct) > Math.abs(current)) {
        byFamily.set(config.family, row.deltaPct);
      }
    }
    return [...byFamily.entries()].map(([family, delta]) => ({
      family,
      worstDeltaCrpsPct: delta,
      color: FAMILY_COLORS[family as BehaviourFamily] ?? '#94a3b8',
    }));
  }, [summary]);

  return { pipelines, baseline, summary, familyImpact, sweep };
}
