/**
 * Inputs stage: experiment, round, seed, agents, forecast type, assumptions
 */
import { useExplorer } from '@/lib/explorerStore';
import VariantSelector from '@/components/thesis/VariantSelector';
import { useStore } from '@/lib/store';

export default function InputsPanel() {
  const {
    selectedExperiment,
    selectedRound,
    rounds,
    nAgents,
    seed,
    selectedDGP,
    selectedWeightingMode,
    selectedBehaviourPreset,
    setSelectedRound,
    setRounds,
    setNAgents,
    setSeed,
    setSelectedExperiment,
  } = useExplorer();
  const { experiments } = useStore();

  const handleExperimentChange = (name: string) => {
    const exp = experiments.find((e) => e.name === name) ?? null;
    setSelectedExperiment(exp);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Everything that enters round <em>t</em>: task, agents, reports, wagers, and state from t−1.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <VariantSelector
          label="Experiment"
          value={selectedExperiment?.name ?? experiments[0]?.name ?? ''}
          options={experiments.map((e) => ({ id: e.name, label: e.displayName, description: e.description }))}
          onChange={handleExperimentChange}
        />
        <div className="space-y-3">
          <label className="block">
            <span className="text-xs text-slate-500 font-medium">Round</span>
            <input
              type="number"
              min={0}
              max={rounds - 1}
              value={selectedRound}
              onChange={(e) => setSelectedRound(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 font-medium">Seed</span>
            <input
              type="number"
              min={0}
              value={seed}
              onChange={(e) => setSeed(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 font-medium">Agents (n)</span>
            <input
              type="number"
              min={2}
              max={20}
              value={nAgents}
              onChange={(e) => setNAgents(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-500 font-medium">Rounds (T)</span>
            <input
              type="number"
              min={50}
              max={2000}
              value={rounds}
              onChange={(e) => setRounds(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3">
        <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Selected variants (downstream)</h4>
        <ul className="text-xs text-slate-700 space-y-1">
          <li>DGP: <strong>{selectedDGP}</strong></li>
          <li>Weighting: <strong>{selectedWeightingMode}</strong></li>
          <li>Behaviour: <strong>{selectedBehaviourPreset}</strong></li>
          <li>Forecast type: point (MAE)</li>
        </ul>
      </div>
    </div>
  );
}
