/**
 * Compact per-behaviour explainer card.
 *
 * Surfaces the plain-English description for one or more presets in tabs
 * that show behaviour-specific results, so viewers always know exactly
 * what each preset represents without clicking through.
 */

import { PRESET_CONFIGS } from '@/lib/behaviour/presetMeta';
import type { BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';
import { FAMILY_COLORS } from '@/lib/palette';
import type { BehaviourFamily } from '@/lib/behaviour/hiddenAttributes';

/** One-line "what the agent does" paraphrase per preset. Plain English, no jargon. */
const PLAIN_EXPLANATION: Record<BehaviourPresetId, string> = {
  baseline:
    'Everyone reports their honest belief and participates most rounds. Reference line for every other scenario.',
  bursty:
    'Agents come and go in waves (some rounds have almost everyone present, others only a few). Tests whether the mechanism handles intermittent participation.',
  risk_averse:
    'Agents shrink their reports toward 0.5 and put down smaller stakes. They forfeit reward to cap downside.',
  manipulator:
    'One forecaster pushes reports in a fixed direction (e.g. always above the truth) and stakes more aggressively to move the aggregate.',
  sybil:
    'One strong forecaster operates several accounts, each with a slice of the original budget. Tests whether splitting identity gives any advantage.',
  evader:
    'A manipulator that backs off whenever the public dispersion suggests detection is likely. Tests whether stealth helps beat the skill layer.',
  arbitrageur:
    'Sits out unless others disagree strongly, then reports the weighted median of the others to harvest the Chen (2014) arbitrage.',
  collusion:
    'Two forecasters coordinate their participation, reports, and stakes to extract more than either could alone.',
  reputation_reset:
    'Plays honestly long enough to build a high σ, then switches to manipulation. Tests how fast the EWMA undoes the skill estimate.',
  biased:
    'Adds a persistent directional offset (e.g. +0.15) to every report. Not strategic, just systematically wrong.',
  miscalibrated:
    'Overconfident reporting pushes reports away from 0.5, so tail events are exaggerated. Centre of belief is fine, spread is wrong.',
  noisy_reporter:
    'Adds random noise on top of a truthful belief. Sloppy, not strategic.',
  budget_constrained:
    'Some forecasters start with very little wealth. Tests what happens when losses drive forecasters to ruin.',
  house_money:
    'Forecasters bet bigger after wins and smaller after losses. Behavioural-finance pattern, not a utility maximiser.',
  kelly_sizer:
    'Deposits are proportional to the forecaster\'s own perceived edge (σ × (1−σ)), a Kelly-like rule.',
  reputation_gamer:
    'Reports near the current aggregate to minimise loss on the CRPS rule and inflate σ, without actually contributing new information.',
  sandbagger:
    'Deliberately reports badly to keep expectations low. Tests whether pretending to be weak is a viable strategy.',
  reinforcement_learner:
    'Raises participation after profitable rounds and withdraws after losses. Adaptive entry, no explicit strategic model.',
  latency_exploiter:
    'Submits late enough that partial outcome information has leaked, giving a tiny informational edge.',
};

/** Compact callout: one row per preset, with colour-coded family chip + one-line description. */
export default function PresetCallout({
  presetIds,
  title = 'Behaviours tested here',
}: {
  presetIds: BehaviourPresetId[];
  title?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <h4 className="text-[14px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
        {title}
      </h4>
      <ul className="space-y-2.5">
        {presetIds.map(id => {
          const config = PRESET_CONFIGS[id];
          if (!config) return null;
          const color = FAMILY_COLORS[config.family as BehaviourFamily] ?? '#94a3b8';
          return (
            <li key={id} className="flex items-start gap-2.5">
              <span
                className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
                aria-hidden
              />
              <div className="min-w-0">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="text-sm font-semibold text-slate-800">
                    {config.label}
                  </span>
                  <span className="text-[13px] uppercase tracking-wider text-slate-400 capitalize">
                    {config.family}
                  </span>
                </div>
                <p className="text-[14px] text-slate-600 leading-relaxed mt-0.5">
                  {PLAIN_EXPLANATION[id] ?? config.description}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export { PLAIN_EXPLANATION };
