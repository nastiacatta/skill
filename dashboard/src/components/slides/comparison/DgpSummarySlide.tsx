import SlideWrapper from '../SlideWrapper';
import { useComparisonData } from '../../../lib/comparison/useComparisonData';
import {
  aggregateByMethod,
  formatCrps,
  formatDelta,
  deltaColor,
  findBestMethod,
} from '../../../lib/comparison/comparisonUtils';
import type {
  DgpData,
  RealComparisonData,
  AggregatedRow,
} from '../../../lib/comparison/types';

/* ── Constants ──────────────────────────────────────────────── */

const METHOD_ORDER = ['uniform', 'skill', 'mechanism', 'best_single'] as const;

const METHOD_LABELS: Record<string, string> = {
  uniform: 'Equal (Uniform)',
  skill: 'Skill Only',
  mechanism: 'Mechanism (Skill + Stake)',
  best_single: 'Best Single Forecaster',
};

const METHOD_COLORS: Record<string, string> = {
  uniform: 'bg-slate-500',
  skill: 'bg-indigo-500',
  mechanism: 'bg-teal-500',
  best_single: 'bg-violet-500',
};

/* ── Helpers ─────────────────────────────────────────────────── */

function methodLabel(method: string): string {
  return METHOD_LABELS[method] ?? method;
}

/** Build a lookup from method → row for quick access */
function toMethodMap<T extends { method: string }>(rows: T[]): Map<string, T> {
  const map = new Map<string, T>();
  for (const r of rows) map.set(r.method, r);
  return map;
}

/* ── Component ──────────────────────────────────────────────── */

export default function DgpSummarySlide() {
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
  const allDone = !dgp.loading && !elec.loading && !wind.loading;

  // Aggregate DGP rows across seeds
  const dgpAgg = dgp.data
    ? aggregateByMethod(dgp.data.rows).filter((r) =>
        (METHOD_ORDER as readonly string[]).includes(r.method),
      )
    : [];
  const dgpMap = toMethodMap(dgpAgg);
  const seedCount = dgp.data?.config.seeds.length ?? 0;

  // Real-data lookups (single seed, no aggregation needed)
  const elecMap = elec.data ? toMethodMap(elec.data.rows) : new Map();
  const windMap = wind.data ? toMethodMap(wind.data.rows) : new Map();

  // Best method per dataset
  const bestDgp = dgpAgg.length > 0 ? findBestMethod(dgpAgg) : null;
  const bestElec =
    elec.data && elec.data.rows.length > 0
      ? findBestMethod(
          elec.data.rows.map((r) => ({ method: r.method, meanCrps: r.mean_crps })),
        )
      : null;
  const bestWind =
    wind.data && wind.data.rows.length > 0
      ? findBestMethod(
          wind.data.rows.map((r) => ({ method: r.method, meanCrps: r.mean_crps })),
        )
      : null;

  const isBestCrps = (method: string, dataset: 'dgp' | 'elec' | 'wind') => {
    if (dataset === 'dgp') return bestDgp?.method === method;
    if (dataset === 'elec') return bestElec?.method === method;
    return bestWind?.method === method;
  };

  const bestCellClass = 'bg-teal-50 text-teal-700 font-semibold';

  return (
    <SlideWrapper>
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-1">
        Comparison
      </h2>
      <h3 className="text-2xl font-bold text-slate-900">
        DGP vs Real-Data — Summary
      </h3>
      <p className="mt-2 text-sm text-slate-500 max-w-2xl">
        Side-by-side CRPS comparison across the controlled DGP simulation,
        Elia electricity, and Elia wind datasets.
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

      {/* Table — render once loading is done and at least one dataset succeeded */}
      {allDone && (dgp.data || elec.data || wind.data) && (
        <div className="mt-6 rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="bg-slate-50 text-xs font-bold uppercase tracking-widest text-slate-400">
                <th className="px-5 py-3">Method</th>
                {dgp.data && <th className="px-4 py-3 text-right">DGP CRPS</th>}
                {dgp.data && <th className="px-4 py-3 text-right">DGP ΔCRPS</th>}
                {elec.data && <th className="px-4 py-3 text-right">Elec CRPS</th>}
                {elec.data && <th className="px-4 py-3 text-right">Elec ΔCRPS</th>}
                {wind.data && <th className="px-4 py-3 text-right">Wind CRPS</th>}
                {wind.data && <th className="px-4 py-3 text-right">Wind ΔCRPS</th>}
              </tr>
            </thead>
            <tbody>
              {METHOD_ORDER.map((method) => {
                const dgpRow: AggregatedRow | undefined = dgpMap.get(method);
                const elecRow = elecMap.get(method);
                const windRow = windMap.get(method);

                return (
                  <tr key={method} className="border-t border-slate-100">
                    {/* Method name */}
                    <td className="px-5 py-3 text-sm font-medium text-slate-800">
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-2 h-2 rounded-full ${METHOD_COLORS[method] ?? 'bg-slate-400'}`}
                        />
                        {methodLabel(method)}
                      </div>
                    </td>

                    {/* DGP columns */}
                    {dgp.data && (
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm ${
                          isBestCrps(method, 'dgp') ? bestCellClass : 'text-slate-700'
                        }`}
                      >
                        {dgpRow ? formatCrps(dgpRow.meanCrps) : '—'}
                      </td>
                    )}
                    {dgp.data && (
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm ${
                          dgpRow ? deltaColor(dgpRow.meanDelta) : 'text-slate-400'
                        }`}
                      >
                        {dgpRow ? formatDelta(dgpRow.meanDelta) : '—'}
                      </td>
                    )}

                    {/* Electricity columns */}
                    {elec.data && (
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm ${
                          isBestCrps(method, 'elec') ? bestCellClass : 'text-slate-700'
                        }`}
                      >
                        {elecRow ? formatCrps(elecRow.mean_crps) : '—'}
                      </td>
                    )}
                    {elec.data && (
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm ${
                          elecRow ? deltaColor(elecRow.delta_crps_vs_equal) : 'text-slate-400'
                        }`}
                      >
                        {elecRow ? formatDelta(elecRow.delta_crps_vs_equal) : '—'}
                      </td>
                    )}

                    {/* Wind columns */}
                    {wind.data && (
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm ${
                          isBestCrps(method, 'wind') ? bestCellClass : 'text-slate-700'
                        }`}
                      >
                        {windRow ? formatCrps(windRow.mean_crps) : '—'}
                      </td>
                    )}
                    {wind.data && (
                      <td
                        className={`px-4 py-3 text-right font-mono text-sm ${
                          windRow ? deltaColor(windRow.delta_crps_vs_equal) : 'text-slate-400'
                        }`}
                      >
                        {windRow ? formatDelta(windRow.delta_crps_vs_equal) : '—'}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Seed count footnote */}
          {dgp.data && seedCount > 0 && (
            <div className="border-t border-slate-100 px-5 py-2 text-xs text-slate-400">
              DGP values averaged over {seedCount} seeds
            </div>
          )}
        </div>
      )}
    </SlideWrapper>
  );
}
