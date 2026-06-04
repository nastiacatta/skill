import type { WalkthroughNextState } from '@/lib/types';
import { fmtNum, agentDisplayName } from '@/lib/formatters';

interface NextStateStepProps {
  nextState: WalkthroughNextState | null;
}

export default function NextStateStep({ nextState }: NextStateStepProps) {
  return (
    <div className="space-y-4">
      {!nextState && (
        <p className="text-sm text-slate-500">
          Select an experiment and round to see state carried to <em>t+1</em>.
        </p>
      )}
      {nextState && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          {nextState.wealth && Object.keys(nextState.wealth).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Wealth W_{'{i,t+1}'}</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(nextState.wealth).map(([agent, val]) => (
                  <span key={agent}>{agentDisplayName(agent)}: {fmtNum(val, 2)}</span>
                ))}
              </div>
            </div>
          )}
          {nextState.skill && Object.keys(nextState.skill).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Skill σ_{'{i,t+1}'}</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(nextState.skill).map(([agent, val]) => (
                  <span key={agent}>{agentDisplayName(agent)}: {fmtNum(val, 3)}</span>
                ))}
              </div>
            </div>
          )}
          {nextState.weights && Object.keys(nextState.weights).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Weights (for next aggregation)</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(nextState.weights).map(([agent, val]) => (
                  <span key={agent}>{agentDisplayName(agent)}: {fmtNum(val, 4)}</span>
                ))}
              </div>
            </div>
          )}
          {nextState.eligibility && Object.keys(nextState.eligibility).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-white p-3 sm:col-span-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Eligibility / participation state</h4>
              <div className="flex flex-wrap gap-2 text-xs">
                {Object.entries(nextState.eligibility).map(([agent, el]) => (
                  <span key={agent}>{agentDisplayName(agent)}: {el ? 'eligible' : 'ineligible'}</span>
                ))}
              </div>
            </div>
          )}
          {nextState.missingnessState && Object.keys(nextState.missingnessState).length > 0 && (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 sm:col-span-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase mb-2">Missingness correction state</h4>
              <p className="text-xs text-slate-600">Carried for consistent handling of absent agents in t+1.</p>
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-slate-500">
        These variables are the only state propagated to the next round; the mechanism is Markovian in this representation.
      </p>
    </div>
  );
}
