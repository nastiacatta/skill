export interface ExperimentMeta {
  name: string;
  displayName: string;
  description: string;
  block: 'core' | 'behaviour' | 'experiments';
  dgp?: string;
  scoringMode?: string;
  nAgents?: number;
  rounds?: number;
  config?: Record<string, unknown>;
  dataFiles?: Record<string, string>;
  /** For project walkthrough: experiment family (core, behaviour, dgp, robustness, ablations) */
  family?: string;
  /** For project ordering / story */
  thesisTags?: string[];
  storyOrder?: number;
  scenarioGroup?: string;
}

export interface RunSummary {
  experimentName: string;
  finalCRPS?: number;
  finalGini?: number;
  finalNEff?: number;
  meanHHI?: number;
  meanNt?: number;
  finalRuinRate?: number;
  headlineResults: Record<string, unknown>;
}

/** One row from master_comparison: method comparison on same panel, paired deltas vs equal. */
export interface MasterComparisonRow {
  experiment: string;
  method: string;
  seed: number;
  DGP: string;
  preset: string;
  mean_crps: number;
  delta_crps_vs_equal: number;
  mean_HHI?: number;
  mean_N_eff?: number;
  final_gini?: number;
}

/** One row from bankroll_ablation: Full vs A-, B-, C-, D-, E-. */
export interface BankrollAblationRow {
  variant: string;
  mean_crps: number;
  delta_crps_vs_full: number;
  mean_HHI?: number;
  mean_N_eff?: number;
  final_gini?: number;
}

export interface RoundRecord {
  agent: number;
  t: number;
  wager: number;
  sigma: number;
  mOverB?: number;
  profit: number;
  cumProfit: number;
  missing: boolean;
  behaviourType?: string;
  deposit?: number;
  score?: number;
  loss?: number;
  wealth?: number;
}

export interface AgentRoundState {
  agentId: number;
  participated: boolean;
  behaviourType: string;
  sigma: number;
  deposit: number;
  effectiveWager: number;
  score: number;
  loss: number;
  profit: number;
  wealth: number;
  cumProfit: number;
}

export interface RoundSeries {
  round: number;
  budgetGap: number;
  minPayoutActive: number;
}

export interface ForecastSeriesPoint {
  t: number;
  crpsUniform: number;
  crpsDeposit: number;
  crpsSkill: number;
  crpsMechanism: number;
  crpsBestSingle: number;
  crpsUniformCum: number;
  crpsDepositCum: number;
  crpsSkillCum: number;
  crpsMechanismCum: number;
  crpsBestSingleCum: number;
}

export interface MetricSeriesPoint {
  t: number;
  value: number;
  label?: string;
}

export interface BehaviourScenario {
  scenario: string;
  totalProfit: number;
  meanRoundProfit: number;
  finalGini: number;
  finalNEff: number;
}

export interface CalibrationPoint {
  tau: number;
  pHat: number;
  nValid: number;
}

export interface WeightRecoveryRow {
  forecaster: number;
  wTarget: number;
  wLearned: number;
  absError: number;
}

export interface SweepPoint {
  lam: number;
  sigmaMin: number;
  meanCrps: number;
  gini: number;
  fracMeaningful: number;
}

export interface SkillWagerPoint {
  agent: number;
  t: number;
  wager: number;
  sigma: number;
  mOverB: number | null;
  profit: number;
  cumProfit: number;
  missing: boolean;
}

export interface FixedDepositPoint {
  agent: number;
  t: number;
  sigma: number;
  wager: number;
  mOverB: number;
}

export interface PreferenceStressRow {
  scenario: string;
  totalProfit: number;
  meanProfit: number;
  finalGini: number;
}

export interface IntermittencyStressRow {
  mode: string;
  totalProfit: number;
  participationRate: number;
  finalNEff: number;
}

export interface ArbitrageScanRow {
  lam: number;
  arbTotalProfit: number;
  arbFinalWealth: number;
  arbitrageFoundRounds: number;
  participationRounds?: number;
}

export interface DetectionAdaptationRow {
  attacker: string;
  totalProfit: number;
  finalWealth: number;
  detectorMeanScore?: number;
  detectorFlagRate?: number;
  detectorEvalRounds?: number;
}

export interface CollusionStressRow {
  scenario: string;
  totalProfit: number;
  meanProfit: number;
  finalGini: number;
  participationRate: number;
}

export interface InsiderAdvantageRow {
  scenario: string;
  insiderProfit: number;
  finalGini: number;
}

export interface WashActivityRow {
  scenario: string;
  totalActivity: number;
  nRounds: number;
}

export interface StrategicReportingRow {
  scenario: string;
  meanAggError: number;
  finalGini: number;
}

