/**
 * React hooks for the results analysis layer.
 *
 * Each hook follows the AsyncData pattern: { data, loading, error }.
 * Hooks call adapter functions for data loading and pure computation
 * modules for analysis. No business logic lives here — hooks are
 * thin wiring between the data layer and UI components.
 *
 * Requirements: 1.6, 2.6, 3.1, 4.1, 5.1, 7.5, 9.1, 11.4, 12.1, 14.3
 */

import { useState, useEffect } from 'react';

import type {
  AsyncData,
  ClaimValidationState,
  EffectSizeState,
  ConsistencyResult,
  RegimeStats,
  SensitivitySummary,
  BaselineCoverageEntry,
  AblationInterpretation,
  EffectSizeResult,
  EnrichedThesisClaim,
  FailureMode,
  AnalysisGap,
  InteractionAnalysis,
  PanelSweepResult,
} from '../lib/analysis/types';

import {
  loadMasterComparison,
  loadExperimentList,
  loadForecastSeries,
  loadBankrollAblation,
  loadSweepData,
  loadRealDataComparison,
  loadRegimeBreakdown as loadRegimeBreakdownAdapter,
  loadDepositInteraction as loadDepositInteractionAdapter,
  loadPanelSizeSensitivity as loadPanelSizeSensitivityAdapter,
  type RealDataResult,
} from '../lib/adapters';
import type { ExperimentMeta } from '../lib/types';

import { validateAllClaims } from '../lib/analysis/claimValidator';
import { computeCohensD } from '../lib/analysis/effectSize';
import { computeConsistencyMatrix } from '../lib/analysis/resultConsistency';
import { computeEarlyLateBreakdown } from '../lib/analysis/regimeBreakdown';
import { computeSensitivity } from '../lib/analysis/sensitivityAnalysis';
import { auditBaselineCoverage } from '../lib/analysis/baselineCoverage';
import { interpretAblation } from '../lib/analysis/ablationInterpreter';

const DATA_BASE = `${import.meta.env.BASE_URL}data`;

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return (await res.json()) as T;
}

// ── 1. useClaimValidation ──────────────────────────────────────────

/**
 * Loads enriched thesis_results.json and master comparison data,
 * then validates all claims against loaded experiment data.
 */
