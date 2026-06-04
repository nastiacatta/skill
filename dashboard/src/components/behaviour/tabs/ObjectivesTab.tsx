import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  ReferenceArea,
} from 'recharts';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import ChartCard from '@/components/dashboard/ChartCard';
import MetricDisplay from '@/components/dashboard/MetricDisplay';
import {
  CHART_MARGIN_LABELED, GRID_PROPS, AXIS_TICK, AXIS_STROKE, AXIS_LABEL_FILL, REF_LINE_STROKE, REF_BAND_FILL,
  fmt,
} from '@/components/lab/shared';
import { PALETTE } from '@/lib/palette';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import { useChartZoom } from '@/hooks/useChartZoom';
import { compare } from '@/hooks/useBehaviourSimulations';
import { SEED, N, T, VERDICT_VARIANT, PLACEHOLDER_DESCRIPTIONS, cumulativeAverage } from '@/lib/behaviour/helpers';
import PresetCallout from '@/components/behaviour/PresetCallout';

function PlaceholderBanner({ description }: { family: string; description: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 mb-4">
      <div className="flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span className="text-sm font-semibold text-slate-700">
          In-browser simulation
        </span>
      </div>
      <p className="text-[14px] text-slate-500 mt-2">
        {description} Results are from a lightweight in-browser simulation (seed={SEED}, N={N}, T={T}).
      </p>
    </div>
  );
}

export default function ObjectivesTab({ riskAverse, baseline }: {
  riskAverse: PipelineResult; baseline: PipelineResult;
}) {
  const cumZoom = useChartZoom();
  const raDelta = compare(riskAverse, baseline);

  const cumData = useMemo(() => cumulativeAverage({
    baseline: baseline.rounds,
    risk_averse: riskAverse.rounds,
  }), [baseline.rounds, riskAverse.rounds]);

  return (
    <div className="space-y-6">
      <PlaceholderBanner family="Objectives" description={PLACEHOLDER_DESCRIPTIONS.Objectives} />
      <PresetCallout presetIds={['risk_averse']} />
      <p className="text-sm text-slate-600">
        More risk-averse forecasters stake less and hedge toward the centre (CRRA γ = 2). The mechanism should
        tolerate this without breaking the aggregate. Companion to thesis §4.4.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricDisplay label="Risk aversion hurts?" value={Math.abs(raDelta.deltaPct) < 5 ? 'Minimal' : 'Yes'}
          detail={`Error ${raDelta.deltaPct >= 0 ? '+' : ''}${raDelta.deltaPct.toFixed(1)}% vs baseline`}
          variant={VERDICT_VARIANT[Math.abs(raDelta.deltaPct) < 5 ? 'good' : raDelta.deltaPct > 5 ? 'bad' : 'good']} />
        <MetricDisplay label="Mean CRPS (risk-averse)" value={fmt(riskAverse.summary.meanError, 4)} />
        <MetricDisplay label="Mean CRPS (baseline)" value={fmt(baseline.summary.meanError, 4)} />
        <MetricDisplay label="Gini (risk-averse)" value={fmt(riskAverse.summary.finalGini, 3)} detail={`vs ${fmt(baseline.summary.finalGini, 3)}`} />
      </div>

      <ChartCard title="Cumulative error: risk-averse vs baseline" subtitle="CRRA agents hedge and stake less. If lines track closely, the mechanism tolerates diverse objectives." provenance={{ type: "demo", label: `In-browser demo, seed=${SEED}, N=${N}, T=${T}` }}>
        <ResponsiveContainer width="100%" height={360}>
          <LineChart data={cumData} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}
            onMouseDown={cumZoom.onMouseDown} onMouseMove={cumZoom.onMouseMove} onMouseUp={cumZoom.onMouseUp}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[cumZoom.state.left, cumZoom.state.right]} />
            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
              label={{ value: 'Cumulative CRPS', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: AXIS_LABEL_FILL }} />
            <Tooltip content={<SmartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 14 }} />
            <Line type="monotone" dataKey="baseline" name="Baseline" stroke={REF_LINE_STROKE} strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="risk_averse" name="Risk-averse" stroke={PALETTE.purple} strokeWidth={2} dot={false} />
            {cumZoom.state.refLeft && cumZoom.state.refRight && (
              <ReferenceArea x1={cumZoom.state.refLeft} x2={cumZoom.state.refRight} fillOpacity={0.1} fill={REF_BAND_FILL} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-700 space-y-1">
        <div className="font-semibold text-amber-800">Taxonomy note: Loss aversion, signalling, leaderboard motives</div>
        <p>
          Loss aversion (Kahneman and Tversky 1979), signalling, and leaderboard motives are further
          objective functions in the taxonomy, not simulated here.
        </p>
      </div>
    </div>
  );
}
