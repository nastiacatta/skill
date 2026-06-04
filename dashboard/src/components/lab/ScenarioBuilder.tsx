import { useId } from 'react';
import type { BuilderSelections, DepositPolicy, InfluenceRule, AggregationRule, SettlementRule } from '@/lib/coreMechanism/runRoundComposable';
import { PRESET_META, type BehaviourPresetId } from '@/lib/behaviour/scenarioSimulator';
import type { DGPId } from '@/lib/coreMechanism/dgpSimulator';
import type { SimParams } from '@/lib/mechanismExplorer/types';

interface ScenarioBuilderProps {
  dgp: DGPId;
  setDGP: (d: DGPId) => void;
  builder: BuilderSelections;
  setBuilder: (b: BuilderSelections) => void;
  behaviourPreset: BehaviourPresetId;
  setBehaviourPreset: (p: BehaviourPresetId) => void;
  params: SimParams;
  setParams: (p: SimParams) => void;
  seed: number;
  setSeed: (s: number) => void;
}

const DGP_OPTIONS: { id: DGPId; label: string }[] = [
  { id: 'baseline', label: 'Baseline' },
  { id: 'latent_fixed', label: 'Latent fixed' },
  { id: 'aggregation_method1', label: 'Method 1' },
  { id: 'aggregation_method3', label: 'Method 3' },
];

const DEPOSIT_OPTIONS: { id: DepositPolicy; label: string }[] = [
  { id: 'fixed_unit', label: 'Fixed amount' },
  { id: 'wealth_fraction', label: 'Fraction of wealth' },
  { id: 'sigma_scaled', label: 'Wealth fraction × skill' },
];

const INFLUENCE_OPTIONS: { id: InfluenceRule; label: string }[] = [
  { id: 'uniform', label: 'Equal' },
  { id: 'deposit_only', label: 'Stake only' },
  { id: 'skill_only', label: 'Skill only' },
  { id: 'skill_stake', label: 'Skill × stake' },
];

const AGGREGATION_OPTIONS: { id: AggregationRule; label: string }[] = [
  { id: 'linear', label: 'Linear pool' },
  { id: 'sqrt', label: 'Square root' },
  { id: 'softmax', label: 'Softmax' },
];

const SETTLEMENT_OPTIONS: { id: SettlementRule; label: string }[] = [
  { id: 'skill_only', label: 'Skill only' },
  { id: 'skill_plus_utility', label: 'Skill + bonus pool' },
];

const BEHAVIOUR_OPTIONS: { id: BehaviourPresetId; label: string; desc: string }[] = [
  { id: 'baseline', label: 'Benign', desc: 'Steady honest participation' },
  { id: 'bursty', label: 'Bursty', desc: 'Participation arrives in clusters' },
  { id: 'risk_averse', label: 'Risk-averse', desc: 'Smaller deposits and tighter reports' },
  { id: 'manipulator', label: 'Manipulator', desc: 'Strategic directional bias' },
  { id: 'sybil', label: 'Sybil', desc: 'One forecaster split across identities' },
  { id: 'evader', label: 'Evader', desc: 'Manipulates, but tries to stay hidden' },
  { id: 'arbitrageur', label: 'Arbitrageur', desc: 'Acts when disagreement is large' },
];

const DEPOSIT_HELP: Record<DepositPolicy, string> = {
  fixed_unit: 'Each active agent posts the same deposit each round.',
  wealth_fraction: 'Each active agent deposits a fixed share of current wealth.',
  sigma_scaled: 'Each active agent deposits a share of current wealth, scaled by current skill.',
};

const INFLUENCE_HELP: Record<InfluenceRule, string> = {
  uniform: 'All active reports receive equal weight.',
  deposit_only: 'Weights depend only on stake.',
  skill_only: 'Weights depend only on the skill layer.',
  skill_stake: 'Weights depend on both skill and stake.',
};

const AGGREGATION_HELP: Record<AggregationRule, string> = {
  linear: 'Weights are used directly in the pool.',
  sqrt: 'Large weights are compressed before pooling.',
  softmax: 'Weights are normalised through a softmax transform.',
};

const SETTLEMENT_HELP: Record<SettlementRule, string> = {
  skill_only: 'Payout depends on scoring performance and the skill layer only.',
  skill_plus_utility:
    'Same settlement logic as skill-only, plus an external bonus pool for agents above the score threshold.',
};

interface SliderRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}

function SliderRow({ label, value, min, max, step, onChange, format }: SliderRowProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[11px]">
        <label htmlFor={id} className="text-slate-300">{label}</label>
        <span className="font-mono font-medium text-slate-100">{format ? format(value) : value}</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(+e.target.value)}
        className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-teal-600"
      />
    </div>
  );
}

interface SelectRowProps {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (v: string) => void;
}

