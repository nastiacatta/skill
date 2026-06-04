import PageHeader from '@/components/dashboard/PageHeader';
import SectionLabel from '@/components/dashboard/SectionLabel';
import MathBlock from '@/components/dashboard/MathBlock';

const CHECKS = [
  { title: 'Budget balance', desc: 'Total payouts equal total effective wagers in the skill pool.', latex: '\\sum_i \\Pi_i = \\sum_i m_i' },
  { title: 'Zero-sum profit', desc: 'Profit redistributes within the skill component, summing to nil.', latex: '\\sum_i (\\Pi_i - m_i) = 0' },
  { title: 'Bounds on m/b', desc: 'The effective wager never exceeds the deposit, and the refund is never negative.', latex: 'm_i / b_i \\in [\\lambda, 1], \\quad b_i - m_i \\geq 0' },
  { title: 'Missing agents excluded', desc: 'An absent participant posts no report and takes no payoff.', latex: '\\alpha_i = 1 \\Rightarrow m_i = 0' },
  { title: 'Timing of σ', desc: 'Skill is fixed before reports in the round, so current performance is not double-counted.', latex: '\\sigma_{i,t} \\text{ fixed at start of round } t' },
];

export default function Invariants() {
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Invariants and safety checks"
        description="Concrete guarantees that make the skill × stake design disciplined rather than ad hoc."
      />

      <div className="flex items-center gap-2 mb-4">
        <SectionLabel type="mechanism_computation" />
        <span className="text-xs text-slate-500">All of the following hold by construction.</span>
      </div>

      <ul className="space-y-3">
        {CHECKS.map(({ title, desc }) => (
          <li key={title} className="flex gap-3 p-3 rounded-lg bg-white border border-slate-200">
            <span className="text-xs font-semibold text-slate-700 shrink-0 w-36">{title}</span>
            <span className="text-xs text-slate-600">{desc}</span>
          </li>
        ))}
      </ul>

      <details className="mt-4">
        <summary className="cursor-pointer select-none text-xs font-semibold text-slate-500 py-1">
          Show the algebra
        </summary>
        <ul className="space-y-2 mt-2">
          {CHECKS.map(({ title, latex }) => (
            <li key={title} className="flex items-center gap-3 p-2 rounded-lg bg-slate-50 border border-slate-200">
              <span className="text-[11px] font-semibold text-slate-500 shrink-0 w-36">{title}</span>
              <MathBlock inline latex={latex} />
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
