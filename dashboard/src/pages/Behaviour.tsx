import PageHeader from '@/components/dashboard/PageHeader';
import { useStore } from '@/lib/store';
import { useExperimentData } from '@/lib/useExperimentData';
import { EXPERIMENT_RENDERERS } from '@/lib/behaviour/experimentRenderers';
import type { ExperimentRendererData } from '@/lib/behaviour/experimentRenderers';

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-sm text-slate-500">
      {message}
    </div>
  );
}

export default function Behaviour() {
  const { selectedExperiment } = useStore();
  const experimentData = useExperimentData();

  if (!selectedExperiment) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title="Behaviour experiments"
          description="Select a behaviour experiment from the left panel."
        />
      </div>
    );
  }

  if (selectedExperiment.block !== 'behaviour') {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title="Behaviour experiments"
          description="Select a behaviour-block experiment to see participation, preference, arbitrage, and manipulation diagnostics."
        />
        <EmptyState message="The current selection is not a behaviour experiment." />
      </div>
    );
  }

  if (experimentData.loading) {
    return (
      <div className="space-y-6 p-6">
        <PageHeader
          title={selectedExperiment.displayName}
          description={selectedExperiment.description}
        />
        <EmptyState message="Loading behaviour outputs…" />
      </div>
    );
  }

  const header = (
    <PageHeader
      title={selectedExperiment.displayName}
      description={selectedExperiment.description}
    />
  );

  const Renderer = EXPERIMENT_RENDERERS[selectedExperiment.name];

  if (!Renderer) {
    return (
      <div className="space-y-6 p-6">
        {header}
        <EmptyState message={`No renderer for experiment "${selectedExperiment.name}".`} />
      </div>
    );
  }

  const rendererData: ExperimentRendererData = {
    summary: experimentData.summary,
    behaviourScenarios: experimentData.behaviourScenarios,
    preferenceStressData: experimentData.preferenceStressData,
    intermittencyStressData: experimentData.intermittencyStressData,
    arbitrageScanData: experimentData.arbitrageScanData,
    detectionAdaptationData: experimentData.detectionAdaptationData,
    collusionStressData: experimentData.collusionStressData,
    insiderAdvantageData: experimentData.insiderAdvantageData,
    washActivityData: experimentData.washActivityData,
    strategicReportingData: experimentData.strategicReportingData,
    identityAttackData: experimentData.identityAttackData,
    driftAdaptationData: experimentData.driftAdaptationData,
    stakePolicyData: experimentData.stakePolicyData,
    sybilArbitrageData: experimentData.sybilArbitrageData,
    arbitrageCrowdSizeData: experimentData.arbitrageCrowdSizeData,
    informedCollusionData: experimentData.informedCollusionData,
    reputationResetData: experimentData.reputationResetData,
  };

  return <Renderer data={rendererData} header={header} />;
}
