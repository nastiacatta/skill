import { useMemo, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { DEFAULT_BUILDER_SELECTIONS, type BuilderSelections } from '@/lib/coreMechanism/runRoundComposable';
import type { SimParams } from '@/lib/mechanismExplorer/types';

import RunBadge from '@/components/lab/RunBadge';
import ScenarioBuilder from '@/components/lab/ScenarioBuilder';
import RoundReplayPanel from '@/components/lab/RoundReplayPanel';
import TimeSeriesPanel from '@/components/lab/TimeSeriesPanel';
import ComparePanel from '@/components/lab/ComparePanel';
import ValidationPanel from '@/components/lab/ValidationPanel';

type TabId = 'replay' | 'timeseries' | 'compare' | 'validation';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'replay', label: 'Round replay', icon: '⊙' },
  { id: 'timeseries', label: 'Time series', icon: '◇' },
  { id: 'compare', label: 'Compare', icon: '⇌' },
  { id: 'validation', label: 'Validation', icon: '✓' },
];

function initialParams(rounds: number, nAgents: number): SimParams {
  return {
    T: rounds,
    N: nAgents,
    gamma: 1.5,
    lambda: 0.3,
    eta: 1.0,
    f: 0.4,
    U: 50,
  };
}

export default function LabPage() {
  const {
    selectedDGP, setSelectedDGP,
    selectedBehaviourPreset, setSelectedBehaviourPreset,
    rounds, setRounds,
    nAgents, setNAgents,
    seed, setSeed,
    selectedRound, setSelectedRound,
    setLastPipelineResult,
  } = useStore();

  const [builder, setBuilder] = useState<BuilderSelections>(DEFAULT_BUILDER_SELECTIONS);
  const [activeTab, setActiveTab] = useState<TabId>('replay');
  const [selectedAgent, setSelectedAgent] = useState<number | null>(null);
  const [simParams, setSimParams] = useState<SimParams>(() => initialParams(rounds, nAgents));
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  // framer-motion ignores prefers-reduced-motion unless told; settle instantly.
  const reduce = useReducedMotion();

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
  }, [selectedDGP, selectedBehaviourPreset, rounds, seed, nAgents, builder, simParams.gamma, simParams.lambda, simParams.eta, simParams.f, simParams.U]);

  useEffect(() => {
    setLastPipelineResult(pipeline);
    return () => setLastPipelineResult(null);
  }, [pipeline, setLastPipelineResult]);

  const currentRound = Math.max(0, Math.min(selectedRound, pipeline.traces.length - 1));

  const handleRoundClick = (r: number) => {
    setSelectedRound(r);
    setActiveTab('replay');
  };

  return (
    <div className="flex flex-col h-full bg-slate-50">
      {/* Top bar */}
      <header className="shrink-0 bg-white border-b border-slate-200 px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-slate-900 tracking-tight">Simulation lab</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Interactive sandbox for replay, time series, comparison, and validation views.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <RunBadge mode="live" seed={seed} rounds={pipeline.traces.length} agents={nAgents} />
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Appendix sections
              </span>
              <Link
                to="/appendix/figures"
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Figures
              </Link>
              <Link
                to="/appendix/diagnostics"
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Diagnostics
              </Link>
              <Link
                to="/appendix/experiments"
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Experiments
              </Link>
              <Link
                to="/summary"
                className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
              >
                Summary
              </Link>
            </div>
            <button
              type="button"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-medium hover:bg-slate-200 transition-colors"
            >
              {sidebarCollapsed ? 'Show controls' : 'Hide controls'}
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left panel: scenario builder */}
        <AnimatePresence initial={false}>
          {!sidebarCollapsed && (
            <motion.div
              initial={reduce ? false : { width: 0, opacity: 0 }}
              animate={{ width: 264, opacity: 1 }}
              exit={reduce ? { width: 0 } : { width: 0, opacity: 0 }}
              transition={reduce ? { duration: 0 } : { duration: 0.2 }}
              className="shrink-0 overflow-hidden"
            >
              <div className="h-full p-3 overflow-y-auto">
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
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Summary strip */}
          <div className="shrink-0 flex items-center gap-4 px-5 py-2.5 bg-white border-b border-slate-200 overflow-x-auto">
            <SummaryPill label="Mean error" value={pipeline.summary.meanError.toFixed(4)} color={pipeline.summary.meanError < 0.15 ? 'emerald' : 'red'} />
            <SummaryPill label="Gini" value={pipeline.summary.finalGini.toFixed(3)} color={pipeline.summary.finalGini < 0.3 ? 'emerald' : 'amber'} />
            <SummaryPill label="N_eff" value={pipeline.summary.meanNEff.toFixed(1)} color={pipeline.summary.meanNEff > 3 ? 'emerald' : 'amber'} />
            <SummaryPill label="Participation" value={`${(pipeline.summary.meanParticipation / nAgents * 100).toFixed(0)}%`} color="sky" />
            <SummaryPill label="Total distributed" value={pipeline.summary.finalDistributed.toFixed(1)} color="violet" />
          </div>

          {/* Tab bar */}
          <div className="shrink-0 flex gap-0.5 px-5 pt-3 pb-0 bg-white border-b border-slate-200">
            {TABS.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`
                  px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-all rounded-t-lg
                  ${activeTab === id
                    ? 'border-teal-600 text-teal-800 bg-slate-50'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50/50'
                  }
                `}
              >
                <span className="mr-1.5">{icon}</span>
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-5">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={reduce ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: -8 }}
                transition={reduce ? { duration: 0 } : { duration: 0.15 }}
              >
                {activeTab === 'replay' && (
                  <RoundReplayPanel
                    pipeline={pipeline}
                    currentRound={currentRound}
                    setCurrentRound={setSelectedRound}
                    selectedAgent={selectedAgent}
                    setSelectedAgent={setSelectedAgent}
                  />
                )}
                {activeTab === 'timeseries' && (
                  <TimeSeriesPanel
                    pipeline={pipeline}
                    selectedAgent={selectedAgent}
                    setSelectedAgent={setSelectedAgent}
                    onRoundClick={handleRoundClick}
                  />
                )}
                {activeTab === 'compare' && (
                  <ComparePanel
                    pipeline={pipeline}
                    dgp={selectedDGP}
                    seed={seed}
                    nAgents={nAgents}
                    rounds={rounds}
                  />
                )}
                {activeTab === 'validation' && (
                  <ValidationPanel pipeline={pipeline} />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    sky: 'bg-sky-50 text-sky-700 border-sky-200',
    violet: 'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[13px] font-medium shrink-0 ${colorMap[color] ?? colorMap.sky}`}>
      <span className="text-[13px] uppercase font-bold">{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
