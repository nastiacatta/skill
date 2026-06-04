// ── Shared comparison data types ────────────────────────────

/** Row from master_comparison.json or real-data comparison.json */
export interface ComparisonRow {
  experiment: string;
  method: string;
  seed: number;
  DGP: string;
  preset: string;
  mean_crps: number;
  delta_crps_vs_equal: number;
}

/** Config from master_comparison.json */
export interface DgpConfig {
  T: number;
  n_forecasters: number;
  seeds: number[];
}

/** Full master_comparison.json shape */
export interface DgpData {
  config: DgpConfig;
  rows: ComparisonRow[];
}

/** Config from real-data comparison.json */
export interface RealDataConfig {
  T: number;
  n_forecasters: number;
  warmup: number;
  series_name: string;
  series_min?: number;
  series_max?: number;
  forecasters: string[];
}

/** Full real-data comparison.json shape */
export interface RealComparisonData {
  config: RealDataConfig;
  rows: ComparisonRow[];
  per_round: unknown[];
}

/** Aggregated method row after cross-seed averaging */
export interface AggregatedRow {
  method: string;
  meanCrps: number;
  meanDelta: number;
  seedCount: number;
}

/** Project claim from thesis_results.json */
export interface ThesisClaim {
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
}

/** Deposit sensitivity entry per policy */
export interface DepositSensitivityEntry {
  uniform: number;
  skill: number;
  mechanism: number;
  delta_skill: number;
  delta_mech: number;
  pct_skill: number;
  pct_mech: number;
}

/** Full deposit_sensitivity.json shape */
export interface DepositSensitivityData {
  deposit_sensitivity: Record<string, DepositSensitivityEntry>;
}

/** Wind experiment data (day_ahead, 4h_ahead, regime_shift) */
export interface WindExperimentData {
  config: {
    T: number;
    n_forecasters: number;
    warmup: number;
    horizon: number;
    label: string;
    forecasters: string[];
  };
  rows: ComparisonRow[];
  per_round: unknown[];
}

// ── Hook return type ──

export interface UseDataResult<T> {
  data: T | null;
  error: string | null;
  loading: boolean;
}

// ── Component props ──

export interface InsightCardProps {
  icon?: string;
  color: 'green' | 'amber' | 'red' | 'blue';
  title: string;
  description: string;
}
