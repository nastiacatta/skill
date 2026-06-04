import { useMemo, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, Bar,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine, Label, Brush, Cell,
} from 'recharts';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import { INITIAL_WEALTH } from '@/lib/coreMechanism/runPipeline';
import {
  AGENT_PALETTE, CHART_MARGIN, GRID_PROPS, AXIS_TICK, AXIS_STROKE, REF_LINE_STROKE,
  TOOLTIP_STYLE, agentName, fmt, downsample, movingAvg,
} from './shared';
import { PALETTE } from '@/lib/palette';

interface Props {
  pipeline: PipelineResult;
  selectedAgent: number | null;
  setSelectedAgent: (i: number | null) => void;
  onRoundClick?: (r: number) => void;
}

function Section({ title, question, children }: { title: string; question: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="mb-1">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        <p className="text-[11px] text-slate-400 mt-0.5 italic">{question}</p>
      </div>
      {children}
    </div>
  );
}

function SmartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string; dataKey: string }>; label?: number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE} className="max-w-xs">
      <div className="font-medium text-slate-700 text-[11px] mb-1">Round {label}</div>
      <div className="space-y-0.5 max-h-48 overflow-y-auto">
        {payload.filter(p => p.value != null && p.name !== '').map((p) => (
          <div key={p.dataKey} className="flex items-center gap-1.5 text-[11px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
            <span className="text-slate-500 truncate">{p.name}</span>
            <span className="font-mono font-medium text-slate-700 ml-auto">{fmt(p.value, 4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TimeSeriesPanel({ pipeline, selectedAgent, setSelectedAgent, onRoundClick }: Props) {
  const [, setBrushRange] = useState<{ startIndex: number; endIndex: number } | null>(null);
  const N = pipeline.traces[0]?.participated.length ?? 6;
  const T = pipeline.traces.length;

  const errorData = useMemo(() => {
    const errors = pipeline.rounds.map((r) => r.error);
    const ma = movingAvg(errors, Math.max(5, Math.floor(T / 20)));
    return downsample(
      pipeline.rounds.map((r, i) => ({
        round: r.round,
        error: r.error,
        ma: ma[i],
      })),
      400,
    );
  }, [pipeline.rounds, T]);

  const skillData = useMemo(() => {
    return downsample(
      pipeline.traces.map((t, i) => {
        const point: Record<string, number> = { round: i + 1 };
        for (let j = 0; j < N; j++) {
          point[`F${j + 1}`] = t.sigma_t[j];
        }
        return point;
      }),
      400,
    );
  }, [pipeline.traces, N]);

  const wealthData = useMemo(() => {
    return downsample(
      pipeline.traces.map((t, i) => {
        const point: Record<string, number> = { round: i + 1 };
        for (let j = 0; j < N; j++) {
          point[`F${j + 1}`] = t.wealth_after[j];
        }
        return point;
      }),
      400,
    );
  }, [pipeline.traces, N]);

  const participationData = useMemo(() => {
    return downsample(
      pipeline.rounds.map((r) => ({
        round: r.round,
        active: r.participation,
        rate: r.participation / N,
      })),
      400,
    );
  }, [pipeline.rounds, N]);

  const concentrationData = useMemo(() => {
    return downsample(
      pipeline.rounds.map((r) => ({
        round: r.round,
        hhi: r.hhi,
        nEff: r.nEff,
        topShare: r.topShare,
      })),
      400,
    );
  }, [pipeline.rounds]);

  const cumulativeErrorData = useMemo(() => {
    const series = pipeline.rounds.reduce(
      (acc: { round: number; cumError: number }[], r, i) => {
        const prevSum = acc.length > 0 ? acc[acc.length - 1].cumError * i : 0;
        const cum = prevSum + r.error;
        acc.push({ round: r.round, cumError: cum / (i + 1) });
        return acc;
      },
      [],
    );
    return downsample(series, 400);
  }, [pipeline.rounds]);

  const meanError = pipeline.summary.meanError;

  return (
    <div className="space-y-5">
      {/* Agent selector */}
      <div
        className="flex items-center gap-1.5 flex-wrap p-3"
        style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 6 }}
      >
        <span
          className="mr-1"
          style={{ fontSize: 11.5, color: 'var(--ink-soft)', fontWeight: 500 }}
        >
          Highlight:
        </span>
        <button
          type="button"
          onClick={() => setSelectedAgent(null)}
          className="transition-colors"
          style={{
            fontSize: 11.5,
            fontWeight: selectedAgent == null ? 600 : 500,
            padding: '4px 10px',
            borderRadius: 999,
            background: selectedAgent == null ? 'var(--navy)' : 'var(--cream)',
            color:      selectedAgent == null ? '#fff' : 'var(--ink-soft)',
            border: '1px solid',
            borderColor: selectedAgent == null ? 'var(--navy)' : 'var(--border)',
          }}
        >
          All
        </button>
        {Array.from({ length: N }, (_, i) => {
          const color = AGENT_PALETTE[i % AGENT_PALETTE.length];
          const active = selectedAgent === i;
          return (
            <button
              key={i}
              type="button"
              onClick={() => setSelectedAgent(active ? null : i)}
              className="transition-colors flex items-center gap-1.5"
              style={{
                fontSize: 11.5,
                fontWeight: active ? 600 : 500,
                padding: '4px 10px',
                borderRadius: 999,
                background: active ? color : 'var(--cream)',
                color:      active ? '#fff' : 'var(--ink-soft)',
                border: '1px solid',
                borderColor: active ? color : 'var(--border)',
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: active ? '#fff' : color }}
              />
              {agentName(i)}
            </button>
          );
        })}
      </div>

      {/* Row 1: Error charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Forecast Error" question="How accurate is the aggregate forecast over time?">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={errorData} margin={CHART_MARGIN} onClick={(e) => e?.activeLabel && onRoundClick?.(Number(e.activeLabel) - 1)}>
              <defs>
                <linearGradient id="errorGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.coral} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={PALETTE.coral} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<SmartTooltip />} />
              <ReferenceLine y={meanError} stroke={REF_LINE_STROKE} strokeDasharray="4 4">
                <Label value={`μ = ${fmt(meanError, 4)}`} position="right" fill={REF_LINE_STROKE} fontSize={9} />
              </ReferenceLine>
              <Area type="monotone" dataKey="error" name="Per-round error" stroke={PALETTE.coral} fill="url(#errorGradient)" strokeWidth={1} dot={false} />
              <Line type="monotone" dataKey="ma" name="Moving avg" stroke={PALETTE.navy} strokeWidth={2} dot={false} strokeDasharray="0" />
              {errorData.length > 40 && (
                <Brush dataKey="round" height={24} stroke={PALETTE.border} fill={PALETTE.offWhite} travellerWidth={8}
                  onChange={(range) => setBrushRange(range as { startIndex: number; endIndex: number })} />
              )}
            </AreaChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Cumulative Mean Error" question="Is the forecast improving over time?">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={cumulativeErrorData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="cumErrorGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.teal} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={PALETTE.teal} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<SmartTooltip />} />
              <Area type="monotone" dataKey="cumError" name="Cumulative mean error" stroke={PALETTE.teal} fill="url(#cumErrorGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Row 2: Skill & Wealth trajectories */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Skill Trajectories" question="How does each agent's estimated skill evolve?">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={skillData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]} />
              <Tooltip content={<SmartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8, lineHeight: '16px', maxHeight: 36, overflow: 'hidden' }} iconSize={8} />
              <ReferenceLine y={pipeline.params.sigma_min} stroke={REF_LINE_STROKE} strokeDasharray="4 4">
                <Label value="σ_min" position="right" fill={REF_LINE_STROKE} fontSize={9} />
              </ReferenceLine>
              {Array.from({ length: N }, (_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`F${i + 1}`}
                  name={agentName(i)}
                  stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                  strokeWidth={selectedAgent == null ? 1.5 : selectedAgent === i ? 2.5 : 0.5}
                  strokeOpacity={selectedAgent == null ? 0.85 : selectedAgent === i ? 1 : 0.2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Wealth Evolution" question="Who accumulates wealth and who goes bankrupt?">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={wealthData} margin={CHART_MARGIN}>
              <defs>
                {AGENT_PALETTE.map((c, i) => (
                  <linearGradient key={i} id={`wGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.15} />
                    <stop offset="100%" stopColor={c} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<SmartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              <ReferenceLine y={INITIAL_WEALTH} stroke={REF_LINE_STROKE} strokeDasharray="4 4">
                <Label value="W₀" position="right" fill={REF_LINE_STROKE} fontSize={9} />
              </ReferenceLine>
              {Array.from({ length: N }, (_, i) => (
                <Line
                  key={i}
                  type="monotone"
                  dataKey={`F${i + 1}`}
                  name={agentName(i)}
                  stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                  strokeWidth={selectedAgent == null ? 1.5 : selectedAgent === i ? 2.5 : 0.5}
                  strokeOpacity={selectedAgent == null ? 0.85 : selectedAgent === i ? 1 : 0.2}
                  dot={false}
                  connectNulls
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </Section>
      </div>

      {/* Row 3: Participation & Concentration */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Section title="Participation" question="How many agents are active each round?">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={participationData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="participationGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.teal} stopOpacity={0.7} />
                  <stop offset="100%" stopColor={PALETTE.teal} stopOpacity={0.3} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, N]} />
              <Tooltip content={<SmartTooltip />} />
              <Bar dataKey="active" name="Active agents" fill="url(#participationGrad)" radius={[2, 2, 0, 0]} maxBarSize={8}>
                {participationData.map((d, i) => (
                  <Cell key={i} fill={d.rate >= 0.8 ? PALETTE.teal : d.rate >= 0.5 ? '#B45309' : PALETTE.coral} opacity={0.7} />
                ))}
              </Bar>
              <ReferenceLine y={N} stroke={REF_LINE_STROKE} strokeDasharray="4 4">
                <Label value="N" position="right" fill={REF_LINE_STROKE} fontSize={9} />
              </ReferenceLine>
            </ComposedChart>
          </ResponsiveContainer>
        </Section>

        <Section title="Market Concentration" question="Is weight distributed fairly or monopolised?">
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={concentrationData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="hhiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={PALETTE.purple} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={PALETTE.purple} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis yAxisId="hhi" tick={AXIS_TICK} stroke={AXIS_STROKE} orientation="left" domain={[0, 1]} />
              <YAxis yAxisId="neff" tick={AXIS_TICK} stroke={AXIS_STROKE} orientation="right" />
              <Tooltip content={<SmartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 10, paddingTop: 8 }} />
              <Area yAxisId="hhi" type="monotone" dataKey="hhi" name="HHI (left)" stroke={PALETTE.purple} fill="url(#hhiGrad)" strokeWidth={1.5} dot={false} />
              <Line yAxisId="neff" type="monotone" dataKey="nEff" name="N_eff (right)" stroke={PALETTE.teal} strokeWidth={2} dot={false} />
              <Line yAxisId="hhi" type="monotone" dataKey="topShare" name="Top share (left)" stroke="#B45309" strokeWidth={1.5} dot={false} strokeDasharray="4 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </Section>
      </div>
    </div>
  );
}
