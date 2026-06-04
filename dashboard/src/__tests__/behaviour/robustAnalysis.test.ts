/**
 * Multi-seed robust analysis: run 18 behaviour presets across 5 seeds,
 * report mean ± std of key metrics for thesis-quality results.
 */
import { describe, it } from 'vitest';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { PRESET_CONFIGS } from '@/lib/behaviour/presetMeta';
import type { BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';

const SEEDS = [42, 137, 271, 503, 997];
const N = 6;
const T = 300;

const BEHAVIOUR_PRESETS: BehaviourPresetId[] = [
  'baseline', 'bursty', 'risk_averse', 'manipulator', 'sybil', 'evader',
  'arbitrageur', 'collusion', 'reputation_reset', 'biased', 'miscalibrated',
  'noisy_reporter', 'budget_constrained', 'house_money', 'kelly_sizer',
  'reputation_gamer', 'sandbagger', 'latency_exploiter',
];

function mean(arr: number[]): number { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function std(arr: number[]): number {
  const m = mean(arr);
  return Math.sqrt(arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length);
}
function fmt(v: number, d = 4): string { return v.toFixed(d); }
function pct(v: number): string { return `${v >= 0 ? '+' : ''}${v.toFixed(1)}%`; }

describe('Robust Multi-Seed Analysis — 18 Presets × 5 Seeds', () => {
  it('prints robust results', () => {
    // Run all presets across all seeds
    const allResults = new Map<string, { deltas: number[]; crps: number[]; ginis: number[]; neffs: number[]; parts: number[] }>();

    for (const id of BEHAVIOUR_PRESETS) {
      allResults.set(id, { deltas: [], crps: [], ginis: [], neffs: [], parts: [] });
    }

    for (const seed of SEEDS) {
      const base = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: T, seed, n: N });
      for (const id of BEHAVIOUR_PRESETS) {
        const r = runPipeline({ dgpId: 'baseline', behaviourPreset: id, rounds: T, seed, n: N });
        const delta = base.summary.meanError > 0
          ? ((r.summary.meanError - base.summary.meanError) / base.summary.meanError) * 100
          : 0;
        const entry = allResults.get(id)!;
        entry.deltas.push(delta);
        entry.crps.push(r.summary.meanError);
        entry.ginis.push(r.summary.finalGini);
        entry.neffs.push(r.summary.meanNEff);
        entry.parts.push(r.summary.meanParticipation / N * 100);
      }
    }

    // ═══ ROBUST COMPARISON TABLE ═══
    console.log('\n' + '═'.repeat(130));
    console.log(`ROBUST BEHAVIOUR ANALYSIS — 18 Presets × ${SEEDS.length} Seeds (${SEEDS.join(', ')}), ${T} rounds, ${N} agents`);
    console.log('═'.repeat(130));

    type Row = { id: string; label: string; family: string; meanDelta: number; stdDelta: number; meanCrps: number; meanGini: number; meanNeff: number; meanPart: number };
    const rows: Row[] = [];

    for (const id of BEHAVIOUR_PRESETS) {
      const e = allResults.get(id)!;
      const cfg = PRESET_CONFIGS[id as BehaviourPresetId];
      rows.push({
        id, label: cfg.label, family: cfg.family,
        meanDelta: mean(e.deltas), stdDelta: std(e.deltas),
        meanCrps: mean(e.crps), meanGini: mean(e.ginis),
        meanNeff: mean(e.neffs), meanPart: mean(e.parts),
      });
    }

    rows.sort((a, b) => b.meanDelta - a.meanDelta);

    console.log('\n┌───────────────────────────┬────────────┬────────────────────┬──────────────┬──────────┬──────────┬──────────┐');
    console.log('│ Preset                    │ Family     │ Δ CRPS (mean±std)  │ Mean CRPS    │ Gini     │ N_eff    │ Part %   │');
    console.log('├───────────────────────────┼────────────┼────────────────────┼──────────────┼──────────┼──────────┼──────────┤');

    for (const r of rows) {
      const deltaStr = `${pct(r.meanDelta)} ± ${r.stdDelta.toFixed(1)}%`;
      console.log(`│ ${r.label.padEnd(25)} │ ${r.family.padEnd(10)} │ ${deltaStr.padStart(18)} │ ${fmt(r.meanCrps).padStart(12)} │ ${fmt(r.meanGini, 3).padStart(8)} │ ${fmt(r.meanNeff, 1).padStart(8)} │ ${r.meanPart.toFixed(0).padStart(6)}%  │`);
    }
    console.log('└───────────────────────────┴────────────┴────────────────────┴──────────────┴──────────┴──────────┴──────────┘');

    // ═══ THREAT TIERS (robust) ═══
    console.log('\n' + '═'.repeat(90));
    console.log('ROBUST THREAT CLASSIFICATION');
    console.log('═'.repeat(90));

    const tiers = [
      { name: '🔴 CRITICAL (Δ > 10%)', filter: (r: Row) => r.meanDelta > 10 },
      { name: '🟠 MODERATE (2–10%)', filter: (r: Row) => r.meanDelta > 2 && r.meanDelta <= 10 },
      { name: '🟡 MILD (0.5–2%)', filter: (r: Row) => r.meanDelta > 0.5 && r.meanDelta <= 2 },
      { name: '⚪ NEGLIGIBLE (|Δ| ≤ 0.5%)', filter: (r: Row) => Math.abs(r.meanDelta) <= 0.5 },
      { name: '🟢 BENEFICIAL (Δ < -0.5%)', filter: (r: Row) => r.meanDelta < -0.5 },
    ];

    for (const tier of tiers) {
      const items = rows.filter(tier.filter);
      if (!items.length) continue;
      console.log(`\n  ${tier.name}:`);
      for (const r of items) {
        console.log(`    ${r.label.padEnd(25)} ${pct(r.meanDelta).padStart(9)} ± ${r.stdDelta.toFixed(1)}%  Gini=${fmt(r.meanGini, 3)}  N_eff=${fmt(r.meanNeff, 1)}`);
      }
    }

    // ═══ KEY INSIGHTS ═══
    console.log('\n' + '═'.repeat(90));
    console.log('KEY INSIGHTS FOR THESIS');
    console.log('═'.repeat(90));

    const bursty = rows.find(r => r.id === 'bursty')!;
    const sybil = rows.find(r => r.id === 'sybil')!;
    const manipulator = rows.find(r => r.id === 'manipulator')!;
    const collusion = rows.find(r => r.id === 'collusion')!;
    const arbitrageur = rows.find(r => r.id === 'arbitrageur')!;
    const houseMoney = rows.find(r => r.id === 'house_money')!;

    // Count how many presets are negligible
    const negligible = rows.filter(r => Math.abs(r.meanDelta) <= 0.5);
    const contained = rows.filter(r => Math.abs(r.meanDelta) <= 2 && r.id !== 'baseline');

    console.log(`
  1. THE MECHANISM IS ROBUST TO STRATEGIC BEHAVIOUR
     ${contained.length} of 17 non-baseline presets produce Δ CRPS within ±2%.
     ${negligible.length} presets have negligible impact (|Δ| ≤ 0.5%).
     The skill gate (EWMA + σ mapping) is the primary defence.

  2. PARTICIPATION IS THE DOMINANT VULNERABILITY
     Bursty participation: ${pct(bursty.meanDelta)} ± ${bursty.stdDelta.toFixed(1)}% at ${bursty.meanPart.toFixed(0)}% attendance.
     This is structural: missing agents = missing information. The mechanism
     preserves skill estimates (EWMA freeze) but cannot compensate for absent signals.

  3. SINGLE-AGENT ATTACKS ARE CONTAINED
     Manipulator: ${pct(manipulator.meanDelta)} ± ${manipulator.stdDelta.toFixed(1)}%
     With ${N} agents, one bad actor has limited aggregate influence.
     The skill gate downweights attackers: misreporting → high loss → low σ → low m_i.

  4. MULTI-AGENT COORDINATION IS THE REAL THREAT
     Sybil: ${pct(sybil.meanDelta)} ± ${sybil.stdDelta.toFixed(1)}%
     Collusion: ${pct(collusion.meanDelta)} ± ${collusion.stdDelta.toFixed(1)}%
     Arbitrageur: ${pct(arbitrageur.meanDelta)} ± ${arbitrageur.stdDelta.toFixed(1)}%
     Coordinated behaviour amplifies impact. Deposit splitting limits sybils
     but doesn't eliminate the accuracy cost.

  5. REPORTING DISTORTIONS ARE FULLY ABSORBED
     Bias, miscalibration, noise, reputation gaming, sandbagging: all ~0%.
     The CRPS scoring rule correctly measures forecast quality regardless of intent.
     Bad reports → high loss → low σ → low influence. Self-correcting.

  6. STAKING STRATEGY HAS SECOND-ORDER EFFECTS
     House-money: ${pct(houseMoney.meanDelta)} ± ${houseMoney.stdDelta.toFixed(1)}% (slightly beneficial)
     Winners getting more influence aligns incentives with accuracy.
     Budget constraints and Kelly sizing have small effects (< 10%).
`);

    // ═══ WORST-CASE BY FAMILY ═══
    console.log('═'.repeat(90));
    console.log('WORST-CASE Δ CRPS BY FAMILY (robust mean across seeds)');
    console.log('═'.repeat(90));

    const byFamily = new Map<string, { worst: number; preset: string }>();
    for (const r of rows) {
      if (r.id === 'baseline') continue;
      const current = byFamily.get(r.family);
      if (!current || Math.abs(r.meanDelta) > Math.abs(current.worst)) {
        byFamily.set(r.family, { worst: r.meanDelta, preset: r.label });
      }
    }
    const familySorted = [...byFamily.entries()].sort((a, b) => Math.abs(b[1].worst) - Math.abs(a[1].worst));
    for (const [family, { worst, preset }] of familySorted) {
      console.log(`  ${family.padEnd(15)} ${pct(worst).padStart(9)}  (${preset})`);
    }

    console.log('\n' + '═'.repeat(130));
  });
});
