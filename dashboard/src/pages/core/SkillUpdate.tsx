import PageHeader from '@/components/dashboard/PageHeader';
import MathBlock from '@/components/dashboard/MathBlock';
import SectionLabel from '@/components/dashboard/SectionLabel';

export default function SkillUpdate() {
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Skill update"
        description="Post-round, loss is updated via EWMA and skill is a deterministic function of loss. Missingness and staleness handled separately (freeze or decay toward L0)."
      />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <SectionLabel type="mechanism_computation" />
            EWMA loss
          </h3>
          <MathBlock accent label="Loss update (present agents)" latex="L_{i,t} = (1 - \\rho) L_{i,t-1} + \\rho \\cdot \\ell_{i,t}" />
          <p className="text-xs text-slate-500 mt-2">
            <MathBlock inline latex="\\ell_{i,t}" /> is normalised loss (e.g. MAE or CRPS-hat/2). When κ &gt; 0 and agent is absent: L reverts toward L₀ (staleness).
          </p>
        </div>

        <div>
          <MathBlock label="Loss to skill (next round’s σ)" accent latex="\\sigma_{i,t+1} = \\sigma_{\\min} + (1 - \\sigma_{\\min}) \\, e^{-\\gamma L_{i,t}}" />
          <p className="text-xs text-slate-500 mt-2">
            Slow rise, fast drop; floor <MathBlock inline latex="\\sigma_{\\min}" />. This is the only skill update on the main page. Variants (e.g. different mappings) in appendix or secondary panel.
          </p>
        </div>
      </div>
    </div>
  );
}
