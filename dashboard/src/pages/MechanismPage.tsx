import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  ReferenceLine, Label, ReferenceArea,
} from 'recharts';
import { useStore } from '@/lib/store';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { DEFAULT_BUILDER_SELECTIONS, type BuilderSelections } from '@/lib/coreMechanism/runRoundComposable';
import type { SimParams } from '@/lib/mechanismExplorer/types';
import { SEM } from '@/lib/tokens';
import InfoToggle from '@/components/dashboard/InfoToggle';
import SystemArchitecture from '@/components/mechanism/SystemArchitecture';
import ScenarioBuilder from '@/components/lab/ScenarioBuilder';
import RoundRibbon from '@/components/inspector/RoundRibbon';
import ValidationPanel from '@/components/lab/ValidationPanel';
import {
  AGENT_PALETTE, CHART_MARGIN_LABELED, GRID_PROPS, AXIS_TICK, AXIS_STROKE,
  TOOLTIP_STYLE, agentName, fmt, downsample, movingAvg,
} from '@/components/lab/shared';
import { SmartTooltip } from '@/components/dashboard/SmartTooltip';
import SmallMultiplesGrid from '@/components/charts/SmallMultiplesGrid';
import ChartCard from '@/components/dashboard/ChartCard';
import PageShell from '@/components/dashboard/PageShell';
import PageHeader from '@/components/dashboard/PageHeader';
import ThesisRef from '@/components/dashboard/ThesisRef';
import HowToRead from '@/components/dashboard/HowToRead';
import ShareLinkButton from '@/components/dashboard/ShareLinkButton';
import { ChartLinkingProvider } from '@/contexts/ChartLinkingContext';
import { useChartZoom } from '@/hooks/useChartZoom';
import ZoomBadge from '@/components/charts/ZoomBadge';
import { Card, SectionHeading } from '@/components/platform/ui';

const INVARIANTS = [
  { label: 'Budget balanced', desc: 'Total payouts equal total effective wagers.', color: SEM.payoff.main },
  { label: 'Cashflow identity', desc: 'Wealth change = profit = total payoff − effective wager. Cashout = refund + total payoff.', color: SEM.wealth.main },
  { label: 'Profit bounded', desc: 'For active agents, −mᵢ ≤ πᵢ ≤ mᵢ because scores and the weighted mean score lie in [0, 1].', color: SEM.wager.main },
  { label: 'Absent excluded', desc: 'Missing agents get mᵢ = 0, no payoff.', color: SEM.score.main },
];


// ZoomBadge imported from shared component

type ViewMode = 'timeline' | 'inspect' | 'validation';