export function useClaimValidation(): ClaimValidationState & { claims: EnrichedThesisClaim[] } {
  const [state, setState] = useState<ClaimValidationState & { claims: EnrichedThesisClaim[] }>({
    results: [],
    claims: [],
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [claims, masterData, experimentList] = await Promise.all([
          fetchJSON<EnrichedThesisClaim[]>(`${DATA_BASE}/thesis_results.json`),
          loadMasterComparison(),
          loadExperimentList(),
        ]);

        if (cancelled) return;

        // ── Validate thesis_results.json schema (Req 15.4) ──────────
        const experimentNames = new Set(
          (experimentList as ExperimentMeta[]).map((e) => e.name),
        );

        for (const claim of claims) {
          // Check required fields: conditions, evidence, limitations
          if (!claim.conditions) {
            console.warn(
              `[thesis_results.json] Claim "${claim.id}" is missing required "conditions" field`,
            );
          }
          if (!claim.evidence) {
            console.warn(
              `[thesis_results.json] Claim "${claim.id}" is missing required "evidence" field`,
            );
          }
          if (!claim.limitations) {
            console.warn(
              `[thesis_results.json] Claim "${claim.id}" is missing required "limitations" field`,
            );
          }

          // Verify experimentName exists in index.json (Req 15.5)
          if (claim.experimentName && !experimentNames.has(claim.experimentName)) {
            console.warn(
              `[thesis_results.json] Claim "${claim.id}" references experiment "${claim.experimentName}" which does not exist in index.json`,
            );
          }
        }

        const dataByExperiment = new Map<string, import('../lib/types').MasterComparisonRow[]>();
        if (masterData?.rows) {
          // Group rows by experiment name
          for (const row of masterData.rows) {
            const key = row.experiment ?? 'master_comparison';
            if (!dataByExperiment.has(key)) dataByExperiment.set(key, []);
            dataByExperiment.get(key)!.push(row);
          }
          // Also store under 'master_comparison' for claims referencing it
          if (!dataByExperiment.has('master_comparison')) {
            dataByExperiment.set('master_comparison', masterData.rows);
          }
        }

        const results = validateAllClaims(claims, dataByExperiment);
        setState({ results, claims, loading: false, error: null });
      } catch (err) {
        if (!cancelled) {
          setState({ results: [], claims: [], loading: false, error: String(err) });
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 2. useEffectSizes ──────────────────────────────────────────────

/**
 * Loads master comparison per-seed deltas, groups by method,
 * and computes Cohen's d for each method vs equal weighting.
 */
export function useEffectSizes(): EffectSizeState {
  const [state, setState] = useState<EffectSizeState>({
    byMethod: new Map(),
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const masterData = await loadMasterComparison();
        if (cancelled) return;

        const byMethod = new Map<string, EffectSizeResult>();

        if (masterData?.rows) {
          // Group per-seed deltas by method
          const deltasByMethod = new Map<string, number[]>();
          for (const row of masterData.rows) {
            if (row.method === 'equal') continue; // skip equal vs itself
            if (!deltasByMethod.has(row.method)) deltasByMethod.set(row.method, []);
            deltasByMethod.get(row.method)!.push(row.delta_crps_vs_equal);
          }

          for (const [method, deltas] of deltasByMethod) {
            byMethod.set(method, computeCohensD(deltas));
          }
        }

        setState({ byMethod, loading: false });
      } catch {
        if (!cancelled) setState({ byMethod: new Map(), loading: false });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 3. useResultConsistency ────────────────────────────────────────

/**
 * Loads results from multiple experiments and computes the
 * cross-experiment consistency matrix with Kendall's W.
 */
export function useResultConsistency(): AsyncData<ConsistencyResult> {
  const [state, setState] = useState<AsyncData<ConsistencyResult>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const masterData = await loadMasterComparison();
        if (cancelled) return;

        if (!masterData?.rows?.length) {
          setState({ data: null, loading: false, error: 'No master comparison data' });
          return;
        }

        // Group by experiment
        const experimentResults = new Map<string, { method: string; meanCrps: number }[]>();

        // Group rows by experiment, then compute mean CRPS per method
        const grouped = new Map<string, Map<string, number[]>>();
        for (const row of masterData.rows) {
          const expName = row.experiment ?? 'master_comparison';
          if (!grouped.has(expName)) grouped.set(expName, new Map());
          const methodMap = grouped.get(expName)!;
          if (!methodMap.has(row.method)) methodMap.set(row.method, []);
          methodMap.get(row.method)!.push(row.mean_crps);
        }

        for (const [exp, methodMap] of grouped) {
          const methods: { method: string; meanCrps: number }[] = [];
          for (const [method, values] of methodMap) {
            const mean = values.reduce((s, v) => s + v, 0) / values.length;
            methods.push({ method, meanCrps: mean });
          }
          experimentResults.set(exp, methods);
        }

        const result = computeConsistencyMatrix(experimentResults);
        setState({ data: result, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 4. useRegimeBreakdown ──────────────────────────────────────────

/**
 * Loads CRPS time series for a given experiment and computes
 * early/late regime breakdown.
 */
export function useRegimeBreakdown(experimentName: string): AsyncData<RegimeStats[]> {
  const [state, setState] = useState<AsyncData<RegimeStats[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const experiments = await loadExperimentList();
        const exp = experiments.find((e) => e.name === experimentName);
        if (!exp) {
          setState({ data: null, loading: false, error: `Experiment "${experimentName}" not found` });
          return;
        }

        const series = await loadForecastSeries(exp);
        if (cancelled) return;

        const timeSeries = series.map((p) => ({
          t: p.t,
          crpsMechanism: p.crpsMechanism,
          crpsUniform: p.crpsUniform,
        }));

        const [early, late] = computeEarlyLateBreakdown(timeSeries);
        setState({ data: [early, late], loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, [experimentName]);

  return state;
}

// ── 5. useSensitivityData ──────────────────────────────────────────

/**
 * Loads parameter_sweep data and computes sensitivity analysis.
 */
export function useSensitivityData(): AsyncData<SensitivitySummary> {
  const [state, setState] = useState<AsyncData<SensitivitySummary>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const experiments = await loadExperimentList();
        const sweepExp = experiments.find((e) => e.name === 'parameter_sweep');
        if (!sweepExp) {
          setState({ data: null, loading: false, error: 'parameter_sweep experiment not found' });
          return;
        }

        const sweepData = await loadSweepData(sweepExp);
        if (cancelled) return;

        const defaultParams: Record<string, number> = {
          lam: 0.5,
          sigmaMin: 0.01,
        };

        const summary = computeSensitivity(sweepData, defaultParams);
        setState({ data: summary, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 6. useBaselineCoverage ─────────────────────────────────────────

/**
 * Loads experiment list and method data, then audits baseline coverage.
 */
export function useBaselineCoverage(): AsyncData<BaselineCoverageEntry[]> {
  const [state, setState] = useState<AsyncData<BaselineCoverageEntry[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [experiments, masterData] = await Promise.all([
          loadExperimentList(),
          loadMasterComparison(),
        ]);
        if (cancelled) return;

        const dataByExperiment = new Map<string, { method: string }[]>();
        if (masterData?.rows) {
          for (const row of masterData.rows) {
            const key = row.experiment ?? 'master_comparison';
            if (!dataByExperiment.has(key)) dataByExperiment.set(key, []);
            dataByExperiment.get(key)!.push({ method: row.method });
          }
        }

        const entries = auditBaselineCoverage(experiments, dataByExperiment);
        setState({ data: entries, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 7. useAblationInterpretation ───────────────────────────────────

/**
 * Loads bankroll ablation data and interprets step contributions.
 */
export function useAblationInterpretation(): AsyncData<AblationInterpretation> {
  const [state, setState] = useState<AsyncData<AblationInterpretation>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const ablationData = await loadBankrollAblation();
        if (cancelled) return;

        if (!ablationData?.rows?.length) {
          setState({ data: null, loading: false, error: 'No ablation data available' });
          return;
        }

        const fullRow = ablationData.rows.find((r) => r.variant === 'Full');
        const fullCrps = fullRow?.mean_crps ?? 0;
        const removalRows = ablationData.rows.filter((r) => r.variant !== 'Full');

        const interpretation = interpretAblation(removalRows, fullCrps);
        setState({ data: interpretation, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 8. useRealDataContext ──────────────────────────────────────────

/**
 * Loads real-data comparisons (Elia wind + Elia electricity) and synthetic
 * comparison for side-by-side display.
 */
export function useRealDataContext(): AsyncData<{
  realData: RealDataResult | null;
  realDataElectricity: RealDataResult | null;
  syntheticDeltaCrps: number | null;
}> {
  const [state, setState] = useState<AsyncData<{
    realData: RealDataResult | null;
    realDataElectricity: RealDataResult | null;
    syntheticDeltaCrps: number | null;
  }>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const [realData, realDataElectricity, masterData] = await Promise.all([
          loadRealDataComparison('elia_wind'),
          loadRealDataComparison('elia_electricity'),
          loadMasterComparison(),
        ]);
        if (cancelled) return;

        // Compute synthetic ΔCRPS for blended vs equal
        let syntheticDeltaCrps: number | null = null;
        if (masterData?.rows) {
          const blendedRows = masterData.rows.filter((r) => r.method === 'blended');
          if (blendedRows.length > 0) {
            syntheticDeltaCrps =
              blendedRows.reduce((s, r) => s + r.delta_crps_vs_equal, 0) / blendedRows.length;
          }
        }

        setState({
          data: { realData, realDataElectricity, syntheticDeltaCrps },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 9. useFailureModes ─────────────────────────────────────────────

/**
 * Loads failure_modes.json.
 */
export function useFailureModes(): AsyncData<FailureMode[]> {
  const [state, setState] = useState<AsyncData<FailureMode[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await fetchJSON<FailureMode[]>(`${DATA_BASE}/failure_modes.json`);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 10. useAnalysisGaps ────────────────────────────────────────────

/**
 * Loads analysis_gaps.json.
 */
export function useAnalysisGaps(): AsyncData<AnalysisGap[]> {
  const [state, setState] = useState<AsyncData<AnalysisGap[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await fetchJSON<AnalysisGap[]>(`${DATA_BASE}/analysis_gaps.json`);
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 11. useRegimeBreakdownFromAdapter ──────────────────────────────

/**
 * Loads regime breakdown from the pre-computed JSON adapter.
 */
export function useRegimeBreakdownFromAdapter(): AsyncData<RegimeStats[]> {
  const [state, setState] = useState<AsyncData<RegimeStats[]>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await loadRegimeBreakdownAdapter();
        if (!cancelled) setState({ data: data.length > 0 ? data : null, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 12. useDepositInteraction ──────────────────────────────────────

/**
 * Loads deposit interaction analysis from the pre-computed JSON adapter.
 */
export function useDepositInteraction(): AsyncData<InteractionAnalysis> {
  const [state, setState] = useState<AsyncData<InteractionAnalysis>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await loadDepositInteractionAdapter();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}

// ── 13. usePanelSizeSensitivity ────────────────────────────────────

/**
 * Loads panel size sensitivity sweep from the pre-computed JSON adapter.
 */
export function usePanelSizeSensitivity(): AsyncData<PanelSweepResult> {
  const [state, setState] = useState<AsyncData<PanelSweepResult>>({
    data: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        const data = await loadPanelSizeSensitivityAdapter();
        if (!cancelled) setState({ data, loading: false, error: null });
      } catch (err) {
        if (!cancelled) setState({ data: null, loading: false, error: String(err) });
      }
    }

    run();
    return () => { cancelled = true; };
  }, []);

  return state;
}
