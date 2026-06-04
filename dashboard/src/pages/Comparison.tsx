import { useEffect, useState } from 'react';
import ThesisHeader from '@/components/thesis/ThesisHeader';
import { LoadingState } from '@/components/dashboard/DataStates';
import { loadMasterComparison, loadBankrollAblation } from '@/lib/adapters';
import type { MasterComparisonRow, BankrollAblationRow } from '@/lib/types';

function formatNum(x: number | undefined): string {
  if (x == null || Number.isNaN(x)) return '—';
  return x.toFixed(4);
}

export default function Comparison() {
  const [master, setMaster] = useState<{ config: unknown; rows: MasterComparisonRow[] } | null>(null);
  const [ablation, setAblation] = useState<{ config: unknown; rows: BankrollAblationRow[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([loadMasterComparison(), loadBankrollAblation()]).then(([m, a]) => {
      if (!cancelled) {
        setMaster(m ?? null);
        setAblation(a ?? null);
        setLoading(false);
      }
    });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex flex-col h-full">
        <ThesisHeader compact />
        <LoadingState message="Loading comparison data…" />
      </div>
    );
  }

  const hasMaster = master && master.rows.length > 0;
  const hasAblation = ablation && ablation.rows.length > 0;

  return (
    <div className="flex flex-col h-full">
      <ThesisHeader compact />
      <div className="px-4 pb-2 text-sm text-slate-600">
        Paired deltas of the mechanism against the equal-weight baseline and the full pipeline.
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-8">
        {hasMaster && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Master comparison</h2>
            <p className="text-sm text-slate-600 mb-3">
              All weighting methods on the same panel (same seed, DGP, T). Δ CRPS = CRPS_method − CRPS_equal (negative = better).
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">method</th>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">seed</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">mean CRPS</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">Δ CRPS vs equal</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">mean HHI</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">N_eff</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">final Gini</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {master.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-800">{r.method}</td>
                      <td className="px-3 py-2 text-slate-600">{r.seed}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.mean_crps)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${(r.delta_crps_vs_equal ?? 0) < 0 ? 'text-emerald-600' : ''}`}>
                        {formatNum(r.delta_crps_vs_equal)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.mean_HHI)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.mean_N_eff)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.final_gini)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {hasAblation && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Bankroll ablation</h2>
            <p className="text-sm text-slate-600 mb-3">
              Full = A→B→C→D→E. A-=no confidence, B-=fixed deposit, C-=no skill gate, D-=no cap, E-=freeze wealth. Δ CRPS vs Full.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-slate-700">variant</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">mean CRPS</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">Δ CRPS vs Full</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">mean HHI</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">N_eff</th>
                    <th className="px-3 py-2 text-right font-medium text-slate-700">final Gini</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {ablation.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 text-slate-800 font-medium">{r.variant}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.mean_crps)}</td>
                      <td className={`px-3 py-2 text-right tabular-nums ${(r.delta_crps_vs_full ?? 0) > 0 ? 'text-amber-600' : ''}`}>
                        {formatNum(r.delta_crps_vs_full)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.mean_HHI)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.mean_N_eff)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatNum(r.final_gini)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {!hasMaster && !hasAblation && (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-slate-600 text-sm">
            No comparison data is available for this view.
          </div>
        )}
      </div>
    </div>
  );
}
