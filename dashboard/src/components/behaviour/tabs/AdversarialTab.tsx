import { useMemo } from 'react';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
  ReferenceArea,
} from 'recharts';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import ChartCard from '@/components/dashboard/ChartCard';
import MetricDisplay from '@/components/dashboard/MetricDisplay';
import {
  CHART_MARGIN_LABELED, GRID_PROPS, AXIS_TICK, AXIS_STROKE, AXIS_LABEL_FILL, REF_LINE_STROKE, REF_BAND_FILL,
  fmt, downsample,
} from '@/components/lab/shared';
import { PALETTE } from '@/lib/palette';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import { useChartZoom } from '@/hooks/useChartZoom';
import ZoomBadge from '@/components/charts/ZoomBadge';
import MathBlock from '@/components/dashboard/MathBlock';
import MechanismResponseCard from '@/components/behaviour/MechanismResponseCard';
import AdversaryCatalogue from '@/components/behaviour/AdversaryCatalogue';
import { useMechanismMetrics } from '@/hooks/useMechanismMetrics';
import { compare } from '@/hooks/useBehaviourSimulations';
import { SEED, N, T, VERDICT_VARIANT } from '@/lib/behaviour/helpers';
import PresetCallout from '@/components/behaviour/PresetCallout';
import { Card } from '@/components/platform/ui';

