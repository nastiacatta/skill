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
  CHART_MARGIN_LABELED, GRID_PROPS, AXIS_TICK, AXIS_STROKE,
  fmt, downsample,
} from '@/components/lab/shared';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import { useChartZoom } from '@/hooks/useChartZoom';
import ZoomBadge from '@/components/charts/ZoomBadge';
import { compare } from '@/hooks/useBehaviourSimulations';
import { SEED, N, T, VERDICT_VARIANT, cumulativeAverage } from '@/lib/behaviour/helpers';
import PresetCallout from '@/components/behaviour/PresetCallout';
import { PALETTE, ORANGE } from '@/lib/palette';

export default function InformationTab({ biased, miscalibrated, baseline }: {
  biased: PipelineResult; miscalibrated: PipelineResult; baseline: PipelineResult;
}) {
  const cumZoom = useChartZoom();
  const sigZoom = useChartZoom();

  const biasDelta = compare(biased, baseline);
  const miscalDelta = compare(miscalibrated, baseline);
  const biasHurts = biasDelta.deltaPct > 1;
  const miscalHurts = miscalDelta.deltaPct > 1;

  // Check if biased agent's σ drops below 0.5 within 50 rounds
  const biasedSigmaDropped = useMemo(() => {
    for (let i = 0; i < Math.min(50, biased.traces.length); i++) {
      if (biased.traces[i].sigma_t[0] < 0.5) return true;
    }
    return false;
  }, [biased.traces]);

  // Cumulative error: 3 lines
  const cumData = useMemo(() => cumulativeAverage({
    baseline: baseline.rounds,
    biased: biased.rounds,
    miscalibrated: miscalibrated.rounds,
  }), [baseline.rounds, biased.rounds, miscalibrated.rounds]);

  // σ trajectory for agent 0 across all three presets
  const sigData = useMemo(() => {
    const len = Math.min(baseline.traces.length, biased.traces.length, miscalibrated.traces.length);
    return downsample(Array.from({ length: len }, (_, i) => ({
      round: i + 1,
      baseline: baseline.traces[i].sigma_t[0],
      biased: biased.traces[i].sigma_t[0],
      miscalibrated: miscalibrated.traces[i].sigma_t[0],
    })), 300);
  }, [baseline.traces, biased.traces, miscalibrated.traces]);

  return (
    <div className="space-y-6">
      <PresetCallout presetIds={['biased', 'miscalibrated']} />
      <p className="text-sm text-slate-600">
        Biased forecasters shift the centre, miscalibrated ones misstate their own uncertainty. The
        skill layer should detect both and downweight them.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricDisplay label="Does bias hurt?" value={biasHurts ? 'Yes' : 'Minimal'}
          detail={`Error ${biasDelta.deltaPct >= 0 ? '+' : ''}${biasDelta.deltaPct.toFixed(1)}% vs baseline`}
          variant={VERDICT_VARIANT[biasHurts ? 'bad' : 'good']} />
        <MetricDisplay label="Does miscalibration hurt?" value={miscalHurts ? 'Yes' : 'Minimal'}
          detail={`Error ${miscalDelta.deltaPct >= 0 ? '+' : ''}${miscalDelta.deltaPct.toFixed(1)}% vs baseline`}
          variant={VERDICT_VARIANT[miscalHurts ? 'bad' : 'good']} />
        <MetricDisplay label="Mean CRPS (biased)" value={fmt(biased.summary.meanError, 4)} />
        <MetricDisplay label="Mean CRPS (miscal.)" value={fmt(miscalibrated.summary.meanError, 4)} />
      </div>

      {!biasedSigmaDropped && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-[14px] text-red-700 flex items-center gap-2">
          <span className="text-red-500 text-base">⚠</span>
          The biased agent&apos;s skill estimate σ did not drop below 0.5 within the first 50 rounds. The skill layer is responding slowly to the bias.
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard title="Cumulative error comparison" subtitle="Biased vs miscalibrated vs baseline. Lower is better. Drag to zoom." provenance={{ type: "demo", label: `In-browser demo, seed=${SEED}, N=${N}, T=${T}` }}>
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={cumData} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}
              onMouseDown={cumZoom.onMouseDown} onMouseMove={cumZoom.onMouseMove} onMouseUp={cumZoom.onMouseUp}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[cumZoom.state.left, cumZoom.state.right]} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
                label={{ value: 'Cumulative CRPS', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: '#64748b' }} />
              <Tooltip content={<SmartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <Line type="monotone" dataKey="baseline" name="Baseline" stroke={PALETTE.slate} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="biased" name="Biased" stroke={PALETTE.navy} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="miscalibrated" name="Miscalibrated" stroke={ORANGE} strokeWidth={2} dot={false} />
              {cumZoom.state.refLeft && cumZoom.state.refRight && (
                <ReferenceArea x1={cumZoom.state.refLeft} x2={cumZoom.state.refRight} fillOpacity={0.1} fill={PALETTE.purple} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-800">σ trajectory (agent 0)</h3>
            <ZoomBadge isZoomed={sigZoom.state.isZoomed} onReset={sigZoom.reset} />
          </div>
          <p className="text-[14px] text-slate-500 mb-2">How quickly the skill layer detects and downweights biased/miscalibrated agents.</p>
          <div className="cursor-crosshair">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={sigData} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}
                onMouseDown={sigZoom.onMouseDown} onMouseMove={sigZoom.onMouseMove} onMouseUp={sigZoom.onMouseUp}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[sigZoom.state.left, sigZoom.state.right]} />
                <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]}
                  label={{ value: 'σ (agent 0)', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: '#64748b' }} />
                <Tooltip content={<SmartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 14 }} />
                <Line type="monotone" dataKey="baseline" name="Baseline" stroke={PALETTE.slate} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="biased" name="Biased" stroke={PALETTE.navy} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="miscalibrated" name="Miscalibrated" stroke={ORANGE} strokeWidth={2} dot={false} />
                {sigZoom.state.refLeft && sigZoom.state.refRight && (
                  <ReferenceArea x1={sigZoom.state.refLeft} x2={sigZoom.state.refRight} fillOpacity={0.1} fill={PALETTE.purple} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-700 space-y-2">
        <div className="font-semibold text-amber-800">Taxonomy note: Correlated errors and costly information</div>
        <p>
          Two patterns are not simulated here. <strong>Correlated errors</strong> (forecasters sharing a
          flawed source) lower effective diversity and erode the aggregation gain. <strong>Costly
          information</strong> lets wealthier forecasters afford both better signals and larger deposits,
          compounding their advantage.
        </p>
      </div>
    </div>
  );
}
