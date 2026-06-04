/**
 * Compact visual of the full pipeline: Inputs → DGP → Core → Behaviour → Results
 * Plus round evolution: state S_t → actions + outcome → state S_{t+1}
 */
export default function PipelineDiagram() {
  const stages = ['Inputs', 'DGP', 'Core', 'Behaviour', 'Results'];
  return (
    <section className="space-y-6">
      <h2 className="text-base font-semibold text-slate-800 border-b border-slate-200 pb-2">
        Pipeline flow
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {stages.map((label, i) => (
          <span key={label} className="flex items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2.5 py-1 font-medium text-slate-700">
              {label}
            </span>
            {i < stages.length - 1 && (
              <span className="text-slate-300 shrink-0">→</span>
            )}
          </span>
        ))}
      </div>
      <p className="text-xs text-slate-500">
        Inputs: experiment, round, seed, agents, forecast type. DGP: latent truth, signals, regime. Core: task, submission, effective wager, aggregation, scoring, settlement, online update. Behaviour: participation, belief, reporting, staking, missingness, identity. Results: forecast quality, payouts, robustness.
      </p>

      <h3 className="text-sm font-semibold text-slate-700 mt-6">
        Round evolution
      </h3>
      <div className="flex flex-wrap items-center gap-2 text-xs font-mono">
        <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600">
          S<sub>t</sub>
        </span>
        <span className="text-slate-400">→</span>
        <span className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-slate-600">
          actions + outcome
        </span>
        <span className="text-slate-400">→</span>
        <span className="rounded border border-slate-200 bg-white px-2 py-1 text-slate-600">
          S<sub>t+1</sub>
        </span>
      </div>
      <p className="text-xs text-slate-500">
        State S_t (wealth, skill σ, eligibility) plus agent actions (participation, report, wager) and realised outcome y_t produce the aggregate forecast r̂_t, payoffs, and updated state S_{'{t+1}'}.
      </p>
    </section>
  );
}
