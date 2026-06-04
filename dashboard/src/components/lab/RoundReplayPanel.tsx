import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
  ComposedChart, Line,
} from 'recharts';
import type { PipelineResult } from '@/lib/coreMechanism/runPipeline';
import { INITIAL_WEALTH } from '@/lib/coreMechanism/runPipeline';
import type { RoundTrace } from '@/lib/coreMechanism/runRoundComposable';
import MechanismChain from './MechanismChain';
import { AGENT_PALETTE, CHART_MARGIN, GRID_PROPS, AXIS_TICK, AXIS_STROKE, REF_LINE_STROKE, TOOLTIP_STYLE, agentName, fmt } from './shared';
import { PALETTE, VERDICT_COLOURS } from '@/lib/palette';

interface Props {
  pipeline: PipelineResult;
  currentRound: number;
  setCurrentRound: (r: number) => void;
  selectedAgent: number | null;
  setSelectedAgent: (i: number | null) => void;
}

function ChartSection({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <div className="mb-3">
        <h4 className="text-sm font-semibold text-slate-800">{title}</h4>
        {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      <div className="font-medium text-slate-700 mb-1 text-xs">{label}</div>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-1.5 text-xs">
          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: p.color }} />
          <span className="text-slate-500">{p.name}</span>
          <span className="font-mono font-medium ml-auto">{fmt(p.value, 3)}</span>
        </div>
      ))}
    </div>
  );
}

