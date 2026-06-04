/**
 * Single app store: experiment, round, stage, view mode, and pipeline/walkthrough state.
 * One source of truth for the mechanism walkthrough and evidence pages.
 */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ExperimentMeta } from './types';
import type { DGPId } from './coreMechanism/dgpSimulator';
import type { WeightingMode } from './coreMechanism/runRound';
import type { BehaviourPresetId } from './behaviour/scenarioSimulator';
import type { ExplorerStageId, CoreSubtabId } from './thesis';
import { mockExperiments } from './mock-data';

export type PipelineResult = import('./coreMechanism/runPipeline').PipelineResult;

export interface StoreState {
  // Experiment list & selection
  experiments: ExperimentMeta[];
  selectedExperiment: ExperimentMeta | null;
  setSelectedExperiment: (e: ExperimentMeta | null) => void;
  blockFilter: 'all' | 'core' | 'behaviour' | 'experiments';
  setBlockFilter: (b: 'all' | 'core' | 'behaviour' | 'experiments') => void;
  dataMode: 'mock' | 'real';

  // Round (unified: same value as selectedRound for walkthrough)
  currentRound: number;
  setCurrentRound: (r: number | ((prev: number) => number)) => void;
  isPlaying: boolean;
  setIsPlaying: (p: boolean) => void;

  // Pipeline / walkthrough state
  selectedRound: number;
  setSelectedRound: (r: number | ((prev: number) => number)) => void;
  selectedDGP: DGPId;
  setSelectedDGP: (d: DGPId) => void;
  selectedAggregation: WeightingMode;
  setSelectedAggregation: (a: WeightingMode) => void;
  selectedScoringRule: 'MAE' | 'CRPS';
  setSelectedScoringRule: (r: 'MAE' | 'CRPS') => void;
  selectedWeightingMode: WeightingMode;
  setSelectedWeightingMode: (w: WeightingMode) => void;
  selectedBehaviourPreset: BehaviourPresetId;
  setSelectedBehaviourPreset: (p: BehaviourPresetId) => void;
  selectedBehaviourModuleOptions: Record<string, unknown>;
  setSelectedBehaviourModuleOptions: (o: Record<string, unknown>) => void;
  selectedCoreSubstep: CoreSubtabId;
  setSelectedCoreSubstep: (s: CoreSubtabId) => void;
  selectedStage: ExplorerStageId;
  setSelectedStage: (s: ExplorerStageId) => void;
  rounds: number;
  setRounds: (r: number) => void;
  nAgents: number;
  setNAgents: (n: number) => void;
  seed: number;
  setSeed: (s: number) => void;
  lastPipelineResult: PipelineResult | null;
  setLastPipelineResult: (r: PipelineResult | null) => void;
}

const DEFAULT_ROUND = 0;
const DEFAULT_DGP: DGPId = 'baseline';
const DEFAULT_WEIGHTING: WeightingMode = 'full';
const DEFAULT_PRESET: BehaviourPresetId = 'baseline';
const DEFAULT_STAGE: ExplorerStageId = 'inputs';
const DEFAULT_CORE_SUBSTEP: CoreSubtabId = 'task_setup';

const StoreContext = createContext<StoreState | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [experiments, setExperiments] = useState<ExperimentMeta[]>(mockExperiments);
  const [selectedExperiment, setSelectedExperiment] = useState<ExperimentMeta | null>(mockExperiments[0]);
  const [blockFilter, setBlockFilter] = useState<'all' | 'core' | 'behaviour' | 'experiments'>('all');
  const [dataMode, setDataMode] = useState<'mock' | 'real'>('mock');

  const [selectedRound, setSelectedRoundState] = useState(DEFAULT_ROUND);
  const setSelectedRound = useCallback((r: number | ((prev: number) => number)) => {
    setSelectedRoundState((prev) => (typeof r === 'function' ? r(prev) : r));
  }, []);
  const currentRound = selectedRound;
  const setCurrentRound = setSelectedRound;

  const [isPlaying, setIsPlaying] = useState(false);

  const [selectedDGP, setSelectedDGP] = useState<DGPId>(DEFAULT_DGP);
  const [selectedAggregation, setSelectedAggregation] = useState<WeightingMode>(DEFAULT_WEIGHTING);
  const [selectedScoringRule, setSelectedScoringRule] = useState<'MAE' | 'CRPS'>('MAE');
  const [selectedWeightingMode, setSelectedWeightingMode] = useState<WeightingMode>(DEFAULT_WEIGHTING);
  const [selectedBehaviourPreset, setSelectedBehaviourPreset] = useState<BehaviourPresetId>(DEFAULT_PRESET);
  const [selectedBehaviourModuleOptions, setSelectedBehaviourModuleOptions] = useState<Record<string, unknown>>({});
  const [selectedCoreSubstep, setSelectedCoreSubstep] = useState<CoreSubtabId>(DEFAULT_CORE_SUBSTEP);
  const [selectedStage, setSelectedStage] = useState<ExplorerStageId>(DEFAULT_STAGE);
  const [rounds, setRounds] = useState(500);
  const [nAgents, setNAgents] = useState(6);
  const [seed, setSeed] = useState(42);
  const [lastPipelineResult, setLastPipelineResult] = useState<PipelineResult | null>(null);

  useEffect(() => {
    // The real-data adapter pulls in the CSV parser (papaparse). It is only
    // needed after first paint (mock data shows first either way), so import
    // it dynamically to keep papaparse off the eager chunk. A cancelled guard
    // keeps StrictMode's dev double-invoke from racing the swap.
    let cancelled = false;
    import('./adapters').then(({ loadExperimentList }) =>
      loadExperimentList().then((real) => {
        if (cancelled || real.length === 0) return;
        setExperiments(real);
        setSelectedExperiment(real[0]);
        setDataMode('real');
      }),
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const value: StoreState = {
    experiments,
    selectedExperiment,
    setSelectedExperiment,
    blockFilter,
    setBlockFilter,
    dataMode,
    currentRound,
    setCurrentRound,
    isPlaying,
    setIsPlaying,
    selectedRound,
    setSelectedRound,
    selectedDGP,
    setSelectedDGP,
    selectedAggregation,
    setSelectedAggregation,
    selectedScoringRule,
    setSelectedScoringRule,
    selectedWeightingMode,
    setSelectedWeightingMode,
    selectedBehaviourPreset,
    setSelectedBehaviourPreset,
    selectedBehaviourModuleOptions,
    setSelectedBehaviourModuleOptions,
    selectedCoreSubstep,
    setSelectedCoreSubstep,
    selectedStage,
    setSelectedStage,
    rounds,
    setRounds,
    nAgents,
    setNAgents,
    seed,
    setSeed,
    lastPipelineResult,
    setLastPipelineResult,
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreState {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
