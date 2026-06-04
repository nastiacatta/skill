import type { SimResult, RoundTrace } from '@/lib/mechanismExplorer/types';
import type { RibbonKey } from '@/lib/mechanismExplorer/types';
import { RIBBON_STEPS, STEP_DESC } from '@/lib/mechanismExplorer/blockDefs';
import { fmtNum } from '@/lib/formatters';

interface RoundInspectorTabProps {
  simData: SimResult | null;
  currentRound: number;
  setCurrentRound: (r: number) => void;
  ribbonStep: number;
  setRibbonStep: (i: number) => void;
  selectedForecaster: number | null;
  setSelectedForecaster: (i: number | null) => void;
}

function stepValue(rd: RoundTrace, key: RibbonKey, i: number): string | number {
  const v = key === 'aggregate' ? rd.aggregate?.q50 : (rd[key] as unknown[])?.[i];
  if (v === null || v === undefined) return '–';
  if (typeof v === 'number') return v;
  return '–';
}

export default function RoundInspectorTab({
  simData,
  currentRound,
  setCurrentRound,
  ribbonStep,
  setRibbonStep,
  selectedForecaster,
  setSelectedForecaster,
}: RoundInspectorTabProps) {
  if (!simData) {
    return (
      <p className="text-slate-500 text-sm text-center py-12">
        Run the simulation first (Mechanism builder → Run).
      </p>
    );
  }

  const rd = simData.rounds[currentRound];
  const N = simData.N;
  const step = RIBBON_STEPS[ribbonStep];
  const stepKey = step.key;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setCurrentRound(Math.max(0, currentRound - 1))}
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50"
        >
          ← Prev
        </button>
        <span className="font-medium text-slate-800">
          Round {currentRound + 1} / {simData.T}
        </span>
        <button
          type="button"
          onClick={() =>
            setCurrentRound(Math.min(simData.T - 1, currentRound + 1))
          }
          className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-sm hover:bg-slate-50"
        >
          Next →
        </button>
        <span className="text-slate-500 text-sm ml-auto">
          Outcome y = {rd.y_true.toFixed(3)}
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2">
        {RIBBON_STEPS.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setRibbonStep(i)}
            className={`
              shrink-0 py-1.5 px-2.5 rounded-full border text-[11px] transition-all
              flex flex-col items-center gap-0.5 whitespace-nowrap
              ${i === ribbonStep
                ? 'bg-teal-600 text-white border-teal-600'
                : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50'}
            `}
          >
            <span>{s.label}</span>
            <span className="font-mono text-[10px] opacity-80">{s.sym}</span>
          </button>
        ))}
      </div>

      <div className="text-[11.5px] text-slate-500 bg-slate-100 rounded-md py-2 px-2.5 mb-2.5 leading-snug">
        {STEP_DESC[stepKey] ?? ''}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-2 px-3 text-slate-500 font-medium">
                Forecaster
              </th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">
                Active
              </th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">
                Median q
              </th>
              {stepKey !== 'aggregate' && (
                <th className="text-right py-2 px-3 text-slate-500 font-medium">
                  {step.sym}
                </th>
              )}
              <th className="text-right py-2 px-3 text-slate-500 font-medium">
                Skill σ
              </th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">
                Weight w̃
              </th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">
                Profit π
              </th>
              <th className="text-right py-2 px-3 text-slate-500 font-medium">
                Wealth W
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: N }, (_, i) => {
              const active = rd.active[i];
              const stepVal = stepValue(rd, stepKey, i);
              const fmtStep =
                stepVal === '–'
                  ? '–'
                  : typeof stepVal === 'number'
                    ? stepVal.toFixed(3)
                    : String(stepVal);
              const weightPct = (rd.weights[i] / (Math.max(...rd.weights) || 1)) * 100;
              const hi = i === selectedForecaster;
              return (
                <tr
                  key={i}
                  onClick={() =>
                    setSelectedForecaster(selectedForecaster === i ? null : i)
                  }
                  className={
                    hi
                      ? 'border-b border-slate-100 bg-amber-50 cursor-pointer'
                      : 'border-b border-slate-100 hover:bg-slate-50 cursor-pointer'
                  }
                >
                  <td className="py-2 px-3 font-medium text-slate-700">
                    F{i + 1}
                  </td>
                  <td className="py-2 px-3 text-right">
                    {active ? '●' : '○'}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {rd.reports[i] != null ? rd.reports[i]!.toFixed(3) : '–'}
                  </td>
                  {stepKey !== 'aggregate' && (
                    <td className="py-2 px-3 text-right tabular-nums">
                      {fmtStep}
                    </td>
                  )}
                  <td className="py-2 px-3 text-right tabular-nums">
                    {rd.sigma[i].toFixed(3)}
                  </td>
                  <td className="py-2 px-3 min-w-[80px]">
                    <div className="relative flex items-center gap-1">
                      <div
                        className="absolute inset-0 flex items-center"
                        style={{ zIndex: 0 }}
                      >
                        <div
                          className="h-1.5 bg-teal-100 rounded-full max-w-[95%]"
                          style={{ width: `${weightPct}%` }}
                        />
                      </div>
                      <span className="relative z-10 tabular-nums">
                        {rd.weights[i].toFixed(3)}
                      </span>
                    </div>
                  </td>
                  <td
                    className={
                      rd.profits[i] >= 0
                        ? 'py-2 px-3 text-right tabular-nums font-medium text-teal-700'
                        : 'py-2 px-3 text-right tabular-nums font-medium text-red-600'
                    }
                  >
                    {rd.profits[i] >= 0 ? '+' : ''}
                    {fmtNum(rd.profits[i], 2)}
                  </td>
                  <td className="py-2 px-3 text-right tabular-nums">
                    {rd.wealth[i].toFixed(1)}
                  </td>
                </tr>
              );
            }).concat(
              stepKey === 'aggregate'
                ? [
                    <tr
                      key="agg"
                      className="bg-blue-50 border-t border-blue-100"
                    >
                      <td colSpan={2} className="py-2 px-3 font-medium text-slate-700">
                        Aggregate q̂
                      </td>
                      <td className="py-2 px-3 text-right font-medium tabular-nums">
                        {rd.aggregate.q50.toFixed(3)}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-500 text-[11px]">
                        [{rd.aggregate.q10.toFixed(2)}, {rd.aggregate.q90.toFixed(2)}]
                      </td>
                      <td colSpan={4} className="py-2 px-3" />
                    </tr>,
                  ]
                : []
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
