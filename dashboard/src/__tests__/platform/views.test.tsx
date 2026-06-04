import { render, screen, cleanup, within } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactElement } from 'react';

import PlatformLandingPage from '@/pages/platform/PlatformLandingPage';
import MarketPage from '@/pages/platform/MarketPage';
import AccountPage from '@/pages/platform/AccountPage';
import LeaderboardPage from '@/pages/platform/LeaderboardPage';
import OperatorPage from '@/pages/platform/OperatorPage';

import { runPipeline } from '@/lib/coreMechanism/runPipeline';
import { rollupForecaster } from '@/components/platform/derivedMetrics';

afterEach(cleanup);

function renderRouted(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

/** The market views all run this exact config; mirror it to assert on traces. */
function marketTraces(rounds = 80) {
  return runPipeline({
    dgpId: 'latent_fixed',
    behaviourPreset: 'baseline',
    weighting: 'full',
    rounds,
    seed: 42,
    n: 6,
    mechanism: { lam: 0.3, eta: 1, sigma_min: 0.1 },
  });
}

describe('platform — landing page', () => {
  it('renders the hero and the live aggregate fan', () => {
    renderRouted(<PlatformLandingPage />);
    expect(screen.getByRole('heading', { name: /pay for forecast quality/i })).toBeDefined();
    expect(screen.getByTestId('landing-aggregate-fan')).toBeDefined();
  });

  it('shows the active forecaster count from the trace it consumes', () => {
    renderRouted(<PlatformLandingPage />);
    // Landing uses a 40-round run and reads trace index min(24, len-1) = 24.
    const trace = marketTraces(40).traces[24];
    // The "Forecasters this round" stat must equal that trace's activeCount.
    const labels = screen.getAllByText('Forecasters this round');
    expect(labels.length).toBeGreaterThan(0);
    expect(screen.getAllByText(String(trace.activeCount)).length).toBeGreaterThan(0);
  });
});

describe('platform — market page', () => {
  it('renders the market floor and transport', () => {
    renderRouted(<MarketPage />);
    expect(screen.getByTestId('market-floor')).toBeDefined();
    expect(screen.getByTestId('transport-toggle')).toBeDefined();
  });

  it('shows the effective-count N_eff equal to the trace at round 0', () => {
    renderRouted(<MarketPage />);
    const trace = marketTraces(80).traces[0];
    // N_eff stat tile renders nEff.toFixed(2).
    expect(screen.getAllByText(trace.nEff.toFixed(2)).length).toBeGreaterThan(0);
  });
});

describe('platform — account page', () => {
  it('renders bankroll, skill and calibration views', () => {
    renderRouted(<AccountPage />);
    expect(screen.getByTestId('bankroll-chart')).toBeDefined();
    expect(screen.getByTestId('reliability-diagram')).toBeDefined();
  });

  it('shows seat 0 wealth equal to the rollup of the trace it consumes', () => {
    renderRouted(<AccountPage />);
    const rollup = rollupForecaster(marketTraces(80).traces, 0);
    // Wealth stat tile renders wealth.toFixed(2).
    expect(screen.getAllByText(rollup.wealth.toFixed(2)).length).toBeGreaterThan(0);
  });
});

describe('platform — leaderboard page', () => {
  it('renders a sortable table with one row per forecaster', () => {
    renderRouted(<LeaderboardPage />);
    const table = screen.getByTestId('leaderboard-table');
    expect(table).toBeDefined();
    for (let i = 0; i < 6; i++) {
      expect(screen.getByTestId(`leaderboard-row-${i}`)).toBeDefined();
    }
  });

  it('shows each forecaster final skill σ equal to the trace rollup', () => {
    renderRouted(<LeaderboardPage />);
    const traces = marketTraces(80).traces;
    // Default sort is by σ; the top row's σ cell must equal the max rollup σ.
    const rollups = Array.from({ length: 6 }, (_, i) => rollupForecaster(traces, i));
    const topSigma = Math.max(...rollups.map((r) => r.sigma));
    const topRow = within(screen.getByTestId('leaderboard-row-' + rollups.findIndex((r) => r.sigma === topSigma)));
    expect(topRow.getAllByText(topSigma.toFixed(3)).length).toBeGreaterThan(0);
  });
});

describe('platform — operator page', () => {
  it('renders the mechanism-vs-uniform CRPS chart and published fan', () => {
    renderRouted(<OperatorPage />);
    expect(screen.getByTestId('operator-crps-chart')).toBeDefined();
    expect(screen.getByTestId('operator-published-fan')).toBeDefined();
  });

  it('shows HHI equal to the last mechanism trace', () => {
    renderRouted(<OperatorPage />);
    const mech = runPipeline({ dgpId: 'latent_fixed', behaviourPreset: 'baseline', weighting: 'full', rounds: 80, seed: 42, n: 6 });
    const last = mech.traces[mech.traces.length - 1];
    expect(screen.getAllByText(last.hhi.toFixed(3)).length).toBeGreaterThan(0);
  });
});