export default function RoundReplayPanel({ pipeline, currentRound, setCurrentRound, selectedAgent, setSelectedAgent }: Props) {
  const trace: RoundTrace | null = pipeline.traces[currentRound] ?? null;
  const N = pipeline.params.builder ? pipeline.traces[0]?.participated.length ?? 6 : 6;
  const maxRound = pipeline.traces.length - 1;

  const agentBarData = useMemo(() => {
    if (!trace) return [];
    return Array.from({ length: N }, (_, i) => ({
      name: agentName(i),
      deposit: trace.deposits[i],
      effectiveWager: trace.effectiveWager[i],
      score: trace.scores[i],
      payoff: trace.profit[i],
      wealth: trace.wealth_after[i],
      active: trace.participated[i],
      idx: i,
    }));
  }, [trace, N]);

  const scoreBarData = useMemo(() => {
    if (!trace) return [];
    return Array.from({ length: N }, (_, i) => ({
      name: agentName(i),
      value: trace.scores[i],
      active: trace.participated[i],
      idx: i,
    }));
  }, [trace, N]);

  const payoffData = useMemo(() => {
    if (!trace) return [];
    return Array.from({ length: N }, (_, i) => ({
      name: agentName(i),
      payoff: trace.profit[i],
      active: trace.participated[i],
      idx: i,
    }));
  }, [trace, N]);

  const wealthData = useMemo(() => {
    if (!trace) return [];
    return Array.from({ length: N }, (_, i) => ({
      name: agentName(i),
      before: trace.wealth_before[i],
      after: trace.wealth_after[i],
      delta: trace.wealth_after[i] - trace.wealth_before[i],
      idx: i,
    }));
  }, [trace, N]);

  if (!trace) {
    return <div className="text-slate-400 text-center py-20">No trace data for this round.</div>;
  }

  return (
    <div className="space-y-5">
      {/* Round scrubber */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            onClick={() => setCurrentRound(Math.max(0, currentRound - 1))}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setCurrentRound(Math.min(maxRound, currentRound + 1))}
            className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-sm font-medium hover:bg-slate-200 transition-colors"
          >
            Next →
          </button>
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <span className="text-xs text-slate-500 shrink-0">Round</span>
            <input
              type="range"
              min={0}
              max={maxRound}
              value={currentRound}
              onChange={(e) => setCurrentRound(+e.target.value)}
              aria-label="Round"
              className="flex-1 accent-teal-600 h-1.5"
            />
            <span className="font-mono text-sm font-medium text-slate-700 tabular-nums w-20 text-right">
              {currentRound + 1} / {maxRound + 1}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Outcome y</div>
            <div className="text-base font-bold font-mono text-slate-800 mt-0.5">{fmt(trace.y, 4)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Forecast r̂</div>
            <div className="text-base font-bold font-mono text-teal-800 mt-0.5">{fmt(trace.r_hat, 4)}</div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Error |y − r̂|</div>
            <div
              className="text-base font-bold font-mono mt-0.5"
              style={{ color: Math.abs(trace.y - trace.r_hat) < 0.1 ? VERDICT_COLOURS.good.fg : VERDICT_COLOURS.bad.fg }}
            >
              {fmt(Math.abs(trace.y - trace.r_hat), 4)}
            </div>
          </div>
          <div className="bg-slate-50 rounded-lg p-2.5">
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400">Active</div>
            <div className="text-base font-bold font-mono text-slate-800 mt-0.5">
              {trace.activeCount} / {N}
            </div>
          </div>
        </div>
      </div>

      {/* Mechanism chain */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Mechanism state chain — Round {currentRound + 1}
        </h3>
        <MechanismChain trace={trace} selectedAgent={selectedAgent} onSelectAgent={setSelectedAgent} />
      </div>

      {/* Agent-level bar charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartSection title="Deposits & effective wager" subtitle="Deposit bᵢ (light) vs effective wager mᵢ (dark) per agent">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={agentBarData} margin={CHART_MARGIN}>
              <defs>
                {AGENT_PALETTE.map((c, i) => (
                  <linearGradient key={i} id={`depGrad${i}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={c} stopOpacity={0.8} />
                    <stop offset="100%" stopColor={c} stopOpacity={0.4} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="deposit" name="Deposit bᵢ" radius={[4, 4, 0, 0]} maxBarSize={32} opacity={0.4}>
                {agentBarData.map((d) => (
                  <Cell key={d.idx} fill={d.active ? AGENT_PALETTE[d.idx % AGENT_PALETTE.length] : PALETTE.border} />
                ))}
              </Bar>
              <Bar dataKey="effectiveWager" name="Wager mᵢ" radius={[4, 4, 0, 0]} maxBarSize={32}>
                {agentBarData.map((d) => (
                  <Cell key={d.idx} fill={d.active ? AGENT_PALETTE[d.idx % AGENT_PALETTE.length] : PALETTE.border} />
                ))}
              </Bar>
              <ReferenceLine y={0} stroke={AXIS_STROKE} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Score & Accuracy" subtitle="Per-agent score sᵢ = 1 − CRPS-hat(y, qᵢ)/2 (higher is better)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={scoreBarData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="value" name="Score sᵢ" radius={[6, 6, 0, 0]} maxBarSize={36}>
                {scoreBarData.map((d) => (
                  <Cell
                    key={d.idx}
                    fill={!d.active ? PALETTE.border : d.value > 0.8 ? PALETTE.teal : d.value > 0.5 ? '#B45309' : PALETTE.coral}
                  />
                ))}
              </Bar>
              <ReferenceLine y={trace.scores.reduce((a, b) => a + b, 0) / Math.max(1, trace.activeCount)} stroke={PALETTE.navy} strokeDasharray="3 3" label={{ value: 'avg', fill: PALETTE.navy, fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Round Payoff" subtitle="Profit πᵢ = payout − deposit (green = gain, red = loss)">
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={payoffData} margin={CHART_MARGIN}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<CustomTooltip />} />
              <ReferenceLine y={0} stroke={REF_LINE_STROKE} strokeWidth={1.5} />
              <Bar dataKey="payoff" name="Profit πᵢ" radius={[4, 4, 4, 4]} maxBarSize={36}>
                {payoffData.map((d) => (
                  <Cell key={d.idx} fill={d.payoff >= 0 ? PALETTE.teal : PALETTE.coral} opacity={d.active ? 1 : 0.3} />
                ))}
              </Bar>
              <Line dataKey="payoff" name="" stroke="transparent" dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </ChartSection>

        <ChartSection title="Wealth After Round" subtitle="Wᵢ′ = Wᵢ + πᵢ — persistent balance carried forward">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={wealthData} margin={CHART_MARGIN}>
              <defs>
                <linearGradient id="wealthGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PALETTE.navy} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={PALETTE.navy} stopOpacity={0.5} />
                </linearGradient>
              </defs>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="after" name="Wealth Wᵢ" radius={[6, 6, 0, 0]} maxBarSize={36} fill="url(#wealthGrad)" />
              <ReferenceLine y={INITIAL_WEALTH} stroke={REF_LINE_STROKE} strokeDasharray="3 3" label={{ value: 'initial', fill: REF_LINE_STROKE, fontSize: 9 }} />
            </BarChart>
          </ResponsiveContainer>
        </ChartSection>
      </div>
    </div>
  );
}
