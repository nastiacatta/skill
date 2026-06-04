import { describe, it } from 'vitest';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';

function fmt(v: number, d = 4): string { return v.toFixed(d); }

describe('Fixed-unit weight convergence', () => {
  it('prints results', () => {
    const r = runPipeline({
      dgpId: 'latent_fixed', behaviourPreset: 'baseline', rounds: 500, seed: 42, n: 3,
      builder: { influenceRule: 'skill_stake', depositPolicy: 'fixed_unit' },
      mechanism: { omegaMax: 1.0 },
    });
    const milestones = [1, 10, 50, 100, 200, 300, 500];
    console.log('\nFixed-unit deposits, omegaMax=1.0, 3 agents, latent_fixed:');
    console.log('Round  | F1 weight | F2 weight | F3 weight | F1 σ    | F2 σ    | F3 σ');
    for (const rd of milestones) {
      const t = r.traces[rd - 1];
      console.log(`${String(rd).padStart(5)}  | ${fmt(t.weights[0]).padStart(9)} | ${fmt(t.weights[1]).padStart(9)} | ${fmt(t.weights[2]).padStart(9)} | ${fmt(t.sigma_t[0]).padStart(7)} | ${fmt(t.sigma_t[1]).padStart(7)} | ${fmt(t.sigma_t[2]).padStart(7)}`);
    }
    // Also show the effective wager chain for round 500
    const last = r.traces[499];
    console.log('\nRound 500 chain:');
    for (let j = 0; j < 3; j++) {
      console.log(`  F${j+1}: deposit=${fmt(last.deposits[j],2)}  g(σ)=${fmt(0.3 + 0.7 * Math.pow(last.sigma_t[j], 1))}  m_eff=${fmt(last.effectiveWager[j])}  weight=${fmt(last.weights[j])}`);
    }
  });
});
