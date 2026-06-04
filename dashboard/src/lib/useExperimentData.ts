import { useState, useEffect, useRef } from 'react';
import { useStore } from './store';
import type {
  RunSummary,
  SkillWagerPoint,
  ForecastSeriesPoint,
  CalibrationPoint,
  BehaviourScenario,
  SweepPoint,
  RoundSeries,
  FixedDepositPoint,
  PreferenceStressRow,
  IntermittencyStressRow,
  ArbitrageScanRow,
  DetectionAdaptationRow,
  CollusionStressRow,
  InsiderAdvantageRow,
  WashActivityRow,
  StrategicReportingRow,
  IdentityAttackRow,
  DriftAdaptationRow,
  StakePolicyRow,
  SybilArbitrageRow,
  ArbitrageCrowdSizeRow,
  InformedCollusionRow,
  ReputationResetRow,
  DetectionMetricsRow,
} from './types';
import {
  loadSummary,
  loadSkillWagerData,
  loadForecastSeries,
  loadCalibration,
  loadBehaviourMatrix,
  loadPreferenceStress,
  loadIntermittencyStress,
  loadArbitrageScan,
  loadArbitrageCrowdSize,
  loadDetectionAdaptation,
  loadCollusionStress,
  loadInformedCollusion,
  loadInsiderAdvantage,
  loadWashActivity,
  loadStrategicReporting,
  loadSybilArbitrage,
  loadReputationReset,
  loadIdentityAttack,
  loadDriftAdaptation,
  loadStakePolicy,
  loadDetectionMetrics,
  loadSweepData,
  loadSettlementSeries,
  loadFixedDeposit,
} from './adapters';
import {
  generateMockSummary,
  generateMockSkillWager,
  generateMockForecastSeries,
  generateMockCalibration,
  generateMockBehaviourScenarios,
  generateMockSweep,
  generateMockSettlementSeries,
  generateMockFixedDeposit,
} from './mock-data';

interface ExperimentDataResult {
  summary: RunSummary | null;
  skillWagerData: SkillWagerPoint[];
  forecastSeries: ForecastSeriesPoint[];
  calibrationData: CalibrationPoint[];
  behaviourScenarios: BehaviourScenario[];
  sweepData: SweepPoint[];
  settlementSeries: RoundSeries[];
  fixedDepositData: FixedDepositPoint[];
  preferenceStressData: PreferenceStressRow[];
  intermittencyStressData: IntermittencyStressRow[];
  arbitrageScanData: ArbitrageScanRow[];
  detectionAdaptationData: DetectionAdaptationRow[];
  collusionStressData: CollusionStressRow[];
  insiderAdvantageData: InsiderAdvantageRow[];
  washActivityData: WashActivityRow[];
  strategicReportingData: StrategicReportingRow[];
  identityAttackData: IdentityAttackRow[];
  driftAdaptationData: DriftAdaptationRow[];
  stakePolicyData: StakePolicyRow[];
  sybilArbitrageData: SybilArbitrageRow[];
  arbitrageCrowdSizeData: ArbitrageCrowdSizeRow[];
  informedCollusionData: InformedCollusionRow[];
  reputationResetData: ReputationResetRow[];
  detectionMetricsData: DetectionMetricsRow[];
  loading: boolean;
  error: Error | null;
}

