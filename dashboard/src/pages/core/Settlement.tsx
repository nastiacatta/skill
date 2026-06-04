import PageHeader from '@/components/dashboard/PageHeader';
import MathBlock from '@/components/dashboard/MathBlock';
import SectionLabel from '@/components/dashboard/SectionLabel';

export default function Settlement() {
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Settlement and cashflow"
        description="Lambert self-financed weighted-score wagering: the skill pool is zero-sum, and profit is payoff minus effective wager."
      />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <SectionLabel type="mechanism_computation" />
            Skill payoff and profit
          </h3>
          <MathBlock accent label="Gross payoff (skill pool)" latex="\\Pi_{i,t} = m_{i,t} (1 + s_{i,t} - \\bar{s}_t)" />
          <p className="text-xs text-slate-500 mt-1"><MathBlock inline latex="\\bar{s}_t = \\frac{\\sum_j m_j s_j}{\\sum_j m_j}" /></p>
          <MathBlock label="Profit" className="mt-3" latex="\\pi_{i,t} = \\Pi_{i,t} - m_{i,t}" />
        </div>

        <div>
          <p className="text-xs text-slate-500">
            Flow: deposit → effective wager → settlement → refund plus payout. The skill pool is zero-sum, so profit redistributes within the participants.
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer select-none text-xs font-semibold text-slate-500 py-1">
              Show the cashflow bookkeeping
            </summary>
            <div className="mt-2">
              <MathBlock label="Cashflow (observed output)" latex="\\text{cashout}_{i,t} = \\text{refund}_{i,t} + \\hat{\\Pi}_{i,t}" />
              <p className="text-xs text-slate-500 mt-2">
                The cashout is the refund of the unconverted deposit plus the realised payout.
              </p>
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
