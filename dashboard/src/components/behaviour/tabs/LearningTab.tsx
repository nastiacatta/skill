import MathBlock from '@/components/dashboard/MathBlock';

export default function LearningTab() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Both sides can adapt. This tab separates the two kinds of learning at work in the system.
      </p>

      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-teal-500" />
            <h4 className="text-sm font-semibold text-slate-800">Mechanism-side learning</h4>
          </div>
          <p className="text-[14px] text-slate-600 leading-relaxed">
            The EWMA skill update is the mechanism's own learning rule. The rate ρ sets how fast it
            responds to recent performance.
          </p>
          <MathBlock accent label="Mechanism learning" latex="L_{i,t} = (1-\\rho)L_{i,t-1} + \\rho\\,\\ell_{i,t}" />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            <h4 className="text-sm font-semibold text-slate-800">Agent-side learning</h4>
          </div>
          <p className="text-[14px] text-slate-600 leading-relaxed">
            Forecasters who adjust strategy from past payoffs create a feedback loop, which requires
            modelling their optimisation rather than just their observable actions.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[14px] text-slate-600 leading-relaxed">
          The key question is whether the mechanism stays stable when forecasters learn to game it.
          Genuine improvement earns higher σ, strategic distortion earns lower σ, the same property
          that contains the adversarial attacks in other tabs. Full agent-side learning simulations
          are left as a separate research direction.
        </p>
      </div>
    </div>
  );
}
