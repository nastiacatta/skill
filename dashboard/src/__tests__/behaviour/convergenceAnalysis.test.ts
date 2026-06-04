/**
 * Weight convergence analysis: 3 agents, latent_fixed DGP, 500 rounds.
 * Shows how weights start at 1/3 and converge to the best forecaster.
 */
import { describe, it } from 'vitest';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';

const SEED = 42;
const N = 3;
const T = 500;

function fmt(v: number, d = 4): string { return v.toFixed(d); }

describe('Weight Convergence Analysis — 3 Agents', () => {
  it('prints convergence results', () => {
    const result = runPipeline({
      dgpId: 'latent_fixed',
      behaviourPreset: 'baseline',
      rounds: T,
      seed: SEED,
      n: N,
      builder: { influenceRule: 'skill_stake', depositPolicy: 'wealth_fraction' },
      mechanism: { omegaMax: 1.0 },
    });

    const traces = result.traces;
    const first = traces[0];
    const last = traces[traces.length - 1];

    console.log('\n' + '═'.repeat(80));
    console.log('WEIGHT CONVERGENCE — 3 Agents, latent_fixed DGP, 500 rounds');
    console.log('═'.repeat(80));

    // Initial state
    console.log('\n  INITIAL STATE (round 1):');
    for (let j = 0; j < N; j++) {
      console.log(`    F${j+1}: weight=${fmt(first.weights[j])}  σ=${fmt(first.sigma_t[j])}  deposit=${fmt(first.deposits[j], 2)}  m_eff=${fmt(first.effectiveWager[j])}`);
    }
    console.log(`    Equal weight: ${fmt(1/N)}`);

    // Final state
    console.log('\n  FINAL STATE (round 500):');
    for (let j = 0; j < N; j++) {
      console.log(`    F${j+1}: weight=${fmt(last.weights[j])}  σ=${fmt(last.sigma_t[j])}  deposit=${fmt(last.deposits[j], 2)}  m_eff=${fmt(last.effectiveWager[j])}  wealth=${fmt(result.finalState[j].wealth, 2)}`);
    }
    console.log(`    Equal weight: ${fmt(1/N)}`);

    // Weight trajectory at key milestones
    const milestones = [1, 10, 25, 50, 100, 200, 300, 400, 500];
    console.log('\n  WEIGHT TRAJECTORY:');
    console.log('  ┌─────────┬──────────┬──────────┬──────────┐');
    console.log('  │ Round   │ F1       │ F2       │ F3       │');
    console.log('  ├─────────┼──────────┼──────────┼──────────┤');
    for (const r of milestones) {
      if (r > traces.length) continue;
      const t = traces[r - 1];
      console.log(`  │ ${String(r).padStart(5)}   │ ${fmt(t.weights[0]).padStart(8)} │ ${fmt(t.weights[1]).padStart(8)} │ ${fmt(t.weights[2]).padStart(8)} │`);
    }
    console.log('  └─────────┴──────────┴──────────┴──────────┘');

    // σ trajectory at same milestones
    console.log('\n  SKILL (σ) TRAJECTORY:');
    console.log('  ┌─────────┬──────────┬──────────┬──────────┐');
    console.log('  │ Round   │ F1       │ F2       │ F3       │');
    console.log('  ├─────────┼──────────┼──────────┼──────────┤');
    for (const r of milestones) {
      if (r > traces.length) continue;
      const t = traces[r - 1];
      console.log(`  │ ${String(r).padStart(5)}   │ ${fmt(t.sigma_t[0]).padStart(8)} │ ${fmt(t.sigma_t[1]).padStart(8)} │ ${fmt(t.sigma_t[2]).padStart(8)} │`);
    }
    console.log('  └─────────┴──────────┴──────────┴──────────┘');

    // Concentration metrics
    console.log('\n  CONCENTRATION:');
    console.log(`    Final Gini:  ${fmt(result.summary.finalGini, 3)}`);
    console.log(`    Mean N_eff:  ${fmt(result.summary.meanNEff, 2)}`);
    console.log(`    Final HHI:   ${fmt(last.hhi)}`);
    console.log(`    Top share:   ${fmt(last.topShare)} (${(last.topShare * 100).toFixed(1)}%)`);

    // Who is the best forecaster?
    const bestIdx = last.weights.indexOf(Math.max(...last.weights));
    const worstIdx = last.weights.indexOf(Math.min(...last.weights));
    const bestWeight = last.weights[bestIdx];
    const worstWeight = last.weights[worstIdx];

    console.log('\n  CONVERGENCE VERDICT:');
    console.log(`    Best forecaster:  F${bestIdx+1} (weight ${fmt(bestWeight)}, σ=${fmt(last.sigma_t[bestIdx])})`);
    console.log(`    Worst forecaster: F${worstIdx+1} (weight ${fmt(worstWeight)}, σ=${fmt(last.sigma_t[worstIdx])})`);
    console.log(`    Weight ratio (best/worst): ${fmt(bestWeight / worstWeight, 1)}×`);
    console.log(`    Weight ratio (best/equal): ${fmt(bestWeight / (1/N), 1)}×`);

    // Speed of convergence: when does the best agent first exceed 40% weight?
    let convergeRound = -1;
    for (let i = 0; i < traces.length; i++) {
      if (traces[i].weights[bestIdx] > 0.4) {
        convergeRound = i + 1;
        break;
      }
    }
    console.log(`    Convergence speed: best agent exceeds 40% weight at round ${convergeRound > 0 ? convergeRound : 'never'}`);

    // Aggregate accuracy
    console.log('\n  AGGREGATE ACCURACY:');
    console.log(`    Mean CRPS:   ${fmt(result.summary.meanError)}`);

    // Compare to equal weighting
    const equalResult = runPipeline({
      dgpId: 'latent_fixed',
      behaviourPreset: 'baseline',
      rounds: T,
      seed: SEED,
      n: N,
      builder: { influenceRule: 'uniform', depositPolicy: 'wealth_fraction' },
      mechanism: { omegaMax: 1.0 },
    });
    const improvement = ((equalResult.summary.meanError - result.summary.meanError) / equalResult.summary.meanError) * 100;
    console.log(`    Equal-weight CRPS: ${fmt(equalResult.summary.meanError)}`);
    console.log(`    Improvement: ${improvement >= 0 ? '+' : ''}${improvement.toFixed(1)}% vs equal weighting`);

    console.log('\n' + '═'.repeat(80));
  });
});
