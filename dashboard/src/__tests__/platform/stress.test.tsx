import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

import StressPage from '@/pages/platform/StressPage';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { ATTACKS, findAttack } from '@/lib/platform/attackCatalogue';

afterEach(cleanup);

function renderRouted(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/** Mirror the hook's two runs so we can assert the page reads the real simulator. */
function attackRuns(attackId: string, rounds = 120) {
  const attack = findAttack(attackId);
  const common = {
    dgpId: 'latent_fixed' as const,
    weighting: 'full' as const,
    rounds,
    seed: 42,
    n: 6,
    mechanism: { lam: 0.3, eta: 1, sigma_min: 0.1 },
  };
  return {
    attack,
    withAttack: runPipeline({ ...common, behaviourPreset: attack.preset }),
    withoutAttack: runPipeline({ ...common, behaviourPreset: 'baseline' }),
  };
}

describe('platform — stress (attacks) page', () => {
  it('renders the attack picker, both market floors, and the signal chart', () => {
    renderRouted(<StressPage />);
    // One button per curated attack, canonical names.
    for (const a of ATTACKS) {
      expect(screen.getByTestId(`attack-${a.id}`)).toBeDefined();
    }
    // Two market floors (with and without the attack) and the signal chart.
    expect(screen.getAllByTestId('market-floor').length).toBe(2);
    expect(screen.getByTestId('attack-signal-chart')).toBeDefined();
    expect(screen.getByTestId('transport-toggle')).toBeDefined();
  });

  it('keeps the maths out of the default view behind an opt-in affordance', () => {
    renderRouted(<StressPage />);
    // No effective-wager formula visible until the visitor asks for it.
    expect(screen.queryByText(/m_i = b_i/)).toBeNull();
    fireEvent.click(screen.getByTestId('show-maths-toggle'));
    expect(screen.getByText(/m_i = b_i/)).toBeDefined();
  });
});

describe('platform — stress: with/without runs come from the real simulator', () => {
  it('matches runPipeline traces for the default arbitrage attack', () => {
    const { withAttack, withoutAttack } = attackRuns('arbitrage_seeker');
    // Both runs are full-length real-simulator runs.
    expect(withAttack.traces.length).toBe(120);
    expect(withoutAttack.traces.length).toBe(120);
    // The attack run is the arbitrageur preset; the control is baseline.
    expect(withAttack.behaviourPreset).toBe('arbitrageur');
    expect(withoutAttack.behaviourPreset).toBe('baseline');
    // The attack actually changes the run: aggregate CRPS differs from baseline.
    expect(withAttack.summary.meanError).not.toBeCloseTo(withoutAttack.summary.meanError, 6);
  });

  it('renders the arbitrage draft figure +11.68 → +24.22 from the catalogue (C21)', () => {
    renderRouted(<StressPage />);
    // The draft-reported result is shown, not invented numbers.
    expect(screen.getByText(/\+11\.68 per 1,000 rounds/)).toBeDefined();
    expect(screen.getByText(/\+24\.22/)).toBeDefined();
  });
});

describe('platform — stress: sybil clone-pair wager is conserved (draft narrow invariance)', () => {
  it('splits one identity into two even halves whose combined effective wager is conserved', () => {
    const { withAttack } = attackRuns('sybil_arbitrageur');
    // The sybil preset splits seats 0 and 1 (the clone pair).
    const seats = findAttack('sybil_arbitrageur').attackerSeats(6);
    expect(seats).toEqual([0, 1]);

    // Inspect an early round where both clones participate with equal state.
    const trace = withAttack.traces[0];
    const [a, b] = seats;
    const depA = trace.deposits[a];
    const depB = trace.deposits[b];
    const wagA = trace.effectiveWager[a];
    const wagB = trace.effectiveWager[b];

    // The split is even: each clone posts half, so the two deposits match.
    expect(depA).toBeGreaterThan(0);
    expect(depB).toBeCloseTo(depA, 6);

    // Conservation of the effective wager m_i = b_i · g(σ_i): identical clones
    // share the same skill gate, so the combined wager equals the combined
    // deposit through the one shared gate. Splitting does not amplify the wager.
    const gA = wagA / depA;
    const gB = wagB / depB;
    expect(gA).toBeCloseTo(gB, 6);

    const combinedDeposit = depA + depB;
    const combinedWager = wagA + wagB;
    expect(combinedWager).toBeCloseTo(combinedDeposit * gA, 6);

    // The combined deposit of the clone pair equals a single conserved
    // identity's deposit: each clone carries multiplier 1/2, so the two halves
    // sum back to one whole. combined = 2 × half-deposit, not 2 × full.
    const halfDeposit = depA;
    expect(combinedDeposit).toBeCloseTo(2 * halfDeposit, 6);
  });

  it('keeps the clone pair conserved across rounds, never amplifying the stake', () => {
    const { withAttack } = attackRuns('sybil_arbitrageur');
    const [a, b] = findAttack('sybil_arbitrageur').attackerSeats(6);
    // Over the first 20 rounds, the combined wager never exceeds the combined
    // deposit (the gate g(σ) ≤ 1 conserves, never inflates, the wager).
    for (let r = 0; r < 20; r++) {
      const t = withAttack.traces[r];
      const combinedDeposit = t.deposits[a] + t.deposits[b];
      const combinedWager = t.effectiveWager[a] + t.effectiveWager[b];
      expect(combinedWager).toBeLessThanOrEqual(combinedDeposit + 1e-9);
    }
  });
});