export interface IdentityAttackRow {
  identity: string;
  totalProfit: number;
  finalNEff: number;
  finalGini: number;
}

export interface DriftAdaptationRow {
  belief: string;
  meanMae: number;
  finalGini: number;
}

export interface StakePolicyRow {
  staking: string;
  totalProfit: number;
  meanDeposit: number;
  finalGini: number;
}

export interface SybilArbitrageRow {
  k: number;
  meanProfit: number;
  seProfit: number;
  ciLow: number;
  ciHigh: number;
  meanNEff: number;
  seNEff: number;
  nSeeds: number;
}

export interface ArbitrageCrowdSizeRow {
  lam: number;
  nBenign: number;
  meanProfit: number;
  seProfit: number;
  ciLow: number;
  ciHigh: number;
  nSeeds: number;
}

export interface InformedCollusionRow {
  scenario: string;
  meanCoalitionProfit: number;
  seCoalitionProfit: number;
  ciLow: number;
  ciHigh: number;
  nSeeds: number;
}

export interface ReputationResetRow {
  scenario: string;
  meanAttackerProfit: number;
  seAttackerProfit: number;
  ciLow: number;
  ciHigh: number;
  meanNResets: number;
  nSeeds: number;
}

export interface DetectionMetricsRow {
  detector: string;
  score: number;
}

export interface ExperimentData {
  meta: ExperimentMeta;
  summary?: RunSummary;
  roundRecords?: SkillWagerPoint[];
  forecastSeries?: ForecastSeriesPoint[];
  calibration?: CalibrationPoint[];
  behaviourScenarios?: BehaviourScenario[];
  sweepData?: SweepPoint[];
  settlementSeries?: RoundSeries[];
  fixedDeposit?: FixedDepositPoint[];
  preferenceStress?: PreferenceStressRow[];
  intermittencyStress?: IntermittencyStressRow[];
  arbitrageScan?: ArbitrageScanRow[];
  detectionAdaptation?: DetectionAdaptationRow[];
  collusionStress?: CollusionStressRow[];
  insiderAdvantage?: InsiderAdvantageRow[];
  washActivity?: WashActivityRow[];
  strategicReporting?: StrategicReportingRow[];
  identityAttack?: IdentityAttackRow[];
  driftAdaptation?: DriftAdaptationRow[];
  stakePolicy?: StakePolicyRow[];
  sybilArbitrage?: SybilArbitrageRow[];
  arbitrageCrowdSize?: ArbitrageCrowdSizeRow[];
  informedCollusion?: InformedCollusionRow[];
  reputationReset?: ReputationResetRow[];
  detectionMetrics?: DetectionMetricsRow[];
}

export type PageId = 'overview' | 'replay' | 'behaviour' | 'diagnostics' | 'compare';

/** Walkthrough: inputs entering round t. When isProxy is true, wagers/previousWealth are placeholders. */
export interface WalkthroughInputs {
  taskType?: string;
  scoringRule?: string;
  activeAgentIds?: number[];
  forecasts?: Record<number, number>;
  wagers?: Record<number, number>;
  previousSkill?: Record<number, number>;
  previousWealth?: Record<number, number>;
  roundIndex?: number;
  nRounds?: number;
  /** True when derived from roundRecords only (no trace); values are approximate. */
  isProxy?: true;
}

/** Walkthrough: DGP metadata for current scenario */
export interface WalkthroughDGPMeta {
  dgpId?: string;
  label?: string;
  truthSource?: 'exogenous' | 'endogenous';
  description?: string;
  driftRegime?: string;
  signalPrecision?: string;
  correlationStructure?: string;
  formula?: string;
}

/** Walkthrough: round result metrics. When isProxy is true, aggregateForecast is undefined. */
export interface WalkthroughRoundResult {
  aggregateForecast?: number;
  realisedOutcome?: number;
  score?: number;
  loss?: number;
  payoffs?: Record<number, number>;
  wealthChanges?: Record<number, number>;
  skillWeightChanges?: Record<number, number>;
  contributionShares?: Record<number, number>;
  totalDistributed?: number;
  totalRefunds?: number;
  concentrationHHI?: number;
  topShare?: number;
  topWinners?: { agentId: number; payoff: number }[];
  nEff?: number;
  gini?: number;
  calibrationMetric?: number;
  /** True when no trace (roundRecords only); aggregate and some metrics are placeholder. */
  isProxy?: true;
}

/** Walkthrough: state carried to t+1 */
export interface WalkthroughNextState {
  wealth?: Record<number, number>;
  skill?: Record<number, number>;
  weights?: Record<number, number>;
  eligibility?: Record<number, boolean>;
  missingnessState?: Record<string, unknown>;
}
