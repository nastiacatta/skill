import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import ChartCard from '@/components/dashboard/ChartCard';
import MetricDisplay from '@/components/dashboard/MetricDisplay';
import {
  CHART_MARGIN_LABELED, GRID_PROPS, AXIS_TICK, AXIS_STROKE,
  fmt,
} from '@/components/lab/shared';
import { viridis, rgbToCSS } from '@/lib/colourScales';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import { SEED, N, T, VERDICT_VARIANT } from '@/lib/behaviour/helpers';
import type { SweepPoint } from '@/hooks/useBehaviourSimulations';

export default function SensitivityTab({ data }: { data: SweepPoint[] }) {
  const best = data.reduce((a, b) => a.error < b.error ? a : b);
  const worst = data.reduce((a, b) => a.error > b.error ? a : b);
  const range = worst.error - best.error;
  const relRange = best.error > 0 ? (range / best.error * 100) : 0;
  const notBrittle = relRange < 30;

  const lams = [...new Set(data.map(d => d.lam))].sort((a, b) => a - b);
  const sigs = [...new Set(data.map(d => d.sig))].sort((a, b) => a - b);
  // σ_min is an ordered variable — sample viridis to give a perceptually
  // uniform gradient from low to high σ_min.
  const sigColors = sigs.map((_, i, arr) => {
    const t = arr.length <= 1 ? 0.5 : i / (arr.length - 1);
    return rgbToCSS(viridis(t));
  });

  const barData = lams.map(lam => {
    const row: Record<string, number | string> = { lam: `λ=${lam}` };
    for (const sig of sigs) {
      const pt = data.find(d => d.lam === lam && d.sig === sig);
      if (pt) row[`σ=${sig}`] = pt.error;
    }
    return row;
  });

  return (
    <div className="space-y-6">
      <p className="text-sm text-slate-600">
        Sweeping the skill-gate floor λ and the minimum skill estimate σ_min. A stable mechanism
        should vary smoothly across these settings rather than flip between regimes. Companion to thesis §4.4.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricDisplay label="Brittle?" value={notBrittle ? 'No' : 'Yes'}
          detail={`Error varies ${relRange.toFixed(0)}% across ${data.length} configs`}
          variant={VERDICT_VARIANT[notBrittle ? 'good' : 'bad']} />
        <MetricDisplay label="Best" value={`λ=${best.lam}, σ=${best.sig}`} detail={`CRPS ${fmt(best.error, 4)}`} />
        <MetricDisplay label="Worst" value={`λ=${worst.lam}, σ=${worst.sig}`} detail={`CRPS ${fmt(worst.error, 4)}`} />
        <MetricDisplay label="Gini range" value={fmt(Math.max(...data.map(d => d.gini)) - Math.min(...data.map(d => d.gini)), 3)} />
      </div>

      <ChartCard title="Mean CRPS by λ and σ_min" subtitle={`${data.length} configs, ${T} rounds each. Lower is better.`} provenance={{ type: "demo", label: `In-browser demo, seed=${SEED}, N=${N}, T=${T}` }}>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={barData} margin={{ ...CHART_MARGIN_LABELED, bottom: 24 }}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="lam" tick={{ ...AXIS_TICK, fontSize: 14 }} stroke={AXIS_STROKE} />
            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
            <Tooltip content={<SmartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 14 }} />
            {sigs.map((sig, i) => (
              <Bar key={sig} dataKey={`σ=${sig}`} name={`σ_min=${sig}`}
                fill={sigColors[i % sigColors.length]} radius={[3, 3, 0, 0]} maxBarSize={20} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[14px] text-slate-500">
        Mean CRPS varies smoothly across configurations, with no cliff edges. The default
        (λ = 0.3, σ_min = 0.1) sits near the best observed point.
      </div>
    </div>
  );
}
