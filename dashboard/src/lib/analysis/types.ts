/**
 * Shared types for the results analysis layer.
 *
 * These interfaces define the enriched thesis-results schema,
 * failure-mode reports, analysis-gap entries, and all intermediate
 * data structures consumed by the pure computation modules and
 * React hooks in this feature.
 *
 * Requirements: 15.1, 15.2, 15.3, 15.4, 8.7
 */

import type { MasterComparisonRow, BankrollAblationRow, SweepPoint } from '../types';

// Re-export for convenience so downstream modules can import from one place.
export type { MasterComparisonRow, BankrollAblationRow, SweepPoint };

// ---------------------------------------------------------------------------
// Enriched thesis_results.json schema (Req 15)
// ---------------------------------------------------------------------------

/** Experimental conditions under which a thesis claim holds. */
export interface ClaimConditions {
  dgp: string;
  n_forecasters: number;
  T: number;
  deposit_policy: string;
  n_seeds: number;
}

/** Structured evidence metadata for automated validation. */
export interface ClaimEvidence {
  /** JSON path to the metric in the experiment data. */
  metric_field: string;
  /** Expected direction of the metric for the claim to hold. */
  expected_sign: 'positive' | 'negative';
  /** Minimum absolute value for the claim to hold. */
  threshold: number;
  /** Baseline method being compared against. */
  comparison_method: string;
}

/**
 * Enriched thesis claim — extends the original thesis_results.json
 * entries with structured evidence metadata so that the ClaimValidator
 * and ClaimEvidenceCard can operate without hardcoded assumptions.
 */
export interface EnrichedThesisClaim {
  id: string;
  title: string;
  claim: string;
  metric: string;
  metricLabel: string;
  chart: string;
  interpretation: string;
  caveat: string;
  experimentName: string;
  category: string;

  /** Experimental conditions under which the claim holds. */
  conditions: ClaimConditions;

  /** Structured evidence for automated validation. */
  evidence: ClaimEvidence;

  /** Known conditions where the claim does not hold. */
  limitations: string[];
}

// ---------------------------------------------------------------------------
// Failure mode report (Req 6)
// ---------------------------------------------------------------------------

export interface FailureMode {
  id: string;
  /** Human-readable condition description, e.g. "Small panel size (N ≤ 3)". */
  condition: string;
  /** Experiment that demonstrates the failure. */
  experimentName: string;
  /** Magnitude of degradation (ΔCRPS). */
  deltaCrps: number;
  ciLow: number;
  ciHigh: number;
  /** Hypothesised explanation. */
  explanation: string;
}

// ---------------------------------------------------------------------------
// Analysis gap checklist (Req 10)
// ---------------------------------------------------------------------------

export interface AnalysisGap {
  id: string;
  title: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  rationale: string;
  estimated_effort: string;
  status: 'not_started' | 'in_progress' | 'complete';
  /** URL/anchor to the completed analysis section (when status = complete). */
  link?: string;
}

// ---------------------------------------------------------------------------
// Claim validation (Req 1)
// ---------------------------------------------------------------------------

export type ClaimStatus = 'valid' | 'stale' | 'contradicted' | 'unverifiable';

export interface ClaimValidationResult {
  claimId: string;
  status: ClaimStatus;
  computedValue: number | null;
  statedValue: number | null;
  discrepancyPct: number | null;
  message: string;
}

// ---------------------------------------------------------------------------
// Effect size (Req 2)
// ---------------------------------------------------------------------------

export type EffectSizeLabel = 'negligible' | 'small' | 'medium' | 'large';

export interface EffectSizeResult {
  cohensD: number;
  label: EffectSizeLabel;
}

// ---------------------------------------------------------------------------
// Cross-experiment consistency (Req 3, 13)
// ---------------------------------------------------------------------------

export interface MethodRank {
  experiment: string;
  method: string;
  /** 1 = best (lowest) CRPS. */
  rank: number;
  meanCrps: number;
}

export interface ConsistencyResult {
  matrix: MethodRank[];
  kendallW: number;
  /** True when W > 0.7. */
  isConsistent: boolean;
  contradictions: Array<{
    experimentA: string;
    experimentB: string;
    methodA: string;
    methodB: string;
    description: string;
  }>;
}

// ---------------------------------------------------------------------------
// Regime breakdown (Req 5)
// ---------------------------------------------------------------------------

export interface RegimeStats {
  regimeName: string;
  nRounds: number;
  meanDeltaCrps: number;
  se: number;
  ciLow: number;
  ciHigh: number;
}

