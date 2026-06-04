import type { WalkthroughInputs } from '@/lib/types';
import { fmtNum, taskTypeLabel, scoringRuleLabel, agentDisplayName } from '@/lib/formatters';
import ProxyBadge from '@/components/dashboard/ProxyBadge';

interface InputsStepProps {
  inputs: WalkthroughInputs | null;
  experimentName?: string;
  scenarioLabel?: string;
}

export default function InputsStep({ inputs, experimentName, scenarioLabel }: InputsStepProps) {
  return (
    <div className="space-y-4">
      {(experimentName || scenarioLabel) && (
        <div className="flex flex-wrap gap-2">
          {experimentName && (
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
              Experiment: {experimentName}
            </span>
          )}
          {scenarioLabel && (
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-800">
              Scenario: {scenarioLabel}
            </span>
          )}
          {inputs?.isProxy && <ProxyBadge />}
        </div>
      )}
      {!inputs && (
        <p className="text-sm text-slate-500">
          Select an experiment and round to see inputs for round <em>t</em>.
        </p>
      )}
      {inputs && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Task & scoring</h4>
            <p>Task: {taskTypeLabel(inputs.taskType ?? 'point')}</p>
            <p>Scoring rule: {scoringRuleLabel(inputs.scoringRule ?? 'CRPS')}</p>
            {inputs.roundIndex != null && inputs.nRounds != null && (
              <p>Round {inputs.roundIndex + 1} of {inputs.nRounds}</p>
            )}
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Active agents</h4>
            {inputs.activeAgentIds?.length ? (
              <p>Agents: {inputs.activeAgentIds.map((id) => agentDisplayName(id)).join(', ')}</p>
            ) : (
              <p className="text-slate-500">—</p>
            )}
          </div>
          {inputs.forecasts && Object.keys(inputs.forecasts).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Submitted forecasts (r_i)</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(inputs.forecasts).map(([agent, val]) => (
                  <span key={agent} className="text-xs">
                    {agentDisplayName(agent)}: {fmtNum(val, 3)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {inputs.wagers && Object.keys(inputs.wagers).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Wagers / deposits (b_i)</h4>
              <div className="flex flex-wrap gap-2">
                {Object.entries(inputs.wagers).map(([agent, val]) => (
                  <span key={agent} className="text-xs">
                    {agentDisplayName(agent)}: {fmtNum(val, 2)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {(inputs.previousSkill || inputs.previousWealth) && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Carried state (from t−1)</h4>
              {inputs.previousSkill && (
                <p className="text-xs">Skill σ_i: {Object.entries(inputs.previousSkill).map(([a, v]) => `${agentDisplayName(a)}: ${fmtNum(v, 3)}`).join(', ')}</p>
              )}
              {inputs.previousWealth && (
                <p className="text-xs mt-1">Wealth: {Object.entries(inputs.previousWealth).map(([a, v]) => `${agentDisplayName(a)}: ${fmtNum(v, 2)}`).join(', ')}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
