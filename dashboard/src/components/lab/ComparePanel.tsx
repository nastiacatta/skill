import { useMemo, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine, Legend,
  LineChart, Line, ComposedChart, Area,
} from 'recharts';
import { runPipeline, type PipelineResult } from '@/lib/coreMechanism/runPipeline';
import type { BuilderSelections } from '@/lib/coreMechanism/runRoundComposable';
import type { DGPId } from '@/lib/coreMechanism/dgpSimulator';
import type { BehaviourPresetId } from '@/lib/behaviour/scenarioSimulator';
import {
  CHART_MARGIN, GRID_PROPS, AXIS_TICK, AXIS_STROKE, REF_LINE_STROKE, TOOLTIP_STYLE, fmt, downsample, movingAvg,
} from './shared';
import { PALETTE } from '@/lib/palette';

interface Props {
  pipeline: PipelineResult;
  dgp: DGPId;
  seed: number;
  nAgents: number;
  rounds: number;
}

const COMPARISON_PRESETS: { id: string; label: string; desc: string; getOptions: () => { weighting?: 'uniform'; behaviourPreset: BehaviourPresetId; builder?: Partial<BuilderSelections> } }[] = [
  {
    id: 'equal_weight',
    label: 'Equal weighting',
    desc: 'Uniform weight, no skill or stake advantage',
    getOptions: () => ({ behaviourPreset: 'baseline', builder: { influenceRule: 'uniform' } }),
  },
  {
    id: 'stake_only',
    label: 'Stake-only',
    desc: 'Weight = deposit only, ignoring skill',
    getOptions: () => ({ behaviourPreset: 'baseline', builder: { influenceRule: 'deposit_only' } }),
  },
  {
    id: 'skill_only',
    label: 'Skill-only',
    desc: 'Weight = skill only, ignoring deposits',
    getOptions: () => ({ behaviourPreset: 'baseline', builder: { influenceRule: 'skill_only' } }),
  },
  {
    id: 'adversarial',
    label: 'Manipulator',
    desc: 'One strategic agent tries to bias the aggregate',
    getOptions: () => ({ behaviourPreset: 'manipulator' }),
  },
  {
    id: 'sybil',
    label: 'Sybil attack',
    desc: 'Identity-splitting with colluding clones',
    getOptions: () => ({ behaviourPreset: 'sybil' }),
  },
];

function SmartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="font-medium text-slate-700 text-[11px] mb-1">Round {label}</div>
      {payload.filter(p => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-1.5 text-[11px]">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="font-mono font-medium ml-auto">{fmt(p.value, 4)}</span>
        </div>
      ))}
    </div>
  );
}

interface MetricDelta {
  label: string;
  current: number;
  baseline: number;
  delta: number;
  deltaPct: number;
  better: boolean;
  unit?: string;
}