// ---------------------------------------------------------------------------
// Data integrity guard (Req 8)
// ---------------------------------------------------------------------------

export interface ValidationSchema {
  requiredFields: string[];
  numericFields: string[];
  rangeChecks: Array<{ field: string; min: number; max: number }>;
  expectedRowCount?: { value: number; tolerance: number };
}

export interface ValidationResult<T> {
  valid: boolean;
  warnings: string[];
  sanitisedData: T[];
  /** Fields where > 10 % of rows contain NaN. */
  degradedFields: string[];
}

// ---------------------------------------------------------------------------
// Ablation interpretation (Req 12)
// ---------------------------------------------------------------------------

export interface AblationStep {
  variant: string;
  label: string;
  /** CRPS_without − CRPS_full (positive ⇒ the step helps). */
  deltaCrpsContribution: number;
  /** True when |contribution| < 0.01 × CRPS_full. */
  isNegligible: boolean;
  complexityLevel: 'low' | 'medium' | 'high';
}

export interface AblationInterpretation {
  steps: AblationStep[];
  dominantStep: string;
  conclusion: string;
  /** True when the C- (skill gate) removal is negligible. */
  skillGateThreat: boolean;
}

// ---------------------------------------------------------------------------
// Deposit policy interaction (Req 7, 8)
// ---------------------------------------------------------------------------

export interface PolicyMethodResult {
  depositPolicy: string;
  method: string;
  meanDeltaCrps: number;
  se: number;
  ciLow: number;
  ciHigh: number;
}

export interface InteractionAnalysis {
  perPolicy: PolicyMethodResult[];
  interactionEffect: number;
  interactionSe: number;
  interactionCiLow: number;
  interactionCiHigh: number;
  interpretation: string;
  warning: string | null;
}

// ---------------------------------------------------------------------------
// Panel size sensitivity (Req 9, 10)
// ---------------------------------------------------------------------------

export interface PanelSizeResult {
  n: number;
  meanDeltaCrps: number;
  se: number;
  ciLow: number;
  ciHigh: number;
}

export interface PanelSweepResult {
  results: PanelSizeResult[];
  minimumReliableN: number | null;
}

// ---------------------------------------------------------------------------
// Sensitivity analysis (Req 4)
// ---------------------------------------------------------------------------

export interface SensitivityPoint {
  paramName: string;
  paramValue: number;
  deltaCrps: number;
}

export interface SensitivitySummary {
  points: SensitivityPoint[];
  mostSensitiveParam: string;
  leastSensitiveParam: string;
  crossoverPoints: Array<{ paramName: string; value: number }>;
  summaryText: string;
}

// ---------------------------------------------------------------------------
// Baseline coverage audit (Req 7)
// ---------------------------------------------------------------------------

export interface BaselineCoverageEntry {
  experimentName: string;
  presentBaselines: string[];
  missingBaselines: string[];
  isComplete: boolean;
}

// ---------------------------------------------------------------------------
// Async data hook pattern (shared across all analysis hooks)
// ---------------------------------------------------------------------------

export interface AsyncData<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export interface ClaimValidationState {
  results: ClaimValidationResult[];
  loading: boolean;
  error: string | null;
}

export interface EffectSizeState {
  byMethod: Map<string, EffectSizeResult>;
  loading: boolean;
}

// ---------------------------------------------------------------------------
// Pre-built validation schemas
// ---------------------------------------------------------------------------

export const CRPS_TIMESERIES_SCHEMA: ValidationSchema = {
  requiredFields: ['t', 'crps_uniform', 'crps_mechanism'],
  numericFields: ['t', 'crps_uniform', 'crps_deposit', 'crps_skill', 'crps_mechanism'],
  rangeChecks: [
    { field: 'crps_uniform', min: 0, max: Infinity },
    { field: 'crps_mechanism', min: 0, max: Infinity },
  ],
};

export const MASTER_COMPARISON_SCHEMA: ValidationSchema = {
  requiredFields: ['method', 'seed', 'mean_crps', 'delta_crps_vs_equal'],
  numericFields: ['seed', 'mean_crps', 'delta_crps_vs_equal'],
  rangeChecks: [
    { field: 'mean_crps', min: 0, max: Infinity },
  ],
};

export const SUMMARY_SCHEMA: ValidationSchema = {
  requiredFields: ['experiment_name'],
  numericFields: ['final_crps', 'final_gini', 'final_n_eff', 'mean_HHI'],
  rangeChecks: [
    { field: 'final_gini', min: 0, max: 1 },
    { field: 'final_n_eff', min: 0, max: Infinity },
  ],
};
