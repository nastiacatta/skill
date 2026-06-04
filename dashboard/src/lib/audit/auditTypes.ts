/**
 * TypeScript interfaces for the Model Performance Audit feature.
 *
 * These types describe the shape of data loaded from baselines.json,
 * deposit_sensitivity.json, and derived metrics computed client-side
 * in auditUtils.ts.
 */

import type { RealDataResult } from '../adapters';

// ── Data file shapes ───────────────────────────────────────────────

/** Baselines data from baselines.json */
export interface BaselinesData {
  config: {
    series: string;
    T: number;
    T_eval: number;
    n_forecasters: number;
    forecaster_names: string[];
    mechanism_params: Record<string, number>;
    vitali_lr: number;
    taus: number[];
  };
  summary: Array<{
    series: string;
    method: string;
    mean_crps: number;
    delta_vs_uniform: number;
    pct_vs_uniform: number;
  }>;
  rolling_crps?: {
    t: number[];
    [method: string]: number[] | number;
  };
}

/** Deposit sensitivity data from deposit_sensitivity.json */
export interface DepositSensitivityData {
  deposit_sensitivity: Record<
    string,
    {
      uniform: number;
      skill: number;
      mechanism: number;
      delta_skill: number;
      delta_mech: number;
      pct_skill: number;
      pct_mech: number;
    }
  >;
}

// ── Derived metric shapes ──────────────────────────────────────────

/** Per-forecaster CRPS statistics (mean, median, std, regime-conditional) */
export interface RegimeBreakdown {
  forecaster: string;
  meanCrps: number;
  medianCrps: number;
  stdCrps: number;
  highWindCrps: number;
  lowWindCrps: number;
}

/** Result of convergence analysis on skill histories */
export interface ConvergenceResult {
  convergedAtRound: number | null;
  stableForRounds: number;
  finalOrdering: string[];
}

/** A single improvement recommendation */
export interface Recommendation {
  id: string;
  category: 'model' | 'skill' | 'aggregation' | 'economic';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  evidence?: string;
  crpsEstimate?: string;
}

/** Literature reference for the Theory Grounding panel */
export interface LiteratureRef {
  id: string;
  category:
    | 'mechanism_design'
    | 'linear_pool'
    | 'online_learning'
    | 'alternative_aggregation'
    | 'model_improvement'
    | 'collusion';
  authors: string;
  title: string;
  keyFinding: string;
  empiricalConnection: string;
}

/** Theory vs practice comparison row */
export interface TheoryVsPracticeRow {
  theoreticalPrediction: string;
  empiricalObservation: string;
  source: string;
  supported: boolean;
}

/** Pair of forecasters with indistinguishable skill estimates */
export interface IndistinguishablePair {
  forecasterA: string;
  forecasterB: string;
  sigmaDiff: number;
}

// ── Hook return type ───────────────────────────────────────────────

/** Combined audit data returned by the useAuditData hook */
export interface AuditData {
  comparison: RealDataResult | null;
  baselines: BaselinesData | null;
  depositSensitivity: DepositSensitivityData | null;
  loading: boolean;
  errors: string[];
}