export function useExperimentData(): ExperimentDataResult {
  const { selectedExperiment, dataMode } = useStore();

  const [state, setState] = useState<ExperimentDataResult>({
    summary: null,
    skillWagerData: [],
    forecastSeries: [],
    calibrationData: [],
    behaviourScenarios: [],
    sweepData: [],
    settlementSeries: [],
    fixedDepositData: [],
    preferenceStressData: [],
    intermittencyStressData: [],
    arbitrageScanData: [],
    detectionAdaptationData: [],
    collusionStressData: [],
    insiderAdvantageData: [],
    washActivityData: [],
    strategicReportingData: [],
    identityAttackData: [],
    driftAdaptationData: [],
    stakePolicyData: [],
    sybilArbitrageData: [],
    arbitrageCrowdSizeData: [],
    informedCollusionData: [],
    reputationResetData: [],
    detectionMetricsData: [],
    loading: true,
    error: null,
  });

  const reqId = useRef(0);

  useEffect(() => {
    if (!selectedExperiment) return;

    const thisReq = ++reqId.current;
    const exp = selectedExperiment;
    const nAgents = exp.nAgents ?? 6;
    const T = exp.rounds ?? 20000;

    const mockFallback = (): ExperimentDataResult => ({
      summary: generateMockSummary(exp),
      skillWagerData: generateMockSkillWager(nAgents, Math.min(T, 50)),
      forecastSeries: generateMockForecastSeries(Math.min(T, 200)),
      calibrationData: generateMockCalibration(),
      behaviourScenarios: generateMockBehaviourScenarios(),
      sweepData: generateMockSweep(),
      settlementSeries: generateMockSettlementSeries(Math.min(T, 200)),
      fixedDepositData: generateMockFixedDeposit(nAgents, Math.min(T, 200)),
      preferenceStressData: [],
      intermittencyStressData: [],
      arbitrageScanData: [],
      detectionAdaptationData: [],
      collusionStressData: [],
      insiderAdvantageData: [],
      washActivityData: [],
      strategicReportingData: [],
      identityAttackData: [],
      driftAdaptationData: [],
      stakePolicyData: [],
      sybilArbitrageData: [],
      arbitrageCrowdSizeData: [],
      informedCollusionData: [],
      reputationResetData: [],
      detectionMetricsData: [],
      loading: false,
      error: null,
    });

    if (dataMode === 'mock') {
      queueMicrotask(() => setState(mockFallback()));
      return;
    }

    queueMicrotask(() => setState((prev) => ({ ...prev, loading: true, error: null })));

    (async () => {
      try {
        const loadTimeseries =
          exp.dataFiles?.timeseries
            ? loadSkillWagerData(exp, exp.dataFiles.timeseries).catch(() => [])
            : (exp.block === 'core' || exp.block === 'experiments')
              ? loadSkillWagerData(exp, 'timeseries.csv').catch(() => [])
              : Promise.resolve([]);
        const loadCrps =
          exp.dataFiles?.crps_timeseries
            ? loadForecastSeries(exp, exp.dataFiles.crps_timeseries).catch(() => [])
            : (exp.block === 'core' || exp.block === 'experiments')
              ? loadForecastSeries(exp, 'crps_timeseries.csv').catch(() => [])
              : Promise.resolve([]);

        const [
          summary,
          skillWagerData,
          forecastSeries,
          calibrationData,
          behaviourScenarios,
          preferenceStressData,
          intermittencyStressData,
          arbitrageScanData,
          detectionAdaptationData,
          collusionStressData,
          insiderAdvantageData,
          washActivityData,
          strategicReportingData,
          identityAttackData,
          driftAdaptationData,
          stakePolicyData,
          sybilArbitrageData,
          arbitrageCrowdSizeData,
          informedCollusionData,
          reputationResetData,
          detectionMetricsData,
          sweepData,
          settlementSeries,
          fixedDepositData,
        ] = await Promise.all([
          loadSummary(exp),
          loadTimeseries,
          loadCrps,
          exp.name === 'calibration' ? loadCalibration(exp) : Promise.resolve([]),
          exp.name === 'behaviour_matrix' ? loadBehaviourMatrix(exp) : Promise.resolve([]),
          exp.name === 'preference_stress_test' ? loadPreferenceStress(exp) : Promise.resolve([]),
          exp.name === 'intermittency_stress_test' ? loadIntermittencyStress(exp) : Promise.resolve([]),
          exp.name === 'arbitrage_scan' ? loadArbitrageScan(exp) : Promise.resolve([]),
          exp.name === 'detection_adaptation' ? loadDetectionAdaptation(exp) : Promise.resolve([]),
          exp.name === 'collusion_stress' ? loadCollusionStress(exp) : Promise.resolve([]),
          exp.name === 'insider_advantage' ? loadInsiderAdvantage(exp) : Promise.resolve([]),
          exp.name === 'wash_activity_gaming' ? loadWashActivity(exp) : Promise.resolve([]),
          exp.name === 'strategic_reporting' ? loadStrategicReporting(exp) : Promise.resolve([]),
          exp.name === 'identity_attack_matrix' ? loadIdentityAttack(exp) : Promise.resolve([]),
          exp.name === 'drift_adaptation' ? loadDriftAdaptation(exp) : Promise.resolve([]),
          exp.name === 'stake_policy_matrix' ? loadStakePolicy(exp) : Promise.resolve([]),
          exp.name === 'sybil_arbitrage' ? loadSybilArbitrage(exp) : Promise.resolve([]),
          exp.name === 'arbitrage_crowd_size' ? loadArbitrageCrowdSize(exp) : Promise.resolve([]),
          exp.name === 'informed_collusion' ? loadInformedCollusion(exp) : Promise.resolve([]),
          exp.name === 'reputation_reset' ? loadReputationReset(exp) : Promise.resolve([]),
          exp.name === 'collusion_stress' ? loadDetectionMetrics(exp) : Promise.resolve([]),
          exp.name === 'parameter_sweep' ? loadSweepData(exp) : Promise.resolve([]),
          exp.name === 'settlement_sanity' ? loadSettlementSeries(exp) : Promise.resolve([]),
          exp.name === 'fixed_deposit' ? loadFixedDeposit(exp) : Promise.resolve([]),
        ]);

        if (reqId.current !== thisReq) return;

        setState({
          summary,
          skillWagerData,
          forecastSeries,
          calibrationData,
          behaviourScenarios,
          preferenceStressData,
          intermittencyStressData,
          arbitrageScanData,
          detectionAdaptationData,
          collusionStressData,
          insiderAdvantageData,
          washActivityData,
          strategicReportingData,
          identityAttackData,
          driftAdaptationData,
          stakePolicyData,
          sybilArbitrageData,
          arbitrageCrowdSizeData,
          informedCollusionData,
          reputationResetData,
          detectionMetricsData,
          sweepData,
          settlementSeries,
          fixedDepositData,
          loading: false,
          error: null,
        });
      } catch (err) {
        if (reqId.current !== thisReq) return;
        setState({
          ...mockFallback(),
          error: err instanceof Error ? err : new Error('Failed to load experiment data'),
        });
      }
    })();
  }, [selectedExperiment, dataMode]);

  return state;
}
