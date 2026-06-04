import PageHeader from '@/components/dashboard/PageHeader';
import MathBlock from '@/components/dashboard/MathBlock';
import SectionLabel from '@/components/dashboard/SectionLabel';

export default function EffectiveWager() {
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Effective wager"
        description="The core design choice: deposit b is gated by skill σ to yield effective wager m. The difference is refunded so the user never loses more than m."
      />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <SectionLabel type="mechanism_computation" />
            Effective wager
          </h3>
          <MathBlock accent label="Skill-gated wager" latex="m_{i,t} = b_{i,t} \\bigl( \\lambda + (1-\\lambda) \\sigma_{i,t}^\\eta \\bigr)" />
          <p className="text-xs text-slate-500 mt-2">
            With <MathBlock inline latex="\\eta = 1" /> (linear gate). For <MathBlock inline latex="\\eta > 1" /> the code uses <MathBlock inline latex="g(\\sigma) = \\lambda + (1-\\lambda) \\sigma^\\eta" /> so low-skill forecasters’ wagers shrink more sharply. <MathBlock inline latex="m/b \\in [\\lambda + (1-\\lambda)\\sigma_{\\min}^\\eta,\\, 1]" />.
          </p>
        </div>

        <div>
          <MathBlock label="Refund (user gets back the unconverted part)" latex="\\text{refund}_{i,t} = b_{i,t} - m_{i,t}" />
        </div>

        <div className="bg-blue-50/50 border border-blue-200 rounded-xl p-4">
          <p className="text-xs text-slate-700">
            <strong>Why it matters:</strong> The design never takes more than <MathBlock inline latex="m_i" /> from the pool for forecaster <MathBlock inline latex="i" />. The refund is returned regardless of outcome, so exposure is exactly <MathBlock inline latex="m_i" />. Skill <MathBlock inline latex="\\sigma_i" /> is fixed before reports in round <MathBlock inline latex="t" />, so there is no double-counting of current-round performance.
          </p>
        </div>
      </div>
    </div>
  );
}
