import { useMemo } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
  ReferenceArea, ReferenceLine,
} from 'recharts';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import MetricDisplay from '@/components/dashboard/MetricDisplay';
import {
  CHART_MARGIN_LABELED, GRID_PROPS, AXIS_TICK, AXIS_STROKE, AXIS_LABEL_FILL, REF_LINE_STROKE, REF_BAND_FILL,
  fmt, downsample,
} from '@/components/lab/shared';
import { PALETTE } from '@/lib/palette';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import { useChartZoom } from '@/hooks/useChartZoom';
import ZoomBadge from '@/components/charts/ZoomBadge';
import MechanismResponseCard from '@/components/behaviour/MechanismResponseCard';
import { useMechanismMetrics } from '@/hooks/useMechanismMetrics';
import { compare } from '@/hooks/useBehaviourSimulations';
import { SEED, N, T, VERDICT_VARIANT, PLACEHOLDER_DESCRIPTIONS } from '@/lib/behaviour/helpers';
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

export default function IdentityTab({ sybil, collusion, repReset, baseline }: {
  sybil: PipelineResult; collusion: PipelineResult;
  repReset: PipelineResult; baseline: PipelineResult;
}) {
  const sigZoom = useChartZoom();

  const collusionDelta = compare(collusion, baseline);

  const sybilPairWealth = sybil.finalState.slice(0, 2).reduce((a, s) => a + s.wealth, 0);
  const baselinePairWealth = baseline.finalState.slice(0, 2).reduce((a, s) => a + s.wealth, 0);
  const sybilRatio = baselinePairWealth > 0 ? sybilPairWealth / baselinePairWealth : 1;

  const sybilMetrics = useMechanismMetrics(sybil, baseline, 0);
  const collusionMetrics = useMechanismMetrics(collusion, baseline, 0);
  const repResetMetrics = useMechanismMetrics(repReset, baseline, 0, 100);

  // σ trajectory for reputation reset with phase transition at round 100
  const sigData = useMemo(() => {
    const len = Math.min(baseline.traces.length, repReset.traces.length);
    return downsample(Array.from({ length: len }, (_, i) => ({
      round: i + 1,
      baseline: baseline.traces[i].sigma_t[0],
      rep_reset: repReset.traces[i].sigma_t[0],
    })), 300);
  }, [baseline.traces, repReset.traces]);

  return (
    <div className="space-y-6">
      <PlaceholderBanner family="Identity" description={PLACEHOLDER_DESCRIPTIONS.Identity} />
      <PresetCallout presetIds={['sybil', 'collusion', 'reputation_reset']} />
      <p className="text-sm text-slate-600">
        Splitting into clones (sybil), coordinating with allies (collusion), or building skill then
        turning (reputation reset). The skill layer and deposit-splitting rules are the primary defences.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricDisplay label="Narrow sybil invariant?" value={sybilRatio <= 1.05 ? 'Yes' : 'No'}
          detail={`Clone pair ratio: ${fmt(sybilRatio, 3)}`}
          variant={VERDICT_VARIANT[sybilRatio <= 1.05 ? 'good' : 'bad']} />
        <MetricDisplay label="Collusion profitable?" value={collusionDelta.deltaPct > 3 ? 'Partially' : 'No'}
          detail={`Error ${collusionDelta.deltaPct >= 0 ? '+' : ''}${collusionDelta.deltaPct.toFixed(1)}% vs baseline`}
          variant={VERDICT_VARIANT[collusionDelta.deltaPct > 3 ? 'bad' : 'good']} />
        <MetricDisplay label="Rep. reset recovers?" value={repResetMetrics.skillRecoveryRounds != null ? 'Yes' : 'No'}
          detail={repResetMetrics.skillRecoveryRounds != null ? `σ < 0.5 in ${repResetMetrics.skillRecoveryRounds} rounds after attack` : 'σ never dropped below 0.5'}
          variant={VERDICT_VARIANT[repResetMetrics.skillRecoveryRounds != null ? 'good' : 'bad']} />
      </div>

      {/* Mechanism response cards */}
      <div className="grid lg:grid-cols-3 gap-4">
        <MechanismResponseCard metrics={sybilMetrics}
          attackVector="Split into 2 clones with shared deposit"
          defenceMechanism="Deposit splitting: each clone gets 1/k of total deposit, reducing its weight"
          effectiveness={sybilRatio <= 1.05 ? 95 : 60} />
        <MechanismResponseCard metrics={collusionMetrics}
          attackVector="2 agents coordinate reports and participation timing"
          defenceMechanism="EWMA skill tracking: coordinated mediocre reports earn mediocre σ"
          effectiveness={collusionDelta.deltaPct < 3 ? 90 : 50} />
        <MechanismResponseCard metrics={repResetMetrics}
          attackVector="Build a high skill estimate over 100 honest rounds, then manipulate"
          defenceMechanism="EWMA decay: σ drops within ~20 rounds of attack onset"
          effectiveness={repResetMetrics.skillRecoveryRounds != null && repResetMetrics.skillRecoveryRounds < 30 ? 85 : 40} />
      </div>

      {/* σ trajectory with phase transition marker */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-semibold text-slate-800">Reputation reset: σ trajectory</h3>
          <ZoomBadge isZoomed={sigZoom.state.isZoomed} onReset={sigZoom.reset} />
        </div>
        <p className="text-[14px] text-slate-500 mb-2">Agent 0 is honest for 100 rounds, then starts manipulating. Vertical line marks the phase transition.</p>
        <div className="cursor-crosshair">
          <ResponsiveContainer width="100%" height={360}>
            <LineChart data={sigData} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}
              onMouseDown={sigZoom.onMouseDown} onMouseMove={sigZoom.onMouseMove} onMouseUp={sigZoom.onMouseUp}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[sigZoom.state.left, sigZoom.state.right]} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]}
                label={{ value: 'σ (agent 0)', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: AXIS_LABEL_FILL }} />
              <Tooltip content={<SmartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 14 }} />
              <ReferenceLine x={100} stroke={PALETTE.coral} strokeDasharray="4 3" label={{ value: 'Attack onset', position: 'top', fontSize: 14, fill: PALETTE.coral }} />
              <Line type="monotone" dataKey="baseline" name="Honest baseline" stroke={REF_LINE_STROKE} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="rep_reset" name="Rep. reset attacker" stroke={PALETTE.coral} strokeWidth={2} dot={false} />
              {sigZoom.state.refLeft && sigZoom.state.refRight && (
                <ReferenceArea x1={sigZoom.state.refLeft} x2={sigZoom.state.refRight} fillOpacity={0.1} fill={REF_BAND_FILL} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[14px] text-amber-700 space-y-1">
        <div className="font-semibold text-amber-800">Taxonomy note: Dormancy and reactivation</div>
        <p>
          Forecasters who go silent then return are handled by the same EWMA freeze as bursty
          participation: σ is preserved during absence and resumes on return.
        </p>
      </div>
    </div>
  );
}