export default function AdversarialTab({ manipulator, arbitrageur, sybil, collusion, repReset, evader, baseline }: {
  manipulator: PipelineResult; arbitrageur: PipelineResult; sybil: PipelineResult;
  collusion: PipelineResult; repReset: PipelineResult; evader: PipelineResult; baseline: PipelineResult;
}) {
  const sigDecayZoom = useChartZoom();

  const W0 = 20;
  const manipProfit = manipulator.finalState[0].wealth - W0;
  const baseProfit0 = baseline.finalState[0].wealth - W0;
  const arbIdx = arbitrageur.finalState.length - 1;
  const arbProfit = arbitrageur.finalState[arbIdx].wealth - W0;
  const arbBaseline = baseline.finalState[arbIdx].wealth - W0;
  const sybilProfit = sybil.finalState.slice(0, 2).reduce((a, s) => a + s.wealth, 0);
  const baselinePairProfit = baseline.finalState.slice(0, 2).reduce((a, s) => a + s.wealth, 0);
  const sybilRatio = baselinePairProfit > 0 ? sybilProfit / baselinePairProfit : 1;

  // Attack-family colours — baseline uses the neutral slate, attacks draw from the
  // palette's coral/orange/imperial/purple/navy range so each attack is distinct
  // while staying in the same colour system as the rest of the dashboard.
  const attacks = [
    { name: 'Baseline',    error: baseline.summary.meanError,    gini: baseline.summary.finalGini,    color: PALETTE.slate },
    { name: 'Manipulator', error: manipulator.summary.meanError, gini: manipulator.summary.finalGini, color: PALETTE.coral },
    { name: 'Arbitrageur', error: arbitrageur.summary.meanError, gini: arbitrageur.summary.finalGini, color: '#B45309' }, // amber
    { name: 'Sybil',       error: sybil.summary.meanError,       gini: sybil.summary.finalGini,       color: '#E67E22' }, // orange
    { name: 'Collusion',   error: collusion.summary.meanError,   gini: collusion.summary.finalGini,   color: PALETTE.purple },
    { name: 'Rep. reset',  error: repReset.summary.meanError,    gini: repReset.summary.finalGini,    color: PALETTE.imperial },
    { name: 'Evader',      error: evader.summary.meanError,      gini: evader.summary.finalGini,      color: PALETTE.navy },
  ];

  const sigmaTraces = useMemo(() => downsample(
    Array.from({ length: Math.min(manipulator.traces.length, repReset.traces.length, baseline.traces.length) }, (_, i) => ({
      round: i + 1,
      honest: baseline.traces[i].sigma_t[0],
      manipulator: manipulator.traces[i].sigma_t[0],
      rep_reset: repReset.traces[i].sigma_t[0],
      evader: evader.traces[i]?.sigma_t[0] ?? 0,
    })), 300),
  [manipulator.traces, repReset.traces, baseline.traces, evader.traces]);

  // Mechanism response metrics for each attack
  const manipMetrics = useMechanismMetrics(manipulator, baseline, 0);
  const arbMetrics = useMechanismMetrics(arbitrageur, baseline, arbIdx);
  const evaderMetrics = useMechanismMetrics(evader, baseline, 0);
  const evaderDelta = compare(evader, baseline);

  return (
    <div className="space-y-6">
      <PresetCallout
        presetIds={['manipulator', 'arbitrageur', 'sybil', 'collusion', 'reputation_reset', 'evader']}
      />
      <p className="text-sm text-slate-600">
        Six attack types, each optimised against the mechanism's rules.
      </p>
      <MathBlock accent label="Payoff" latex="\\Pi_i = m_i\\left(1 + s(r_i, \\omega) - \\frac{\\sum_j m_j\\, s(r_j, \\omega)}{\\sum_j m_j}\\right)" />
      <p className="text-sm text-slate-600">
        The arbitrageur exploits the Chen (2014) arbitrage interval by reporting the mean of others.
      </p>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricDisplay label="Manipulation profitable?" value={manipProfit > baseProfit0 + 0.5 ? 'Yes' : 'No'}
          detail={`F1: ${fmt(manipProfit, 2)} vs ${fmt(baseProfit0, 2)} honest`}
          variant={VERDICT_VARIANT[manipProfit > baseProfit0 + 0.5 ? 'bad' : 'good']} />
        <MetricDisplay label="Arbitrage profitable?" value={arbProfit > arbBaseline + 0.5 ? 'Yes' : 'No'}
          detail={`F6: ${fmt(arbProfit, 2)} vs ${fmt(arbBaseline, 2)} honest`}
          variant={VERDICT_VARIANT[arbProfit > arbBaseline + 0.5 ? 'bad' : 'good']} />
        <MetricDisplay label="Narrow sybil invariant?" value={sybilRatio <= 1.05 ? 'Yes' : 'No'}
          detail={`Clone pair ratio: ${fmt(sybilRatio, 3)}`}
          variant={VERDICT_VARIANT[sybilRatio <= 1.05 ? 'good' : 'bad']} />
      </div>

      {/* Attack comparison table */}
      <Card padding="roomy" elevation="raised">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Attack impact comparison</h3>
        <p className="text-[14px] text-slate-500 mb-3">
          Each attack runs on the same draws and seed. Only the attacker's behaviour changes.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-[14px]">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-2 pr-3 text-slate-400 font-medium">Attack</th>
                <th className="text-right py-2 px-2 text-slate-400 font-medium">Mean CRPS</th>
                <th className="text-right py-2 px-2 text-slate-400 font-medium">Δ vs base</th>
                <th className="text-right py-2 px-2 text-slate-400 font-medium">Gini</th>
                <th className="text-left py-2 px-2 text-slate-400 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {[
                { ...attacks[0], desc: 'All agents truthful' },
                { ...attacks[1], desc: 'F1 pushes aggregate toward 0.5' },
                { ...attacks[2], desc: 'F6 reports mean of others (Chen arb.)' },
                { ...attacks[3], desc: 'F1–F2 clone with split deposit' },
                { ...attacks[4], desc: 'F1–F2 coordinate participation + reports' },
                { ...attacks[5], desc: 'F1 honest 100 rounds, then manipulates' },
                { ...attacks[6], desc: 'F1 adapts misreport to dispersion' },
              ].map((r, i) => {
                const delta = i === 0 ? 0 : (r.error - attacks[0].error) / attacks[0].error * 100;
                return (
                  <tr key={r.name} className="border-b border-slate-50">
                    <td className="py-2 pr-3 font-medium" style={{ color: r.color }}>{r.name}</td>
                    <td className="text-right py-2 px-2 font-mono">{fmt(r.error, 4)}</td>
                    <td
                      className="text-right py-2 px-2 font-mono"
                      style={{ color: delta > 1 ? PALETTE.coral : delta < -1 ? PALETTE.teal : PALETTE.slate }}
                    >
                      {i === 0 ? '-' : `${delta >= 0 ? '+' : ''}${delta.toFixed(1)}%`}
                    </td>
                    <td className="text-right py-2 px-2 font-mono">{fmt(r.gini, 3)}</td>
                    <td className="py-2 px-2 text-slate-500">{r.desc}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid lg:grid-cols-2 gap-3">
        <ChartCard title="Accuracy impact by attack" subtitle="Mean CRPS. Higher = worse aggregate." provenance={{ type: "demo", label: `In-browser demo, seed=${SEED}, N=${N}, T=${T}` }}>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={attacks} margin={{ ...CHART_MARGIN_LABELED, bottom: 32 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" tick={{ ...AXIS_TICK, fontSize: 14 }} stroke={AXIS_STROKE} angle={-20} textAnchor="end" />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<SmartTooltip />} />
              <Bar dataKey="error" name="Mean CRPS" radius={[4, 4, 0, 0]} maxBarSize={36}>
                {attacks.map(d => <Cell key={d.name} fill={d.color} opacity={0.85} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <Card padding="default" elevation="raised">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-semibold text-slate-800">Attacker σ decay</h3>
            <ZoomBadge isZoomed={sigDecayZoom.state.isZoomed} onReset={sigDecayZoom.reset} />
          </div>
          <p className="text-[14px] text-slate-500 mb-2">F1's skill estimate under different attacks. Misreporting erodes σ. Drag to zoom.</p>
          <div className="cursor-crosshair">
            <ResponsiveContainer width="100%" height={360}>
              <LineChart data={sigmaTraces} margin={{ ...CHART_MARGIN_LABELED, left: 52 }}
                onMouseDown={sigDecayZoom.onMouseDown} onMouseMove={sigDecayZoom.onMouseMove} onMouseUp={sigDecayZoom.onMouseUp}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[sigDecayZoom.state.left, sigDecayZoom.state.right]} />
                <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]}
                  label={{ value: 'σ (F1)', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: AXIS_LABEL_FILL }} />
                <Tooltip content={<SmartTooltip />} />
                <Legend wrapperStyle={{ fontSize: 14 }} />
                <Line type="monotone" dataKey="honest" name="Honest" stroke={REF_LINE_STROKE} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="manipulator" name="Manipulator" stroke={PALETTE.coral} strokeWidth={1.5} dot={false} />
                <Line type="monotone" dataKey="rep_reset" name="Rep. reset" stroke={PALETTE.imperial} strokeWidth={1.5} dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="evader" name="Evader" stroke={PALETTE.navy} strokeWidth={1.5} dot={false} />
                {sigDecayZoom.state.refLeft && sigDecayZoom.state.refRight && (
                  <ReferenceArea x1={sigDecayZoom.state.refLeft} x2={sigDecayZoom.state.refRight} fillOpacity={0.1} fill={REF_BAND_FILL} />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Mechanism response cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-slate-800">Mechanism response metrics</h3>
        <p className="text-[14px] text-slate-500">
          EWMA half-life: ln(2)/0.1 &asymp; 6.9 rounds. This determines how quickly the skill layer responds to behaviour changes.
        </p>
        <div className="grid lg:grid-cols-3 gap-4">
          <MechanismResponseCard metrics={manipMetrics}
            attackVector="Push aggregate toward 0.5 with inflated stake"
            defenceMechanism="EWMA skill decay: misreports raise L, lowering σ and the agent's weight"
            effectiveness={manipProfit <= baseProfit0 + 0.5 ? 90 : 40} />
          <MechanismResponseCard metrics={arbMetrics}
            attackVector="Report mean of others (Chen arbitrage interval)"
            defenceMechanism="Mediocre scores keep σ moderate, can't outperform best forecaster"
            effectiveness={arbProfit <= arbBaseline + 0.5 ? 85 : 35} />
          <MechanismResponseCard metrics={evaderMetrics}
            attackVector="Adapt misreport magnitude to dispersion (stealth evasion)"
            defenceMechanism="EWMA still detects persistent errors, stealth only slows detection"
            effectiveness={evaderDelta.deltaPct < 3 ? 80 : 45} />
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-[14px] text-slate-500">
        <p>
          The skill gate is the primary defence: misreporting raises the loss, lowers σ, and shrinks
          the effective wager. After the reputation-reset attacker turns, σ drops within roughly 20 rounds.
        </p>
      </div>

      <AdversaryCatalogue />
    </div>
  );
}
