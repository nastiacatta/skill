import { useState } from 'react';
import clsx from 'clsx';
import MathBlock from '@/components/dashboard/MathBlock';
import type { CoreSubtabId } from '@/lib/thesis';
import { CORE_SUBTABS, CORE_SUBTAB_LABELS } from '@/lib/thesis';

export default function CoreStep() {
  const [subtab, setSubtab] = useState<CoreSubtabId>('task_setup');

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-lg bg-slate-100 p-1">
        {CORE_SUBTABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubtab(id)}
            className={clsx(
              'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
              subtab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            )}
          >
            {CORE_SUBTAB_LABELS[id]}
          </button>
        ))}
      </div>

      {subtab === 'task_setup' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Client objective: obtain an accurate aggregate forecast. Reward or utility setup: Lambert skill pool (zero-sum redistribution). Forecast target: point forecast in [0,1].
          </p>
        </div>
      )}

      {subtab === 'submission' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            The mechanism observes only: participation, report r_i, wager b_i, account id. No access to beliefs or private information.
          </p>
        </div>
      )}

      {subtab === 'effective_wager' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Support modes: uniform, deposit only, skill only, skill × stake. Effective wager m_i = b_i · g(σ_i).
          </p>
          <MathBlock accent label="Effective wager" latex="m_{i,t} = b_{i,t} \\bigl( \\lambda + (1-\\lambda) \\sigma_{i,t}^\\eta \\bigr)" />
        </div>
      )}

      {subtab === 'aggregation' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Individual forecasts are combined into the aggregate using weights that blend <strong>stake</strong> and <strong>learned performance score</strong>.
          </p>
          <MathBlock accent label="Effective wager" latex="m_{i,t} = b_{i,t} \\cdot g(\\sigma_{i,t})" />
          <MathBlock label="Normalised weight" latex="\\hat{m}_{i,t} = \\frac{m_{i,t}}{\\sum_j m_{j,t}}" />
          <MathBlock label="Aggregate forecast" latex="\\hat{r}_t = \\sum_i \\hat{m}_{i,t} r_{i,t}" />
          <p className="text-xs text-slate-500">
            Stake enters via the deposit b. Skill enters via σ (from the online update). Weights are capped by ω_max for concentration control.
          </p>
        </div>
      )}

      {subtab === 'scoring' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            The scoring rule determines how well each report is rewarded; proper scoring encourages truthful reporting.
          </p>
          <MathBlock accent label="Point score" latex="s_{i,t} = 1 - |y_t - r_{i,t}|" />
          <p className="text-xs text-slate-500">
            For full distributions we use CRPS. Individual scores feed into settlement and into loss for the skill update.
          </p>
          <p className="text-xs text-slate-600">
            <strong>Why it matters:</strong> Proper scoring aligns incentives with forecast accuracy and drives the skill signal.
          </p>
        </div>
      )}

      {subtab === 'settlement' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Payoff splits into a <strong>skill component</strong> (zero-sum redistribution) and optional <strong>utility component</strong>. Client improvement is the gain from using the aggregate forecast.
          </p>
          <MathBlock accent label="Skill payoff (Lambert pool)" latex="\\Pi_{i,t} = m_{i,t} (1 + s_{i,t} - \\bar{s}_t)" />
          <MathBlock label="Profit" latex="\\pi_{i,t} = \\Pi_{i,t} - m_{i,t}" />
          <p className="text-xs text-slate-500">
            Settlement is budget-balanced. Refund (deposit minus effective wager) is returned regardless of outcome.
          </p>
        </div>
      )}

      {subtab === 'online_update' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            Losses from the scoring rule update skill weights for the next round. Learning rate, forgetting, and exploration (if present) control how fast σ adapts.
          </p>
          <MathBlock accent label="EWMA loss" latex="L_{i,t} = (1-\\rho) L_{i,t-1} + \\rho \\cdot \\ell_{i,t}" />
          <p className="text-xs text-slate-500 mt-1">
            <strong>Absent agents:</strong> If κ &gt; 0, loss decays toward L₀: L = (1−κ)L + κL₀. If κ = 0, loss freezes (L unchanged).
          </p>
          <MathBlock label="Loss to skill" latex="\\sigma_{i,t+1} = \\sigma_{\\min} + (1 - \\sigma_{\\min}) e^{-\\gamma L_{i,t}}" />
          <p className="text-xs text-slate-500">
            <strong>State propagated to t+1:</strong> <MathBlock inline latex="L_{i,t}" />, <MathBlock inline latex="\\sigma_{i,t+1}" />, wealth <MathBlock inline latex="W_{i,t+1}" />. Missing agents may use freeze or decay toward L_0.
          </p>
        </div>
      )}
    </div>
  );
}