export default function MechanismPage() {
  const {
    selectedDGP, setSelectedDGP,
    selectedBehaviourPreset, setSelectedBehaviourPreset,
    rounds, nAgents, seed, setSeed,
    setRounds, setNAgents,
    selectedRound, setSelectedRound,
    setLastPipelineResult,
  } = useStore();

  const [builder, setBuilder] = useState<BuilderSelections>(DEFAULT_BUILDER_SELECTIONS);
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [controlsOpen, setControlsOpen] = useState(false);
  // framer-motion ignores prefers-reduced-motion unless told; settle instantly.
  const reduce = useReducedMotion();
  const [viewMode, setViewMode] = useState<ViewMode>('timeline');
  const [chartDisplayMode, setChartDisplayMode] = useState<'overlapping' | 'grid'>('overlapping');

  const [simParams, setSimParams] = useState<SimParams>({
    T: rounds, N: nAgents, gamma: 1.5, lambda: 0.3, eta: 1.0, f: 0.4, U: 50,
  });

  const params: SimParams = useMemo(
    () => ({ ...simParams, T: rounds, N: nAgents }),
    [simParams, rounds, nAgents],
  );

  const setParams = (next: SimParams) => {
    if (next.T !== rounds) setRounds(next.T);
    if (next.N !== nAgents) setNAgents(next.N);
    setSimParams(next);
  };

  const pipeline = useMemo(() => {
    return runPipeline({
      dgpId: selectedDGP,
      behaviourPreset: selectedBehaviourPreset,
      rounds,
      seed,
      n: nAgents,
      builder,
      mechanism: {
        gamma: simParams.gamma,
        lam: simParams.lambda,
        eta: simParams.eta,
        baseDepositFraction: simParams.f,
        utilityPool: simParams.U,
      },
    });
  }, [selectedDGP, selectedBehaviourPreset, rounds, seed, nAgents, builder,
      simParams.gamma, simParams.lambda, simParams.eta, simParams.f, simParams.U]);

  // Single source of truth: store holds the current scenario result for the app
  useEffect(() => {
    setLastPipelineResult(pipeline);
    return () => setLastPipelineResult(null);
  }, [pipeline, setLastPipelineResult]);

  const currentRound = Math.max(0, Math.min(selectedRound, pipeline.traces.length - 1));
  const trace = pipeline.traces[currentRound] ?? null;
  const N = pipeline.traces[0]?.participated.length ?? 6;
  const T = pipeline.traces.length;
  const maxRound = T - 1;

  // Deep-link: read ?round= once on mount and restore it, clamped to the run.
  // The round changes rapidly while dragging, so it is NOT mirrored back to the
  // URL on every change. The "Link to this round" button writes it on click.
  const [searchParams, setSearchParams] = useSearchParams();
  const didReadRound = useRef(false);
  useEffect(() => {
    if (didReadRound.current) return;
    didReadRound.current = true;
    const raw = searchParams.get('round');
    if (raw == null) return;
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed)) {
      setSelectedRound(Math.max(0, Math.min(maxRound, parsed)));
    }
  }, [searchParams, maxRound, setSelectedRound]);

  // Write the current round into ?round= then hand the fresh URL to the copier.
  const writeRoundToUrl = useCallback((): string => {
    const params = new URLSearchParams(searchParams);
    params.set('round', String(currentRound));
    setSearchParams(params, { replace: true });
    if (typeof window === 'undefined') return '';
    const { origin, pathname, hash } = window.location;
    const base = hash.split('?')[0];
    return `${origin}${pathname}${base}?${params.toString()}`;
  }, [searchParams, setSearchParams, currentRound]);

  const errorZoom = useChartZoom();
  const skillZoom = useChartZoom();
  const wealthZoom = useChartZoom();

  const errorData = useMemo(() => {
    const errors = pipeline.rounds.map(r => r.error);
    const ma = movingAvg(errors, Math.max(5, Math.floor(T / 20)));
    return downsample(pipeline.rounds.map((r, i) => ({ round: r.round, error: r.error, ma: ma[i] })), 400);
  }, [pipeline.rounds, T]);

  const skillData = useMemo(() => {
    return downsample(pipeline.traces.map((t, i) => {
      const point: Record<string, number> = { round: i + 1 };
      for (let j = 0; j < N; j++) point[`F${j + 1}`] = t.sigma_t[j];
      return point;
    }), 400);
  }, [pipeline.traces, N]);

  const wealthData = useMemo(() => {
    return downsample(pipeline.traces.map((t, i) => {
      const point: Record<string, number> = { round: i + 1 };
      for (let j = 0; j < N; j++) point[`F${j + 1}`] = t.wealth_after[j];
      return point;
    }), 400);
  }, [pipeline.traces, N]);

  const handleChartClick = useCallback((e: { activeLabel?: string | number } | null) => {
    if (e?.activeLabel) {
      const r = Number(e.activeLabel) - 1;
      setSelectedRound(Math.max(0, Math.min(maxRound, r)));
    }
  }, [maxRound, setSelectedRound]);

  return (
    <PageShell width="wide">
        {/* ── Header ── */}
        <PageHeader
          hero
          eyebrow="Mechanism design"
          title="Mechanism design"
          companion={<ThesisRef viewKey="explainer" />}
          subtitle="An interactive sandbox: change parameters, step through rounds, and inspect per-forecaster state."
        />

        <HowToRead
          id="explainer-round"
          points={[
            'Drag the round slider to step through one run.',
            'Each round, forecasters submit quantile forecasts on the grid τ = (0.1, …, 0.9), the mechanism scores them with the pinball loss, then updates each skill weight.',
          ]}
          maths={
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: 14,
                lineHeight: 1.55,
                color: 'var(--ink-soft)',
                margin: 0,
              }}
            >
              The pinball loss is a per-quantile surrogate for CRPS, sensitive to both bias and sharpness.
            </p>
          }
        />

        <div className="mt-3">
          <ShareLinkButton onBeforeCopy={writeRoundToUrl} label="Link to this round" />
        </div>

        {/* ── Step 1: Understand the system ── */}
        <section className="space-y-5">
          <SectionHeading level={3} as={2} title="System architecture" />
          <div className="space-y-5 pb-4">
            <SystemArchitecture />

            <div className="flex flex-wrap gap-2">
              {INVARIANTS.map(({ label, color }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 px-3 py-1.5"
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    background: `${color}12`,
                    color: color,
                    border: `1px solid ${color}30`,
                    borderRadius: 999,
                  }}
                >
                  <span
                    className="flex items-center justify-center text-white"
                    style={{
                      width: 16, height: 16,
                      borderRadius: '50%',
                      background: color,
                      fontSize: 13, fontWeight: 700,
                    }}
                  >
                    ✓
                  </span>
                  {label}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* ── Step 2: Set inputs ── */}
        <section>
          <div className="mb-3">
            <SectionHeading level={3} title="Configuration" />
          </div>
          <div className="flex items-center gap-2 mb-4 flex-wrap pb-4">
            <button
              onClick={() => setControlsOpen(!controlsOpen)}
              className="transition-colors"
              style={{
                fontSize: 13.5,
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: 4,
                background: controlsOpen ? 'var(--navy)' : 'var(--cream)',
                color:      controlsOpen ? '#fff' : 'var(--ink-muted)',
                border: `1px solid ${controlsOpen ? 'var(--navy)' : 'var(--border)'}`,
              }}
            >
              {controlsOpen ? '✕ Hide inputs' : '⚙ Inputs'}
            </button>

            <div
              className="flex overflow-hidden ml-auto p-1"
              style={{
                background: 'var(--cream)',
                border: '1px solid var(--border)',
                borderRadius: 6,
              }}
            >
              {(['timeline', 'inspect', 'validation'] as ViewMode[]).map(mode => {
                const active = viewMode === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className="transition-colors"
                    style={{
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      padding: '5px 12px',
                      borderRadius: 4,
                      background: active ? 'var(--card)' : 'transparent',
                      color:      active ? 'var(--ink)' : 'var(--ink-soft)',
                      boxShadow:  active ? 'var(--shadow-sm)' : 'none',
                    }}
                  >
                    {mode === 'timeline' ? 'Timeline' : mode === 'inspect' ? 'Round detail' : 'Invariants'}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <div className="flex gap-4">
          {/* ── Controls sidebar ── */}
          <AnimatePresence initial={false}>
            {controlsOpen && (
              <motion.div
                initial={reduce ? false : { width: 0, opacity: 0 }}
                animate={{ width: 264, opacity: 1 }}
                exit={reduce ? { width: 0 } : { width: 0, opacity: 0 }}
                transition={reduce ? { duration: 0 } : { duration: 0.2 }}
                className="shrink-0 overflow-hidden"
              >
                <ScenarioBuilder
                  dgp={selectedDGP}
                  setDGP={setSelectedDGP}
                  builder={builder}
                  setBuilder={setBuilder}
                  behaviourPreset={selectedBehaviourPreset}
                  setBehaviourPreset={setSelectedBehaviourPreset}
                  params={params}
                  setParams={setParams}
                  seed={seed}
                  setSeed={setSeed}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Main content area ── */}
          <div className="flex-1 min-w-0 space-y-6">

            {/* ── Step 3: Pick a round ── */}
            <section>
            <Card padding="compact" className="sticky top-0 z-20 -mt-1">
              <div className="flex items-center gap-3 flex-wrap">
                <button type="button" onClick={() => setSelectedRound(Math.max(0, currentRound - 1))}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[14px] font-medium hover:bg-slate-200 transition-colors">
                  ←
                </button>
                <button type="button" onClick={() => setSelectedRound(Math.min(maxRound, currentRound + 1))}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[14px] font-medium hover:bg-slate-200 transition-colors">
                  →
                </button>
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <span className="text-[13px] font-semibold uppercase tracking-wider text-slate-400 shrink-0">Round</span>
                  <input
                    type="range"
                    min={0}
                    max={maxRound}
                    value={currentRound}
                    onChange={e => setSelectedRound(+e.target.value)}
                    aria-label="Select round"
                    className="flex-1 accent-indigo-600 h-1.5"
                  />
                  <span className="font-mono text-sm font-bold text-slate-700 tabular-nums w-20 text-right">
                    {currentRound + 1} / {maxRound + 1}
                  </span>
                </div>
              </div>

              {/* Key metrics for current round */}
              {trace && (
                <>
                <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-7 gap-2 mt-3">
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Outcome y</div>
                    <div className="text-sm font-bold font-mono text-slate-800">{fmt(trace.y, 4)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Forecast r̂</div>
                    <div className="text-sm font-bold font-mono" style={{ color: SEM.aggregate.main }}>{fmt(trace.r_hat, 4)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Error</div>
                    <div className={`text-sm font-bold font-mono ${Math.abs(trace.y - trace.r_hat) < 0.1 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {fmt(Math.abs(trace.y - trace.r_hat), 4)}
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Active</div>
                    <div className="text-sm font-bold font-mono text-slate-800">{trace.activeCount}/{N}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">N_eff</div>
                    <div className="text-sm font-bold font-mono text-slate-800">{fmt(trace.nEff, 2)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Top share</div>
                    <div className="text-sm font-bold font-mono text-slate-800">{fmt(trace.topShare, 3)}</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg px-2.5 py-1.5">
                    <div className="text-[13px] font-semibold uppercase tracking-wider text-slate-400">Deposited / paid / refund</div>
                    <div className="text-sm font-bold font-mono text-slate-800">
                      {fmt(trace.deposits.reduce((a, b) => a + b, 0), 1)} / {fmt(trace.totalPayoff.reduce((a, b) => a + Math.max(0, b), 0), 1)} / {fmt(trace.refunds.reduce((a, b) => a + b, 0), 1)}
                    </div>
                  </div>
                </div>
                <p className="mt-2 text-[14px] text-slate-500">
                  {trace.activeCount} participant{trace.activeCount !== 1 ? 's' : ''}, wager-share concentration {fmt(trace.topShare, 3)}.
                  {(() => {
                    const best = trace.totalPayoff.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v)[0];
                    return best && best.v > 0 ? ` Largest payoff to ${agentName(best.i)}.` : '';
                  })()}
                </p>
                </>
              )}
            </Card>
            </section>
            <section>
            {viewMode === 'timeline' && (
              <ChartLinkingProvider initialMethods={Array.from({ length: N }, (_, i) => `F${i + 1}`)}>
              <div className="space-y-4">
                {/* Agent selector */}
                <div
                  className="flex items-center gap-1.5 flex-wrap p-3"
                  style={{
                    background: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: 6,
                  }}
                >
                  <span
                    className="mr-1"
                    style={{ fontSize: 14, color: 'var(--ink-soft)', fontWeight: 500 }}
                  >
                    Highlight agent:
                  </span>
                  <button
                    onClick={() => setSelectedAgent(null)}
                    className="transition-colors"
                    style={{
                      fontSize: 14,
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
                        onClick={() => setSelectedAgent(active ? null : i)}
                        className="transition-colors flex items-center gap-1.5"
                        style={{
                          fontSize: 14,
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

                {/* Error chart */}
                <Card padding="compact">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="text-[15px] font-semibold text-slate-800">Forecast error</h4>
                    <InfoToggle
                      term="Forecast error"
                      definition="The distance between the realised outcome (y_t) and the aggregate forecast (r̂_t) in round t."
                      interpretation="e_t = 0 means the forecast hit the outcome exactly. Smaller is better."
                      latex="e_t = \\left| y_t - \\hat{r}_t \\right|"
                      axes={{ x: 'round', y: 'absolute error' }}
                    />
                    <span className="text-[13px] text-slate-400">Click a point to seek, drag to zoom.</span>
                    <ZoomBadge isZoomed={errorZoom.state.isZoomed} onReset={errorZoom.reset} />
                  </div>
                  <div className="cursor-crosshair" role="img" aria-label="Forecast error over rounds. Interactive chart.">
                  <ResponsiveContainer width="100%" height={360}>
                    <AreaChart
                      data={errorData}
                      margin={{ ...CHART_MARGIN_LABELED, right: 64 }}
                      onClick={handleChartClick}
                      onMouseDown={errorZoom.onMouseDown}
                      onMouseMove={errorZoom.onMouseMove}
                      onMouseUp={errorZoom.onMouseUp}
                    >
                      <defs>
                        <linearGradient id="errGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.01} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...GRID_PROPS} />
                      <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE}
                        domain={[errorZoom.state.left, errorZoom.state.right]}
                        label={{ value: 'Round', position: 'insideBottom', offset: -18, fontSize: 14, fill: '#64748b' }} />
                      <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
                        label={{ value: 'Error |y − r̂|', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: '#64748b' }} />
                      <Tooltip content={<SmartTooltip />} />
                      <ReferenceLine y={pipeline.summary.meanError} stroke="#94a3b8" strokeDasharray="4 4">
                        <Label value={`μ = ${fmt(pipeline.summary.meanError, 4)}`} position="right" fill="#94a3b8" fontSize={13} />
                      </ReferenceLine>
                      <ReferenceLine x={currentRound + 1} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" />
                      <Area type="monotone" dataKey="error" name="Per-round error" stroke="#ef4444" fill="url(#errGrad)" strokeWidth={1} dot={false} />
                      <Line type="monotone" dataKey="ma" name="Moving avg" stroke="#dc2626" strokeWidth={2} dot={false} />
                      {errorZoom.state.refLeft && errorZoom.state.refRight && (
                        <ReferenceArea x1={errorZoom.state.refLeft} x2={errorZoom.state.refRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.1} />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                  </div>
                </Card>

                {/* Skill + Wealth side by side */}
                <div className="flex items-center gap-2 mb-2">
                  <h4 className="text-[15px] font-semibold text-slate-800">Forecaster trajectories</h4>
                  <button
                    onClick={() => setChartDisplayMode(v => v === 'overlapping' ? 'grid' : 'overlapping')}
                    className={`px-3 py-1 rounded-lg text-[13px] font-medium transition-colors ${
                      chartDisplayMode === 'grid'
                        ? 'bg-indigo-100 text-indigo-700'
                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                    }`}
                  >
                    {chartDisplayMode === 'overlapping' ? 'Grid view' : 'Overlapping view'}
                  </button>
                </div>

                {chartDisplayMode === 'grid' ? (
                  <div className="space-y-4">
                    <SmallMultiplesGrid title="Skill trajectories (σ)" subtitle="One chart per forecaster">
                      {Array.from({ length: N }, (_, i) => (
                        <ChartCard key={`skill-${i}`} title={agentName(i)} provenance={{ type: 'demo', label: `In-browser demo, seed=${seed}, N=${nAgents}, T=${rounds}` }}>
                          <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={skillData} margin={{ top: 4, right: 8, bottom: 4, left: 36 }}>
                              <CartesianGrid {...GRID_PROPS} />
                              <XAxis dataKey="round" tick={{ ...AXIS_TICK, fontSize: 14 }} stroke={AXIS_STROKE} />
                              <YAxis tick={{ ...AXIS_TICK, fontSize: 14 }} stroke={AXIS_STROKE} domain={[0, 1]} />
                              <Tooltip content={<SmartTooltip />} />
                              <ReferenceLine y={pipeline.params.sigma_min} stroke="#94a3b8" strokeDasharray="4 4" />
                              <Line type="monotone" dataKey={`F${i + 1}`} name={agentName(i)}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                strokeWidth={2} dot={false} connectNulls />
                            </LineChart>
                          </ResponsiveContainer>
                        </ChartCard>
                      ))}
                    </SmallMultiplesGrid>

                    <SmallMultiplesGrid title="Wealth evolution" subtitle="One chart per forecaster">
                      {Array.from({ length: N }, (_, i) => (
                        <ChartCard key={`wealth-${i}`} title={agentName(i)} provenance={{ type: 'demo', label: `In-browser demo, seed=${seed}, N=${nAgents}, T=${rounds}` }}>
                          <ResponsiveContainer width="100%" height={240}>
                            <LineChart data={wealthData} margin={{ top: 4, right: 8, bottom: 4, left: 36 }}>
                              <CartesianGrid {...GRID_PROPS} />
                              <XAxis dataKey="round" tick={{ ...AXIS_TICK, fontSize: 14 }} stroke={AXIS_STROKE} />
                              <YAxis tick={{ ...AXIS_TICK, fontSize: 14 }} stroke={AXIS_STROKE} />
                              <Tooltip content={<SmartTooltip />} />
                              <ReferenceLine y={20} stroke="#94a3b8" strokeDasharray="4 4" />
                              <Line type="monotone" dataKey={`F${i + 1}`} name={agentName(i)}
                                stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                                strokeWidth={2} dot={false} connectNulls />
                            </LineChart>
                          </ResponsiveContainer>
                        </ChartCard>
                      ))}
                    </SmallMultiplesGrid>
                  </div>
                ) : (
                <div className="grid lg:grid-cols-2 gap-4">
                  <Card padding="compact">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-[15px] font-semibold text-slate-800">Skill trajectories (σ)</h4>
                      <InfoToggle
                        term="Skill trajectories (σ)"
                        definition="The mechanism's current online skill estimate of forecaster i's recent forecasting quality."
                        interpretation="Higher σ means that forecaster's skill gate g(σ) currently lifts more weight from the same deposit. It is learned over time, so it is not a fixed trait."
                        latex="\\sigma_{i,t} \\in [\\sigma_{\\min}, 1]"
                        axes={{ x: 'round', y: 'skill σ' }}
                      />
                      <ZoomBadge isZoomed={skillZoom.state.isZoomed} onReset={skillZoom.reset} />
                    </div>
                    <div className="cursor-crosshair" role="img" aria-label="Skill trajectories by forecaster. Interactive chart.">
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart
                        data={skillData}
                        margin={{ ...CHART_MARGIN_LABELED, right: 64 }}
                        onClick={handleChartClick}
                        onMouseDown={skillZoom.onMouseDown}
                        onMouseMove={skillZoom.onMouseMove}
                        onMouseUp={skillZoom.onMouseUp}
                      >
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE}
                          domain={[skillZoom.state.left, skillZoom.state.right]} />
                        <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE} domain={[0, 1]}
                          label={{ value: 'Skill σ', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: '#64748b' }} />
                        <Tooltip content={<SmartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                        <ReferenceLine y={pipeline.params.sigma_min} stroke="#94a3b8" strokeDasharray="4 4">
                          <Label value="σ_min" position="right" fill="#94a3b8" fontSize={13} />
                        </ReferenceLine>
                        <ReferenceLine x={currentRound + 1} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" />
                        {Array.from({ length: N }, (_, i) => (
                          <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={agentName(i)}
                            stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                            strokeWidth={selectedAgent == null ? 1.5 : selectedAgent === i ? 2.5 : 0.5}
                            strokeOpacity={selectedAgent == null ? 0.85 : selectedAgent === i ? 1 : 0.15}
                            dot={false} connectNulls />
                        ))}
                        {skillZoom.state.refLeft && skillZoom.state.refRight && (
                          <ReferenceArea x1={skillZoom.state.refLeft} x2={skillZoom.state.refRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.1} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card padding="compact">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="text-[15px] font-semibold text-slate-800">Wealth evolution</h4>
                      <InfoToggle
                        term="Wealth evolution"
                        definition="Agent i's bankroll after settlement at round t."
                        interpretation="Rising line means cumulative gains, falling line means cumulative losses."
                        latex="W_{i,t}"
                        axes={{ x: 'round', y: 'wealth' }}
                      />
                      <ZoomBadge isZoomed={wealthZoom.state.isZoomed} onReset={wealthZoom.reset} />
                    </div>
                    <div className="cursor-crosshair" role="img" aria-label="Wealth evolution by forecaster. Interactive chart.">
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart
                        data={wealthData}
                        margin={CHART_MARGIN_LABELED}
                        onClick={handleChartClick}
                        onMouseDown={wealthZoom.onMouseDown}
                        onMouseMove={wealthZoom.onMouseMove}
                        onMouseUp={wealthZoom.onMouseUp}
                      >
                        <CartesianGrid {...GRID_PROPS} />
                        <XAxis dataKey="round" tick={AXIS_TICK} stroke={AXIS_STROKE}
                          domain={[wealthZoom.state.left, wealthZoom.state.right]} />
                        <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
                          label={{ value: 'Wealth', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: '#64748b' }} />
                        <Tooltip content={<SmartTooltip />} />
                        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} />
                        <ReferenceLine y={20} stroke="#94a3b8" strokeDasharray="4 4">
                          <Label value="W₀" position="right" fill="#94a3b8" fontSize={13} />
                        </ReferenceLine>
                        <ReferenceLine x={currentRound + 1} stroke="#6366f1" strokeWidth={1.5} strokeDasharray="4 2" />
                        {Array.from({ length: N }, (_, i) => (
                          <Line key={i} type="monotone" dataKey={`F${i + 1}`} name={agentName(i)}
                            stroke={AGENT_PALETTE[i % AGENT_PALETTE.length]}
                            strokeWidth={selectedAgent == null ? 1.5 : selectedAgent === i ? 2.5 : 0.5}
                            strokeOpacity={selectedAgent == null ? 0.85 : selectedAgent === i ? 1 : 0.15}
                            dot={false} connectNulls />
                        ))}
                        {wealthZoom.state.refLeft && wealthZoom.state.refRight && (
                          <ReferenceArea x1={wealthZoom.state.refLeft} x2={wealthZoom.state.refRight} strokeOpacity={0.3} fill="#6366f1" fillOpacity={0.1} />
                        )}
                      </LineChart>
                    </ResponsiveContainer>
                    </div>
                  </Card>
                </div>
                )}
              </div>
              </ChartLinkingProvider>
            )}

            {/* ══ ROUND DETAIL VIEW ══ */}
            {viewMode === 'inspect' && trace && (
              <div className="space-y-4">
                <Card padding="default">
                  <h4 className="text-[13px] font-bold uppercase tracking-wider text-slate-400 mb-4">
                    Transformation ribbon: Round {currentRound + 1}
                  </h4>
                  <RoundRibbon
                    trace={trace}
                    selectedAgent={selectedAgent}
                    onSelectAgent={setSelectedAgent}
                  />
                </Card>

                <AgentBarCharts trace={trace} N={N} />
              </div>
            )}

            {viewMode === 'validation' && (
              <ValidationPanel pipeline={pipeline} />
            )}
            </section>
          </div>
        </div>
    </PageShell>
  );
}

/* ── Agent bar charts for round detail ── */

function AgentBarCharts({ trace, N }: {
  trace: { deposits: number[]; effectiveWager: number[]; scores: number[]; profit: number[]; wealth_after: number[]; wealth_before: number[]; participated: boolean[]; activeCount: number };
  N: number;
}) {
  const agentBarData = useMemo(() => Array.from({ length: N }, (_, i) => ({
    name: agentName(i), deposit: trace.deposits[i], effectiveWager: trace.effectiveWager[i],
    score: trace.scores[i], payoff: trace.profit[i], wealth: trace.wealth_after[i],
    active: trace.participated[i], idx: i,
  })), [trace, N]);

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <Card padding="compact">
        <div className="flex items-center gap-1.5 mb-1">
          <h4 className="text-[15px] font-semibold text-slate-800">Deposits vs effective wagers</h4>
          <InfoToggle
            term="Deposits vs effective wagers"
            definition="b_i is the posted deposit. m_i is the effective wager: the deposit rescaled by the past-only skill gate g(σ_i)."
            interpretation="If two forecasters deposit the same amount, the one with higher σ_i gets the higher effective wager."
            latex="m_i = b_i\\bigl(\\lambda + (1-\\lambda)\\sigma_i^{\\eta}\\bigr)"
            axes={{ x: 'forecaster', y: 'amount' }}
          />
        </div>
        <p className="text-[13px] text-slate-400 mb-2">Deposit b (light) vs effective wager m (dark). Hover for values.</p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={agentBarData} margin={CHART_MARGIN_LABELED}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE}
              label={{ value: 'Forecaster', position: 'insideBottom', offset: -18, fontSize: 14, fill: '#64748b' }} />
            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
              label={{ value: 'b / m', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: '#64748b' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="deposit" name="Deposit bᵢ" radius={[4, 4, 0, 0]} maxBarSize={28} opacity={0.4}>
              {agentBarData.map(d => <Cell key={d.idx} fill={d.active ? AGENT_PALETTE[d.idx % AGENT_PALETTE.length] : '#e2e8f0'} />)}
            </Bar>
            <Bar dataKey="effectiveWager" name="Wager mᵢ" radius={[4, 4, 0, 0]} maxBarSize={28}>
              {agentBarData.map(d => <Cell key={d.idx} fill={d.active ? AGENT_PALETTE[d.idx % AGENT_PALETTE.length] : '#e2e8f0'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card padding="compact">
        <div className="flex items-center gap-1.5 mb-1">
          <h4 className="text-[15px] font-semibold text-slate-800">Profit by forecaster</h4>
          <InfoToggle
            term="Profit by forecaster"
            definition="Total payoff minus effective wager."
            interpretation="Positive means the forecaster gained on that round, negative means a loss. Bounded by ±mᵢ."
            latex="\\pi_i = \\Pi^{\\mathrm{skill}}_i - m_i"
            axes={{ x: 'forecaster', y: 'profit' }}
          />
        </div>
        <p className="text-[13px] text-slate-400 mb-2">Profit π (green = gain, red = loss). Hover for values.</p>
        <ResponsiveContainer width="100%" height={360}>
          <BarChart data={agentBarData} margin={CHART_MARGIN_LABELED}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="name" tick={AXIS_TICK} stroke={AXIS_STROKE}
              label={{ value: 'Forecaster', position: 'insideBottom', offset: -18, fontSize: 14, fill: '#64748b' }} />
            <YAxis tick={AXIS_TICK} stroke={AXIS_STROKE}
              label={{ value: 'Profit π', angle: -90, position: 'insideLeft', offset: 8, fontSize: 14, fill: '#64748b' }} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Bar dataKey="payoff" name="Profit πᵢ" radius={[4, 4, 4, 4]} maxBarSize={28}>
              {agentBarData.map(d => (
                <Cell key={d.idx} fill={d.payoff >= 0 ? '#10b981' : '#ef4444'} opacity={d.active ? 1 : 0.3} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
