/**
 * One-shot analysis: run all 19 presets, print comparison table + mechanism metrics.
 */
import { describe, it } from 'vitest';
import { runPipeline, type PipelineResult } from '@/lib/coreMechanism/runPipeline';
import { ALL_PRESET_IDS } from '@/lib/behaviour/presetMeta';
import { PRESET_CONFIGS } from '@/lib/behaviour/presetMeta';
import { TAXONOMY_ITEMS } from '@/lib/behaviour/taxonomyData';
import type { BehaviourPresetId } from '@/lib/behaviour/hiddenAttributes';

const SEED = 42;
const N = 6;
const T = 300;

function fmt(v: number, d = 4): string {
  return v.toFixed(d);
}

function compare(test: PipelineResult, base: PipelineResult) {
  const d = test.summary.meanError - base.summary.meanError;
  const pct = base.summary.meanError > 0 ? (d / base.summary.meanError * 100) : 0;
  return { deltaAbs: d, deltaPct: pct };
}

function computeMetrics(test: PipelineResult, baseline: PipelineResult, attackerIdx: number, transitionRound?: number) {
  const rho = test.params.rho;
  const start = transitionRound ?? 0;
  let skillRecovery: number | null = null;
  for (let i = start; i < test.traces.length; i++) {
    if (test.traces[i].sigma_t[attackerIdx] < 0.5) { skillRecovery = i - start; break; }
  }
  const wealthPenalty = test.finalState[attackerIdx].wealth - baseline.finalState[attackerIdx].wealth;
  let contamination = 0;
  for (let i = start; i < Math.min(test.rounds.length, baseline.rounds.length); i++) {
    const d = Math.abs(test.rounds[i].error - baseline.rounds[i].error);
    if (d > contamination) contamination = d;
  }
  const giniImpact = test.summary.finalGini - baseline.summary.finalGini;
  return { skillRecovery, wealthPenalty, contamination, giniImpact, ewmaHalfLife: Math.log(2) / rho };
}

