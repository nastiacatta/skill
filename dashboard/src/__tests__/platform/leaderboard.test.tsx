import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';

import LeaderboardPage from '@/pages/platform/LeaderboardPage';
import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { rollupPanel } from '@/components/platform/derivedMetrics';
import { outline, installReducedMotion } from '../_helpers/structuralSnapshot';

/**
 * O6 coverage for the marketplace leaderboard — the one brief-named hero
 * surface that `views.test.tsx` only renders and never drives. The board is a
 * FLIP-reordered table (`motion.tr layout="position"`) ranked by any column.
 *
 * Two protections:
 *   1. a structural snapshot of the ranked table (reduced-motion ON, so the
 *      FLIP layer paints its final state with no animation clock), locking the
 *      row set, the per-row account links, and the sort-control shape; and
 *   2. an interaction test of the sort flow: clicking a column header re-ranks
 *      the rows by that column (outcome asserted against the real rollup, not
 *      animation timing) and marks the chosen control selected.
 *
 * The board reads the same fixed seed-42 trace the live market view uses, so
 * the ordering is deterministic.
 */

beforeEach(() => installReducedMotion(true));
afterEach(cleanup);

/** The exact config LeaderboardPage runs (useMarketSimulation default, 80 rounds). */
function panelRollups() {
  const { traces } = runPipeline({
    dgpId: 'latent_fixed',
    behaviourPreset: 'baseline',
    weighting: 'full',
    rounds: 80,
    seed: 42,
    n: 6,
    mechanism: { lam: 0.3, eta: 1, sigma_min: 0.1 },
  });
  return rollupPanel(traces, 6);
}

function renderBoard() {
  return render(
    <MemoryRouter>
      <LeaderboardPage />
    </MemoryRouter>,
  );
}

/** Read the data-testid index out of each rendered row, top to bottom. */
function renderedOrder(): number[] {
  return Array.from(document.querySelectorAll('[data-testid^="leaderboard-row-"]')).map((el) =>
    Number((el.getAttribute('data-testid') ?? '').replace('leaderboard-row-', '')),
  );
}

describe('structural snapshot — leaderboard', () => {
  it('locks the ranked table head, the sort controls and the per-row account links', () => {
    renderBoard();
    // The table body holds the FLIP rows; the snapshot covers headers + rows +
    // the per-row colour swatch and account anchor, never inline geometry.
    expect(outline(screen.getByTestId('leaderboard-table'), { includeText: false })).toMatchSnapshot();
  });
});

describe('leaderboard — sort interaction (FLIP reorder, outcome not timing)', () => {
  it('renders one row per forecaster, ranked by skill by default', () => {
    renderBoard();
    const rollups = panelRollups();
    const bySigma = [...rollups].sort((a, b) => b.sigma - a.sigma).map((r) => r.index);
    expect(renderedOrder()).toEqual(bySigma);
  });

  it('re-ranks the rows when a different sort column is chosen', () => {
    renderBoard();
    const rollups = panelRollups();
    const byWealth = [...rollups].sort((a, b) => b.wealth - a.wealth).map((r) => r.index);

    fireEvent.click(screen.getByRole('button', { name: /sort by wealth/i }));

    // The DOM row order now follows wealth, descending — the visible outcome of
    // the FLIP reorder, asserted against the real rollup (no timing involved).
    expect(renderedOrder()).toEqual(byWealth);
  });

  it('marks the active sort control selected and the rest secondary', () => {
    renderBoard();
    const sigmaBtn = screen.getByRole('button', { name: 'Sort by Skill σ' });
    const wealthBtn = screen.getByRole('button', { name: 'Sort by Wealth W' });
    // Default sort is skill σ: that control is primary, the others secondary.
    expect(sigmaBtn.className).toContain('platform-btn--primary');
    expect(wealthBtn.className).toContain('platform-btn--secondary');

    fireEvent.click(wealthBtn);
    expect(screen.getByRole('button', { name: 'Sort by Wealth W' }).className).toContain('platform-btn--primary');
    expect(screen.getByRole('button', { name: 'Sort by Skill σ' }).className).toContain('platform-btn--secondary');
  });

  it('links every row to that forecaster account by seat', () => {
    renderBoard();
    for (const r of panelRollups()) {
      const row = within(screen.getByTestId(`leaderboard-row-${r.index}`));
      const link = row.getByRole('link');
      expect(link.getAttribute('href')).toBe(`#/platform/account?seat=${r.index}`);
    }
  });
});
