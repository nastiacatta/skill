import type { ComponentType } from 'react';
import type {
  RunSummary,
  BehaviourScenario,
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
} from '@/lib/types';

import BehaviourMatrixRenderer from '@/components/behaviour/renderers/BehaviourMatrixRenderer';
import PreferenceStressRenderer from '@/components/behaviour/renderers/PreferenceStressRenderer';
import IntermittencyStressRenderer from '@/components/behaviour/renderers/IntermittencyStressRenderer';
import ArbitrageScanRenderer from '@/components/behaviour/renderers/ArbitrageScanRenderer';
import DetectionAdaptationRenderer from '@/components/behaviour/renderers/DetectionAdaptationRenderer';
import CollusionStressRenderer from '@/components/behaviour/renderers/CollusionStressRenderer';
import InsiderAdvantageRenderer from '@/components/behaviour/renderers/InsiderAdvantageRenderer';
import WashActivityRenderer from '@/components/behaviour/renderers/WashActivityRenderer';
import StrategicReportingRenderer from '@/components/behaviour/renderers/StrategicReportingRenderer';
import IdentityAttackRenderer from '@/components/behaviour/renderers/IdentityAttackRenderer';
import DriftAdaptationRenderer from '@/components/behaviour/renderers/DriftAdaptationRenderer';
import StakePolicyRenderer from '@/components/behaviour/renderers/StakePolicyRenderer';
import SybilArbitrageRenderer from '@/components/behaviour/renderers/SybilArbitrageRenderer';
import ArbitrageCrowdSizeRenderer from '@/components/behaviour/renderers/ArbitrageCrowdSizeRenderer';
import InformedCollusionRenderer from '@/components/behaviour/renderers/InformedCollusionRenderer';
import ReputationResetRenderer from '@/components/behaviour/renderers/ReputationResetRenderer';

/** The data shape passed to every experiment renderer. */
export interface ExperimentRendererData {
  summary: RunSummary | null;
  behaviourScenarios: BehaviourScenario[];
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
}

/** Props every experiment renderer receives. */
export interface ExperimentRendererProps {
  data: ExperimentRendererData;
  header: React.ReactNode;
}

/** Registry mapping experiment type names to their renderer components. */
export const EXPERIMENT_RENDERERS: Record<string, ComponentType<ExperimentRendererProps>> = {
  behaviour_matrix: BehaviourMatrixRenderer,
  preference_stress_test: PreferenceStressRenderer,
  intermittency_stress_test: IntermittencyStressRenderer,
  arbitrage_scan: ArbitrageScanRenderer,
  detection_adaptation: DetectionAdaptationRenderer,
  collusion_stress: CollusionStressRenderer,
  insider_advantage: InsiderAdvantageRenderer,
  wash_activity_gaming: WashActivityRenderer,
  strategic_reporting: StrategicReportingRenderer,
  identity_attack_matrix: IdentityAttackRenderer,
  drift_adaptation: DriftAdaptationRenderer,
  stake_policy_matrix: StakePolicyRenderer,
  sybil_arbitrage: SybilArbitrageRenderer,
  arbitrage_crowd_size: ArbitrageCrowdSizeRenderer,
  informed_collusion: InformedCollusionRenderer,
  reputation_reset: ReputationResetRenderer,
};