function SelectRow({ label, value, options, onChange }: SelectRowProps) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="text-[11px] text-slate-300 font-medium">{label}</label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs bg-slate-800 text-white border-0 rounded-md py-1.5 px-2 font-medium focus:ring-1 focus:ring-teal-500 cursor-pointer"
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function ScenarioBuilder({
  dgp, setDGP,
  builder, setBuilder,
  behaviourPreset, setBehaviourPreset,
  params, setParams,
  seed, setSeed,
}: ScenarioBuilderProps) {
  const setParam = (key: keyof SimParams, value: number) => {
    setParams({ ...params, [key]: value });
  };

  const selectedBehaviour = PRESET_META[behaviourPreset];
  const behaviourInfo = selectedBehaviour
    ? {
        meaning: selectedBehaviour.description,
        implementation: `Uses levers: ${selectedBehaviour.levers.join(', ')}.`,
        roundEffect: selectedBehaviour.description,
      }
    : null;

  return (
    <aside className="w-64 shrink-0 bg-slate-900 text-white rounded-xl p-4 space-y-5 overflow-y-auto max-h-[calc(100vh-8rem)] scrollbar-thin">
      <div>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Scenario</h2>
        <div className="space-y-3">
          <SelectRow label="Data generating process" value={dgp} options={DGP_OPTIONS} onChange={(v) => setDGP(v as DGPId)} />
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-4">
        <div className="text-xs font-semibold text-slate-200 mb-2">Mechanism</div>

        <div className="space-y-3">
          <div>
            <SelectRow
              label="Deposit"
              value={builder.depositPolicy}
              options={DEPOSIT_OPTIONS}
              onChange={(v) => setBuilder({ ...builder, depositPolicy: v as DepositPolicy })}
            />
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              {DEPOSIT_HELP[builder.depositPolicy]}
            </p>
          </div>

          <div>
            <SelectRow
              label="Weight"
              value={builder.influenceRule}
              options={INFLUENCE_OPTIONS}
              onChange={(v) => setBuilder({ ...builder, influenceRule: v as InfluenceRule })}
            />
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              {INFLUENCE_HELP[builder.influenceRule]}
            </p>
          </div>

          <div>
            <SelectRow
              label="Aggregation"
              value={builder.aggregationRule}
              options={AGGREGATION_OPTIONS}
              onChange={(v) => setBuilder({ ...builder, aggregationRule: v as AggregationRule })}
            />
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              {AGGREGATION_HELP[builder.aggregationRule]}
            </p>
          </div>

          <div>
            <SelectRow
              label="Settlement"
              value={builder.settlementRule}
              options={SETTLEMENT_OPTIONS}
              onChange={(v) => setBuilder({ ...builder, settlementRule: v as SettlementRule })}
            />
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              {SETTLEMENT_HELP[builder.settlementRule]}
            </p>
          </div>

          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <div className="text-[11px] font-semibold text-slate-100">
              Deposit vs effective wager
            </div>
            <p className="mt-1 text-[11px] leading-5 text-slate-300">
              Deposit \(b_i\) is what the agent posts this round. The effective wager is the
              skill-adjusted amount that actually drives weight inside the mechanism.
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-slate-700/50 pt-4">
        <div className="text-xs font-semibold text-slate-200 mb-2">Behaviour</div>

        <div className="grid grid-cols-2 gap-2">
          {BEHAVIOUR_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setBehaviourPreset(o.id)}
              className={`text-left px-2.5 py-2 rounded-lg text-[11px] transition-all ${
                behaviourPreset === o.id
                  ? 'bg-teal-600 text-white ring-1 ring-teal-400'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
              title={o.desc}
            >
              <div className="font-medium">{o.label}</div>
              <div className="opacity-80">{o.desc}</div>
            </button>
          ))}
        </div>

        {behaviourInfo && (
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/70 p-3">
          <div className="text-[11px] font-semibold text-slate-100">
            {selectedBehaviour?.label}
          </div>

          <p className="mt-2 text-[11px] leading-5 text-slate-300">
            <span className="font-semibold text-slate-100">What we mean: </span>
            {behaviourInfo.meaning}
          </p>

          <p className="mt-2 text-[11px] leading-5 text-slate-300">
            <span className="font-semibold text-slate-100">How it is implemented here: </span>
            {behaviourInfo.implementation}
          </p>

          <p className="mt-2 text-[11px] leading-5 text-slate-300">
            <span className="font-semibold text-slate-100">What changes in the round: </span>
            {behaviourInfo.roundEffect}
          </p>
        </div>
        )}
      </div>

      <div className="border-t border-slate-700/50 pt-4">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300 mb-3">Parameters</h2>
        <div className="space-y-3">
          <SliderRow label="Rounds (T)" value={params.T} min={10} max={20000} step={100} onChange={(v) => setParam('T', v)} format={(v) => v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k` : String(v)} />
          <SliderRow label="Forecasters (N)" value={params.N} min={3} max={12} step={1} onChange={(v) => setParam('N', v)} />
          <SliderRow label="Seed" value={seed} min={1} max={999} step={1} onChange={setSeed} />
          <div className="border-t border-slate-700/50 pt-3 mt-3">
            <div className="text-[10px] text-slate-300 font-medium mb-2">Mechanism tuning</div>
            <div className="space-y-2.5">
              <SliderRow label="γ (skill decay)" value={params.gamma} min={0.1} max={5} step={0.1} onChange={(v) => setParam('gamma', v)} />
              <SliderRow label="λ (stake weight)" value={params.lambda} min={0} max={1} step={0.05} onChange={(v) => setParam('lambda', v)} />
              <SliderRow label="η (skill exp.)" value={params.eta} min={0.5} max={3} step={0.1} onChange={(v) => setParam('eta', v)} />
              <SliderRow label="f (deposit frac.)" value={params.f} min={0.05} max={0.9} step={0.05} onChange={(v) => setParam('f', v)} />
            </div>
            <details className="mt-3">
              <summary className="cursor-pointer select-none text-[10px] font-medium text-slate-400 py-1">
                Advanced (beyond-project)
              </summary>
              <p className="mt-1 mb-2 text-[10px] leading-4 text-slate-400">
                The external bonus pool sits outside the self-financed Lambert mechanism. Leave at 0 to match the project's settlement.
              </p>
              <SliderRow label="U (bonus pool)" value={params.U} min={0} max={200} step={5} onChange={(v) => setParam('U', v)} />
            </details>
          </div>
        </div>
      </div>
    </aside>
  );
}
