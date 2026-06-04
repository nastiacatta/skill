/**
 * Core mechanism weight recovery: does the EWMA skill → σ → effective wager
 * pipeline recover the true structural weights [0.8, 0.1, 0.5] from the
 * aggregation_method1 DGP?
 *
 * This is the key thesis claim: the mechanism learns who is good without
 * being told the true weights.
 */
import { describe, it } from 'vitest';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';

function fmt(v: number, d = 4): string { return v.toFixed(d); }

describe('Core Mechanism Weight Recovery — True w = [0.8, 0.1, 0.5]', () => {
  it('prints weight recovery analysis', () => {
    const TRUE_W = [0.8, 0.1, 0.5];
    const N = 3;
    const SEED = 42;

    // Normalised true weights (what the mechanism should converge to)
    const wSum = TRUE_W.reduce((a, b) => a + b, 0);
    const TRUE_W_NORM = TRUE_W.map(w => w / wSum);

    console.log('\n' + '═'.repeat(90));
    console.log('CORE MECHANISM WEIGHT RECOVERY');
    console.log(`True structural weights: [${TRUE_W.join(', ')}]`);
    console.log(`Normalised target:       [${TRUE_W_NORM.map(w => fmt(w, 3)).join(', ')}]`);
    console.log('═'.repeat(90));

    // Run at different horizons to show convergence over time
    const horizons = [100, 300, 500, 1000, 2000, 5000];

    console.log('\n  WEIGHT CONVERGENCE OVER TIME:');
    console.log('  ┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐');
    console.log('  │ Rounds   │ F1 (0.8) │ F2 (0.1) │ F3 (0.5) │ MAE      │ Rank OK? │');
    console.log('  ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');
    console.log(`  │ Target   │ ${fmt(TRUE_W_NORM[0], 3).padStart(8)} │ ${fmt(TRUE_W_NORM[1], 3).padStart(8)} │ ${fmt(TRUE_W_NORM[2], 3).padStart(8)} │          │          │`);
    console.log('  ├──────────┼──────────┼──────────┼──────────┼──────────┼──────────┤');

    for (const T of horizons) {
      const result = runPipeline({
        dgpId: 'aggregation_method1',
        behaviourPreset: 'baseline',
        rounds: T,
        seed: SEED,
        n: N,
        builder: { influenceRule: 'skill_stake', depositPolicy: 'wealth_fraction' },
        mechanism: { omegaMax: 1.0 },
      });

      const lastTrace = result.traces[result.traces.length - 1];
      const weights = lastTrace.weights;

      // MAE vs normalised true weights
      const mae = weights.reduce((s, w, i) => s + Math.abs(w - TRUE_W_NORM[i]), 0) / N;

      // Check if rank ordering is correct: F1 > F3 > F2
      const rankCorrect = weights[0] > weights[2] && weights[2] > weights[1];

      console.log(`  │ ${String(T).padStart(6)}   │ ${fmt(weights[0], 3).padStart(8)} │ ${fmt(weights[1], 3).padStart(8)} │ ${fmt(weights[2], 3).padStart(8)} │ ${fmt(mae, 4).padStart(8)} │ ${rankCorrect ? '   ✅   ' : '   ❌   '} │`);
    }
    console.log('  └──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘');

    // Detailed analysis at T=5000
    const longRun = runPipeline({
      dgpId: 'aggregation_method1',
      behaviourPreset: 'baseline',
      rounds: 5000,
      seed: SEED,
      n: N,
      builder: { influenceRule: 'skill_stake', depositPolicy: 'wealth_fraction' },
      mechanism: { omegaMax: 1.0 },
    });

    const lastT = longRun.traces[longRun.traces.length - 1];

    console.log('\n  DETAILED STATE AT T=5000:');
    for (let j = 0; j < N; j++) {
      console.log(`    F${j+1}: weight=${fmt(lastT.weights[j])}  σ=${fmt(lastT.sigma_t[j])}  wealth=${fmt(longRun.finalState[j].wealth, 2)}  true_w=${TRUE_W[j]}`);
    }

    // σ trajectory at milestones
    const milestones = [1, 10, 50, 100, 500, 1000, 2000, 5000];
    console.log('\n  σ TRAJECTORY (skill estimates):');
    console.log('  ┌──────────┬──────────┬──────────┬──────────┐');
    console.log('  │ Round    │ F1 (0.8) │ F2 (0.1) │ F3 (0.5) │');
    console.log('  ├──────────┼──────────┼──────────┼──────────┤');
    for (const r of milestones) {
      if (r > longRun.traces.length) continue;
      const t = longRun.traces[r - 1];
      console.log(`  │ ${String(r).padStart(6)}   │ ${fmt(t.sigma_t[0]).padStart(8)} │ ${fmt(t.sigma_t[1]).padStart(8)} │ ${fmt(t.sigma_t[2]).padStart(8)} │`);
    }
    console.log('  └──────────┴──────────┴──────────┴──────────┘');

    // Weight trajectory at milestones
    console.log('\n  WEIGHT TRAJECTORY:');
    console.log('  ┌──────────┬──────────┬──────────┬──────────┐');
    console.log('  │ Round    │ F1 (0.8) │ F2 (0.1) │ F3 (0.5) │');
    console.log('  ├──────────┼──────────┼──────────┼──────────┤');
    for (const r of milestones) {
      if (r > longRun.traces.length) continue;
      const t = longRun.traces[r - 1];
      console.log(`  │ ${String(r).padStart(6)}   │ ${fmt(t.weights[0]).padStart(8)} │ ${fmt(t.weights[1]).padStart(8)} │ ${fmt(t.weights[2]).padStart(8)} │`);
    }
    console.log('  └──────────┴──────────┴──────────┴──────────┘');
    console.log(`  Target:     │ ${fmt(TRUE_W_NORM[0]).padStart(8)} │ ${fmt(TRUE_W_NORM[1]).padStart(8)} │ ${fmt(TRUE_W_NORM[2]).padStart(8)} │`);

    // Compare to equal weighting
    const equalRun = runPipeline({
      dgpId: 'aggregation_method1',
      behaviourPreset: 'baseline',
      rounds: 5000,
      seed: SEED,
      n: N,
      builder: { influenceRule: 'uniform', depositPolicy: 'wealth_fraction' },
      mechanism: { omegaMax: 1.0 },
    });

    const improvement = ((equalRun.summary.meanError - longRun.summary.meanError) / equalRun.summary.meanError) * 100;
    console.log(`\n  ACCURACY:`)
    console.log(`    Mechanism CRPS:    ${fmt(longRun.summary.meanError)}`);
    console.log(`    Equal-weight CRPS: ${fmt(equalRun.summary.meanError)}`);
    console.log(`    Improvement:       ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}%`);

    // Multi-seed robustness
    console.log('\n  MULTI-SEED ROBUSTNESS (T=2000):');
    const seeds = [42, 137, 271, 503, 997];
    const allMae: number[] = [];
    const allRankOk: boolean[] = [];

    for (const s of seeds) {
      const r = runPipeline({
        dgpId: 'aggregation_method1',
        behaviourPreset: 'baseline',
        rounds: 2000,
        seed: s,
        n: N,
        builder: { influenceRule: 'skill_stake', depositPolicy: 'wealth_fraction' },
        mechanism: { omegaMax: 1.0 },
      });
      const w = r.traces[r.traces.length - 1].weights;
      const mae = w.reduce((sum, wi, i) => sum + Math.abs(wi - TRUE_W_NORM[i]), 0) / N;
      const rankOk = w[0] > w[2] && w[2] > w[1];
      allMae.push(mae);
      allRankOk.push(rankOk);
      console.log(`    Seed ${String(s).padStart(3)}: w=[${w.map(v => fmt(v, 3)).join(', ')}]  MAE=${fmt(mae)}  Rank=${rankOk ? '✅' : '❌'}`);
    }

    const meanMae = allMae.reduce((a, b) => a + b, 0) / allMae.length;
    const rankRate = allRankOk.filter(Boolean).length / allRankOk.length;
    console.log(`    Mean MAE: ${fmt(meanMae)}  Rank correct: ${(rankRate * 100).toFixed(0)}%`);

    console.log('\n' + '═'.repeat(90));
  });
});
