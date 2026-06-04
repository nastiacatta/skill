/**
 * Behaviour stage: 6 substeps with presets
 * 1. Participation and timing
 * 2. Belief formation
 * 3. Reporting strategy
 * 4. Staking / deposits / bankroll
 * 5. Missingness
 * 6. Identity strategy / sybils
 */
import { useState } from 'react';
import clsx from 'clsx';
import { useExplorer } from '@/lib/explorerStore';
import type { BehaviourSubtabId } from '@/lib/thesis';
import { BEHAVIOUR_SUBTABS, BEHAVIOUR_SUBTAB_LABELS } from '@/lib/thesis';
import VariantSelector from '@/components/thesis/VariantSelector';
import { PRESET_META, type BehaviourPresetId } from '@/lib/behaviour/scenarioSimulator';

export default function BehaviourPanel() {
  const [subtab, setSubtab] = useState<BehaviourSubtabId>('participation');
  const { selectedBehaviourPreset, setSelectedBehaviourPreset } = useExplorer();

  const presetOptions = (Object.keys(PRESET_META) as BehaviourPresetId[]).map((id) => ({
    id,
    label: PRESET_META[id].label,
    description: PRESET_META[id].description,
  }));

  const content: Record<BehaviourSubtabId, { explain: string; effect: string }> = {
    participation: {
      explain: 'Who participates and when: baseline (all), bursty, intermittent, edge-threshold, avoid-skill-decay.',
      effect: 'Which agents submit reports and deposits in round t.',
    },
    belief: {
      explain: 'How agents form beliefs: truthful (signal-based), hedged, strategic, noisy.',
      effect: 'The latent belief that may differ from the reported r_i.',
    },
    reporting: {
      explain: 'How reports are formed: truthful, hedged (risk-averse), strategic, noisy.',
      effect: 'Values of r_i and possible bias or manipulation.',
    },
    staking: {
      explain: 'Deposit / staking policy: fixed, Kelly-like, house-money, lumpy, break-even, volatility-sensitive.',
      effect: 'b_i per agent and thus effective wager after skill gate.',
    },
    missingness: {
      explain: 'Behavioural cause: intermittent participation, burstiness, selective entry. Core response: missing-submission handling, freeze σ or decay toward L₀.',
      effect: 'The mechanism treats non-participants consistently so aggregation remains well-defined.',
    },
    identity: {
      explain: 'Identity / adversarial strategy: single account, sybil split, collusion, reputation reset, insider, wash trading.',
      effect: 'Multiple identities, coordinated reports, or privileged information. Stress tests for robustness.',
    },
  };

  const c = content[subtab];

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Behaviour is separate from the core mechanism. It determines how agents choose participation, reports, deposits, and identity.
      </p>

      <VariantSelector
        label="Behaviour preset / scenario"
        value={selectedBehaviourPreset}
        options={presetOptions}
        onChange={(id) => setSelectedBehaviourPreset(id as BehaviourPresetId)}
      />

      {PRESET_META[selectedBehaviourPreset] && (
        <div className="rounded-lg border border-slate-200 bg-teal-50/50 p-3">
          <p className="text-xs text-slate-500">Selected preset</p>
          <p className="text-sm font-medium text-slate-800">{PRESET_META[selectedBehaviourPreset].label}</p>
          <p className="text-xs text-slate-600 mt-0.5">{PRESET_META[selectedBehaviourPreset].description}</p>
          <p className="text-xs text-slate-500 mt-1">Levers: {PRESET_META[selectedBehaviourPreset].levers.join(', ')}</p>
        </div>
      )}

      <div className="inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1">
        {BEHAVIOUR_SUBTABS.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubtab(id)}
            className={clsx(
              'px-2.5 py-1 rounded text-xs font-medium transition-colors',
              subtab === id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-800'
            )}
          >
            {BEHAVIOUR_SUBTAB_LABELS[id]}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <p className="text-sm text-slate-700">{c.explain}</p>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500">Effect on actions seen by core:</p>
          <p className="text-xs text-slate-600 mt-0.5">{c.effect}</p>
        </div>
      </div>
    </div>
  );
}
