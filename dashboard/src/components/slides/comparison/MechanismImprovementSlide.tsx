import SlideWrapper from '../SlideWrapper';
import InsightCard from './InsightCard';
import { useComparisonData } from '../../../lib/comparison/useComparisonData';
import {
  aggregateByMethod,
  computeImprovement,
  formatPercent,
  formatDelta,
  deltaColor,
} from '../../../lib/comparison/comparisonUtils';
import type {
  DgpData,
  RealComparisonData,
  AggregatedRow,
  ComparisonRow,
} from '../../../lib/comparison/types';

/* ── Helpers ─────────────────────────────────────────────────── */

interface DatasetResult {
  label: string;
  pctImprovement: number;
  deltaCrps: number;
}

function findRow<T extends { method: string }>(
  rows: T[],
  method: string,
): T | undefined {
  return rows.find((r) => r.method === method);
}

function buildDatasetResult(
  label: string,
  uniformCrps: number,
  mechanismCrps: number,
  mechanismDelta: number,
): DatasetResult {
  return {
    label,
    pctImprovement: computeImprovement(uniformCrps, mechanismCrps),
    deltaCrps: mechanismDelta,
  };
}

/* ── Component ──────────────────────────────────────────────── */

export default function MechanismImprovementSlide() {
  const dgp = useComparisonData<DgpData>(
    'data/core 2/experiments/master_comparison/data/master_comparison.json',
  );
  const elec = useComparisonData<RealComparisonData>(
    'data/real_data/elia_electricity/data/comparison.json',
  );
  const wind = useComparisonData<RealComparisonData>(
    'data/real_data/elia_wind/data/comparison.json',
  );

  const anyLoading = dgp.loading || elec.loading || wind.loading;

  /* Build per-dataset results */
  const datasets: DatasetResult[] = [];

  if (dgp.data) {
    const agg = aggregateByMethod(dgp.data.rows);
    const uniform = findRow<AggregatedRow>(agg, 'uniform');
    const mechanism = findRow<AggregatedRow>(agg, 'mechanism');
    if (uniform && mechanism) {
      datasets.push(
        buildDatasetResult('DGP', uniform.meanCrps, mechanism.meanCrps, mechanism.meanDelta),
      );
    }
  }

  if (elec.data) {
    const uniform = findRow<ComparisonRow>(elec.data.rows, 'uniform');
    const mechanism = findRow<ComparisonRow>(elec.data.rows, 'mechanism');
    if (uniform && mechanism) {
      datasets.push(
        buildDatasetResult('Electricity', uniform.mean_crps, mechanism.mean_crps, mechanism.delta_crps_vs_equal),
      );
    }
  }

  if (wind.data) {
    const uniform = findRow<ComparisonRow>(wind.data.rows, 'uniform');
    const mechanism = findRow<ComparisonRow>(wind.data.rows, 'mechanism');
    if (uniform && mechanism) {
      datasets.push(
        buildDatasetResult('Wind', uniform.mean_crps, mechanism.mean_crps, mechanism.delta_crps_vs_equal),
      );
    }
  }

  return (
    <SlideWrapper>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
        Comparison
      </h2>
      <h3 className="text-2xl font-bold text-slate-900">
        Mechanism Improvement over Equal Weighting
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-2xl">
        Relative and absolute improvement of the mechanism (skill + stake) over
        uniform weighting across the DGP simulation, Elia electricity, and Elia
        wind datasets.
      </p>

      {/* Loading spinner */}
      {anyLoading && (
        <div className="mt-8 flex items-center gap-2 text-sm text-slate-500">
          <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
            />
          </svg>
          Loading comparison data…
        </div>
      )}

      {/* Per-dataset error banners */}
      {dgp.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          DGP data failed to load: {dgp.error}
        </div>
      )}
      {elec.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Electricity data failed to load: {elec.error}
        </div>
      )}
      {wind.error && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
          Wind data failed to load: {wind.error}
        </div>
      )}

      {/* Dataset cards */}
      {datasets.length > 0 && (
        <div className="mt-8 grid gap-6 sm:grid-cols-3">
          {datasets.map((ds) => (
            <div
              key={ds.label}
              className="rounded-xl border border-slate-200 bg-white p-6 flex flex-col items-center text-center"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                {ds.label}
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {formatPercent(ds.pctImprovement)}
              </p>
              <p className="text-xs text-slate-400 mt-1">improvement</p>
              <p
                className={`mt-3 font-mono text-sm ${deltaColor(ds.deltaCrps)}`}
              >
                ΔCRPS {formatDelta(ds.deltaCrps)}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Insight cards */}
      {!anyLoading && (
        <div className="mt-8 flex flex-col gap-4">
          <InsightCard
            color="amber"
            title="Electricity vs wind improvement gap"
            description="The wind panel has more variance in forecaster quality, so the mechanism has more to redistribute. The electricity panel does not."
          />
          <InsightCard
            color="blue"
            title="DGP: larger and more stable improvement"
            description="Under the simulation, the latent state is identifiable and skill estimates converge, so the mechanism separates from equal weighting more cleanly than on real data."
          />
        </div>
      )}
    </SlideWrapper>
  );
}