describe('Full Analysis — All 19 Presets', () => {
  it('prints comparison table and mechanism metrics', () => {
    const baseline = runPipeline({ dgpId: 'baseline', behaviourPreset: 'baseline', rounds: T, seed: SEED, n: N });

    console.log('\n' + '═'.repeat(120));
    console.log('BEHAVIOUR ANALYSIS RESULTS — 19 Presets, 300 rounds, 6 agents, seed 42');
    console.log('═'.repeat(120));
    console.log('');

    // ── Cross-behaviour comparison table ──
    console.log('┌─────────────────────────┬────────────┬──────────────┬──────────┬──────────┬──────────┬──────────────┐');
    console.log('│ Preset                  │ Family     │ Mean CRPS    │ Δ CRPS % │ Gini     │ N_eff    │ Participation│');
    console.log('├─────────────────────────┼────────────┼──────────────┼──────────┼──────────┼──────────┼──────────────┤');

    const rows: Array<{ id: string; label: string; family: string; crps: number; delta: number; gini: number; neff: number; part: number }> = [];

    for (const id of ALL_PRESET_IDS) {
      const result = runPipeline({ dgpId: 'baseline', behaviourPreset: id, rounds: T, seed: SEED, n: N });
      const cfg = PRESET_CONFIGS[id];
      const { deltaPct } = compare(result, baseline);
      rows.push({
        id,
        label: cfg.label,
        family: cfg.family,
        crps: result.summary.meanError,
        delta: deltaPct,
        gini: result.summary.finalGini,
        neff: result.summary.meanNEff,
        part: result.summary.meanParticipation / N * 100,
      });
    }

    // Sort by delta descending (most damaging first)
    rows.sort((a, b) => b.delta - a.delta);

    for (const r of rows) {
      const sign = r.delta >= 0 ? '+' : '';
      const label = r.label.padEnd(23);
      const family = r.family.padEnd(10);
      console.log(`│ ${label} │ ${family} │ ${fmt(r.crps)}       │ ${(sign + r.delta.toFixed(1) + '%').padStart(8)} │ ${fmt(r.gini, 3).padStart(8)} │ ${fmt(r.neff, 1).padStart(8)} │ ${(r.part.toFixed(0) + '%').padStart(12)} │`);
    }
    console.log('└─────────────────────────┴────────────┴──────────────┴──────────┴──────────┴──────────┴──────────────┘');

    // ── Mechanism response metrics for adversarial presets ──
    console.log('\n' + '═'.repeat(100));
    console.log('MECHANISM RESPONSE METRICS — Adversarial & Identity Presets');
    console.log('═'.repeat(100));

    const adversarial: Array<{ id: BehaviourPresetId; attackerIdx: number; transition?: number }> = [
      { id: 'manipulator', attackerIdx: 0 },
      { id: 'arbitrageur', attackerIdx: N - 1 },
      { id: 'evader', attackerIdx: 0 },
      { id: 'sybil', attackerIdx: 0 },
      { id: 'collusion', attackerIdx: 0 },
      { id: 'reputation_reset', attackerIdx: 0, transition: 100 },
      { id: 'reputation_gamer', attackerIdx: 0 },
      { id: 'biased', attackerIdx: 0 },
      { id: 'miscalibrated', attackerIdx: 0 },
      { id: 'latency_exploiter', attackerIdx: 0 },
    ];

    console.log('┌─────────────────────────┬──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐');
    console.log('│ Preset                  │ σ Recovery   │ Wealth Δ     │ Peak Contam. │ Δ Gini       │ EWMA t½      │');
    console.log('├─────────────────────────┼──────────────┼──────────────┼──────────────┼──────────────┼──────────────┤');

    for (const { id, attackerIdx, transition } of adversarial) {
      const result = runPipeline({ dgpId: 'baseline', behaviourPreset: id, rounds: T, seed: SEED, n: N });
      const m = computeMetrics(result, baseline, attackerIdx, transition);
      const label = PRESET_CONFIGS[id].label.padEnd(23);
      const recovery = m.skillRecovery !== null ? `${m.skillRecovery} rds`.padStart(12) : '     never'.padStart(12);
      console.log(`│ ${label} │ ${recovery} │ ${fmt(m.wealthPenalty, 2).padStart(12)} │ ${fmt(m.contamination).padStart(12)} │ ${fmt(m.giniImpact, 4).padStart(12)} │ ${fmt(m.ewmaHalfLife, 1).padStart(12)} │`);
    }
    console.log('└─────────────────────────┴──────────────┴──────────────┴──────────────┴──────────────┴──────────────┘');

    // ── Worst-case by family ──
    console.log('\n' + '═'.repeat(60));
    console.log('WORST-CASE Δ CRPS BY FAMILY');
    console.log('═'.repeat(60));

    const byFamily = new Map<string, { worst: number; preset: string }>();
    for (const r of rows) {
      const current = byFamily.get(r.family);
      if (!current || Math.abs(r.delta) > Math.abs(current.worst)) {
        byFamily.set(r.family, { worst: r.delta, preset: r.label });
      }
    }
    const familySorted = [...byFamily.entries()].sort((a, b) => Math.abs(b[1].worst) - Math.abs(a[1].worst));
    for (const [family, { worst, preset }] of familySorted) {
      const sign = worst >= 0 ? '+' : '';
      console.log(`  ${family.padEnd(15)} ${(sign + worst.toFixed(1) + '%').padStart(8)}  (${preset})`);
    }

    // ── Sybil resistance ──
    console.log('\n' + '═'.repeat(60));
    console.log('SYBIL RESISTANCE');
    console.log('═'.repeat(60));
    const sybilResult = runPipeline({ dgpId: 'baseline', behaviourPreset: 'sybil', rounds: T, seed: SEED, n: N });
    const sybilPairWealth = sybilResult.finalState.slice(0, 2).reduce((a, s) => a + s.wealth, 0);
    const baselinePairWealth = baseline.finalState.slice(0, 2).reduce((a, s) => a + s.wealth, 0);
    const ratio = baselinePairWealth > 0 ? sybilPairWealth / baselinePairWealth : 1;
    console.log(`  Clone pair wealth ratio: ${fmt(ratio, 3)} (≤1.05 = resistant)`);
    console.log(`  Verdict: ${ratio <= 1.05 ? '✅ SYBIL-RESISTANT' : '❌ NOT SYBIL-RESISTANT'}`);

    // ── Budget ruin ──
    console.log('\n' + '═'.repeat(60));
    console.log('BUDGET CONSTRAINT RUIN');
    console.log('═'.repeat(60));
    const budgetResult = runPipeline({ dgpId: 'baseline', behaviourPreset: 'budget_constrained', rounds: T, seed: SEED, n: N });
    const ruined = budgetResult.finalState.filter((a, i) => i < 3 && a.wealth < 0.1);
    console.log(`  Agents ruined (wealth < 0.1): ${ruined.length} / 3 budget-constrained agents`);
    for (let i = 0; i < 3; i++) {
      console.log(`    Agent ${i}: final wealth = ${fmt(budgetResult.finalState[i].wealth, 2)}`);
    }

    // ── Coverage summary ──
    console.log('\n' + '═'.repeat(60));
    console.log('TAXONOMY COVERAGE');
    console.log('═'.repeat(60));
    const exp = TAXONOMY_ITEMS.filter(i => i.status === 'experiment').length;
    const tax = TAXONOMY_ITEMS.filter(i => i.status === 'taxonomy-only').length;
    const nc = TAXONOMY_ITEMS.filter(i => i.status === 'not-covered').length;
    console.log(`  Total items: ${TAXONOMY_ITEMS.length}`);
    console.log(`  Experiment-backed: ${exp} (${(exp / TAXONOMY_ITEMS.length * 100).toFixed(1)}%)`);
    console.log(`  Taxonomy-only: ${tax}`);
    console.log(`  Not covered: ${nc}`);

    console.log('\n' + '═'.repeat(120));
  });
});
