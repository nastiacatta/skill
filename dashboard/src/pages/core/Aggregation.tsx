import PageHeader from '@/components/dashboard/PageHeader';
import MathBlock from '@/components/dashboard/MathBlock';
import SectionLabel from '@/components/dashboard/SectionLabel';

export default function Aggregation() {
  return (
    <div className="p-6 max-w-4xl">
      <PageHeader
        title="Aggregation"
        description="The aggregate forecast is a single weighted combination of reports. Weights are normalised effective wagers. One aggregation view is shown by default, with alternatives behind a toggle."
      />

      <div className="space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-800 mb-2 flex items-center gap-2">
            <SectionLabel type="mechanism_computation" />
            Weight shares
          </h3>
          <MathBlock accent label="Normalised effective wagers" latex="\\hat{m}_{i,t} = \\frac{m_{i,t}}{\\sum_j m_{j,t}}" />
        </div>

        <div>
          <MathBlock label="Point forecast aggregation" latex="\\hat{r}_t = \\sum_i \\hat{m}_{i,t} \\, r_{i,t}" />
          <p className="text-xs text-slate-500 mt-2">
            For quantile mode: same weights applied per quantile, <MathBlock inline latex="\\hat{q}(\\tau) = \\sum_i \\hat{m}_i \\, q_i(\\tau)" />. Missing agents (<MathBlock inline latex="\\alpha_i = 1" />) have <MathBlock inline latex="m_i = 0" /> and do not contribute.
          </p>
        </div>
      </div>
    </div>
  );
}
