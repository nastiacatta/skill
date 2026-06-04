/**
 * ThreatClassification — data-driven threat tier cards.
 *
 * Replaces the hardcoded THREAT_TIERS array in OverviewTab.
 * Classifies presets by deltaCrpsPct into 5 tiers and renders
 * colour-coded cards with interpretation text from PRESET_CONFIGS.
 */

import type { ComparisonRow } from '@/hooks/useBehaviourSimulations';
import { PRESET_CONFIGS } from '@/lib/behaviour/presetMeta';
import type { BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';
import { SEED, N, T } from '@/lib/behaviour/helpers';

// ── Types ──────────────────────────────────────────────────────────────────

export interface ThreatThresholds {
  critical: number; // default: 10
  moderate: number; // default: 2
  mild: number;     // default: 0.5
}

export interface ThreatTierPreset {
  row: ComparisonRow;
  interpretation: string;
}

export interface ThreatTier {
  tier: 'critical' | 'moderate' | 'mild' | 'negligible' | 'beneficial';
  presets: ThreatTierPreset[];
}

// ── Tier styling ───────────────────────────────────────────────────────────

const TIER_STYLES: Record<ThreatTier['tier'], {
  label: string;
  rule: string;
  borderColor: string;
  bgColor: string;
  textColor: string;
  labelColor: string;
}> = {
  critical: {
    label: 'CRITICAL',
    rule: 'Δ > 10%',
    borderColor: 'border-l-red-500',
    bgColor: 'bg-red-50',
    textColor: 'text-red-700',
    labelColor: 'text-red-800',
  },
  moderate: {
    label: 'MODERATE',
    rule: '2–10%',
    borderColor: 'border-l-orange-400',
    bgColor: 'bg-orange-50',
    textColor: 'text-orange-700',
    labelColor: 'text-orange-800',
  },
  mild: {
    label: 'MILD',
    rule: '0.5–2%',
    borderColor: 'border-l-yellow-400',
    bgColor: 'bg-yellow-50',
    textColor: 'text-yellow-700',
    labelColor: 'text-yellow-800',
  },
  negligible: {
    label: 'NEGLIGIBLE',
    rule: '|Δ| ≤ 0.5%',
    borderColor: 'border-l-slate-300',
    bgColor: 'bg-slate-50',
    textColor: 'text-slate-600',
    labelColor: 'text-slate-700',
  },
  beneficial: {
    label: 'BENEFICIAL',
    rule: 'Δ < -0.5%',
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-50',
    textColor: 'text-emerald-700',
    labelColor: 'text-emerald-800',
  },
};

// ── Core algorithm ─────────────────────────────────────────────────────────

const DEFAULT_THRESHOLDS: ThreatThresholds = { critical: 10, moderate: 2, mild: 0.5 };

/**
 * Classify presets into threat tiers based on deltaCrpsPct.
 *
 * Preconditions:
 *   - summary has at least one row
 *   - all deltaCrpsPct values are finite
 *   - thresholds: critical > moderate > mild > 0
 *
 * Postconditions:
 *   - every non-baseline row assigned to exactly one tier
 *   - tiers ordered: critical → moderate → mild → negligible → beneficial
 *   - empty tiers excluded
 *   - within each tier, presets sorted by |delta| descending
 */
export function deriveThreatTiers(
  summary: ComparisonRow[],
  thresholds: ThreatThresholds = DEFAULT_THRESHOLDS,
): ThreatTier[] {
  const tiers: ThreatTier[] = [
    { tier: 'critical', presets: [] },
    { tier: 'moderate', presets: [] },
    { tier: 'mild', presets: [] },
    { tier: 'negligible', presets: [] },
    { tier: 'beneficial', presets: [] },
  ];

  for (const row of summary) {
    if (row.presetId === 'baseline') continue;

    const delta = row.deltaCrpsPct;
    const interpretation =
      PRESET_CONFIGS[row.presetId as BehaviourPresetId]?.description ?? '';

    const entry: ThreatTierPreset = { row, interpretation };

    if (delta > thresholds.critical) {
      tiers[0].presets.push(entry);
    } else if (delta > thresholds.moderate) {
      tiers[1].presets.push(entry);
    } else if (delta > thresholds.mild) {
      tiers[2].presets.push(entry);
    } else if (delta >= -thresholds.mild) {
      tiers[3].presets.push(entry);
    } else {
      tiers[4].presets.push(entry);
    }
  }

  // Sort within each tier by |delta| descending
  for (const tier of tiers) {
    tier.presets.sort(
      (a, b) => Math.abs(b.row.deltaCrpsPct) - Math.abs(a.row.deltaCrpsPct),
    );
  }

  return tiers.filter(t => t.presets.length > 0);
}

// ── Component ──────────────────────────────────────────────────────────────

interface ThreatClassificationProps {
  summary: ComparisonRow[];
  thresholds?: ThreatThresholds;
}

export default function ThreatClassification({
  summary,
  thresholds,
}: ThreatClassificationProps) {
  const tiers = deriveThreatTiers(summary, thresholds);

  if (tiers.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-slate-800">
        Threat classification ({summary.filter(r => r.presetId !== 'baseline').length} presets)
      </h3>
      <p className="text-[14px] text-slate-500">
        Grouped by Δ CRPS impact vs truthful baseline. {T} rounds, {N} agents, seed {SEED}.
      </p>
      <div className="space-y-2">
        {tiers.map(tier => {
          const style = TIER_STYLES[tier.tier];
          return (
            <div
              key={tier.tier}
              className={`rounded-xl border border-slate-200 border-l-4 ${style.borderColor} ${style.bgColor} p-4`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className={`text-[14px] font-bold uppercase tracking-wider ${style.labelColor}`}>
                  {style.label}
                </span>
                <span className="text-[13px] text-slate-400 ml-1">({style.rule})</span>
              </div>
              <div className="space-y-1">
                {tier.presets.map(p => {
                  const delta = p.row.deltaCrpsPct;
                  const sign = delta > 0 ? '+' : '';
                  const formatted = `${sign}${delta.toFixed(1)}%`;
                  return (
                    <div key={p.row.presetId} className="flex items-baseline gap-2 text-[14px]">
                      <span className={`font-semibold ${style.textColor} w-24 shrink-0`}>
                        {p.row.name}
                      </span>
                      <span className="font-mono font-semibold text-slate-600 w-16 shrink-0 text-right">
                        {formatted}
                      </span>
                      <span className="text-slate-500">{p.interpretation}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