function DeltaCard({ m }: { m: MetricDelta }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{m.label}</div>
      <div className="flex items-end gap-2 mt-1">
        <span className="text-xl font-bold font-mono text-slate-800">{fmt(m.current, 4)}</span>
        <span
          className="text-sm font-mono font-medium"
          style={{ color: m.better ? PALETTE.teal : PALETTE.coral }}
        >
          {m.delta >= 0 ? '+' : ''}{fmt(m.delta, 4)}
        </span>
      </div>
      <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
        <span>vs baseline {fmt(m.baseline, 4)}</span>
        <span
          className="font-medium"
          style={{ color: m.better ? PALETTE.teal : PALETTE.coral }}
        >
          ({m.deltaPct >= 0 ? '+' : ''}{m.deltaPct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

export default function ComparePanel({ pipeline, dgp, seed, nAgents, rounds }: Props) {
  const [selectedPreset, setSelectedPreset] = useState<string>('equal_weight');

  const baselinePipeline = useMemo(() => {
    const preset = COMPARISON_PRESETS.find((p) => p.id === selectedPreset);
    if (!preset) return null;
    const opts = preset.getOptions();
    return runPipeline({
      dgpId: dgp,
      behaviourPreset: opts.behaviourPreset,
      rounds,
      seed,
      n: nAgents,
      builder: opts.builder,
    });
  }, [selectedPreset, dgp, seed, nAgents, rounds]);

  const deltas: MetricDelta[] = useMemo(() => {
    if (!baselinePipeline) return [];
    const c = pipeline.summary;
    const b = baselinePipeline.summary;
    return [
      {
        label: 'Mean Error',
        current: c.meanError,
        baseline: b.meanError,
        delta: c.meanError - b.meanError,
        deltaPct: b.meanError > 0 ? ((c.meanError - b.meanError) / b.meanError) * 100 : 0,
        better: c.meanError < b.meanError,
      },
      {
        label: 'Final Gini',
        current: c.finalGini,
        baseline: b.finalGini,
        delta: c.finalGini - b.finalGini,
        deltaPct: b.finalGini > 0 ? ((c.finalGini - b.finalGini) / b.finalGini) * 100 : 0,
        better: c.finalGini < b.finalGini,
      },
      {
        label: 'Mean N_eff',
        current: c.meanNEff,
        baseline: b.meanNEff,
        delta: c.meanNEff - b.meanNEff,
        deltaPct: b.meanNEff > 0 ? ((c.meanNEff - b.meanNEff) / b.meanNEff) * 100 : 0,
        better: c.meanNEff > b.meanNEff,
      },
      {
        label: 'Mean Participation',
        current: c.meanParticipation,
        baseline: b.meanParticipation,
        delta: c.meanParticipation - b.meanParticipation,
        deltaPct: b.meanParticipation > 0 ? ((c.meanParticipation - b.meanParticipation) / b.meanParticipation) * 100 : 0,
        better: c.meanParticipation >= b.meanParticipation,
      },
    ];
  }, [pipeline, baselinePipeline]);

  const pairedErrorData = useMemo(() => {
    if (!baselinePipeline) return [];
    const cErrors = pipeline.rounds.map((r) => r.error);
    const bErrors = baselinePipeline.rounds.map((r) => r.error);
    const cMa = movingAvg(cErrors, Math.max(5, Math.floor(cErrors.length / 20)));
    const bMa = movingAvg(bErrors, Math.max(5, Math.floor(bErrors.length / 20)));
    return downsample(
      pipeline.rounds.map((r, i) => ({
        round: r.round,
        current: cMa[i],
        baseline: bMa[i] ?? cMa[i],
        delta: (cMa[i] ?? 0) - (bMa[i] ?? 0),
      })),
      300,
    );
  }, [pipeline, baselinePipeline]);

  const deltaBarData = useMemo(() => {
    return deltas.map((d) => ({
      name: d.label,
      delta: d.deltaPct,
      better: d.better,
    }));
  }, [deltas]);

  return (
    <div className="space-y-5">
      {/* Comparison preset selector */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Compare current setup against:</h3>
        <div className="flex flex-wrap gap-2">
          {COMPARISON_PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setSelectedPreset(p.id)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                selectedPreset === p.id
                  ? 'text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
              style={selectedPreset === p.id ? { background: PALETTE.navy } : undefined}
              title={p.desc}
            >
              {p.label}
            </button>
          ))}
        </div>
        {COMPARISON_PRESETS.find(p => p.id === selectedPreset) && (
          <p className="text-[11px] text-slate-400 mt-2 italic">
            {COMPARISON_PRESETS.find(p => p.id === selectedPreset)!.desc}
          </p>
        )}
      </div>

      {/* Delta metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {deltas.map((d) => <DeltaCard key={d.label} m={d} />)}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-800">Error Comparison</h4>
          <p className="text-[11px] text-slate-400 mt-0.5 italic mb-3">Moving average of |y − r̂| over rounds</p>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={pairedErrorData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<SmartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              <Line type="monotone" dataKey="current" name="Current" stroke={PALETTE.navy} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="baseline" name="Baseline" stroke={REF_LINE_STROKE} strokeWidth={2} dot={false} strokeDasharray="6 3" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h4 className="text-sm font-semibold text-slate-800">Delta Over Time</h4>
          <p className="text-[11px] text-slate-400 mt-0.5 italic mb-3">Positive = current is worse, negative = current is better</p>
          <ResponsiveContainer width="100%" height={300}>
            <ComposedChart data={pairedErrorData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="deltaGradPos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.coral} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PALETTE.coral} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="deltaGradNeg" x1="0" y1="1" x2="0" y2="0">
                  <stop offset="0%" stopColor={PALETTE.teal} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={PALETTE.teal} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<SmartTooltip />} />
              <ReferenceLine y={0} stroke={REF_LINE_STROKE} strokeWidth={1.5} />
              <Area
                type="monotone"
                dataKey={(d: { delta: number }) => (d.delta >= 0 ? d.delta : 0)}
                name="Current worse"
                stroke="none"
                fill="url(#deltaGradPos)"
              />
              <Area
                type="monotone"
                dataKey={(d: { delta: number }) => (d.delta < 0 ? d.delta : 0)}
                name="Current better"
                stroke="none"
                fill="url(#deltaGradNeg)"
              />
              <Line type="monotone" dataKey="delta" name="Error delta" stroke={PALETTE.navy} strokeWidth={1.5} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-5 lg:col-span-2">
          <h4 className="text-sm font-semibold text-slate-800">Summary: Relative Change (%)</h4>
          <p className="text-[11px] text-slate-400 mt-0.5 italic mb-3">
            Percent change vs baseline — teal bars mean current setup is better
          </p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={deltaBarData} layout="vertical" margin={{ ...CHART_MARGIN, left: 100 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis type="number" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis type="category" dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE} width={90} />
              <Tooltip content={<SmartTooltip />} />
              <ReferenceLine x={0} stroke={REF_LINE_STROKE} strokeWidth={1.5} />
              <Bar dataKey="delta" name="% change" radius={[0, 4, 4, 0]} maxBarSize={24}>
                {deltaBarData.map((d, i) => (
                  <Cell key={i} fill={d.better ? PALETTE.teal : PALETTE.coral} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
