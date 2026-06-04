/**
 * Integration tests for AuditPage.
 *
 * Verifies:
 * - All 6 tab buttons render
 * - Tab switching changes the visible panel
 * - Loading state shows "Loading audit data…"
 * - Error banner shows when errors are present
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── Mutable mock state ─────────────────────────────────────────────────────

const mockAuditData = {
  comparison: null as ReturnType<typeof buildMockComparison> | null,
  baselines: null as Record<string, unknown> | null,
  depositSensitivity: null as Record<string, unknown> | null,
  loading: false,
  errors: [] as string[],
};

vi.mock('@/hooks/useAuditData', () => ({
  useAuditData: () => mockAuditData,
}));

// ── Mock Recharts (panels use charts internally) ───────────────────────────

vi.mock('recharts', () => {
  const Wrap = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', null, children);
  return {
    ResponsiveContainer: Wrap,
    LineChart: Wrap,
    BarChart: Wrap,
    Line: () => null,
    Bar: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
    ReferenceLine: () => null,
    Cell: () => null,
  };
});

import AuditPage from '@/pages/AuditPage';

// ── Helpers ────────────────────────────────────────────────────────────────

const TAB_NAMES = ['Theory', 'Models', 'Skill', 'Wagers', 'Aggregation', 'Improvements'] as const;

function buildMockComparison() {
  const forecasters = ['Naive', 'EWMA(5)', 'ARIMA(2,1,1)', 'XGBoost', 'Neural Net', 'Theta', 'Ensemble'];
  const nRounds = 200;
  const per_round = Array.from({ length: nRounds }, (_, i) => ({
    t: i,
    y: Math.random(),
    crps_uniform: 0.05,
    crps_skill: 0.045,
    crps_mechanism: 0.044,
    crps_best_single: 0.04,
  }));
  const per_agent_crps = Array.from({ length: nRounds }, () => {
    const row: Record<string, number> = {};
    for (const f of forecasters) row[f] = 0.03 + Math.random() * 0.04;
    return row;
  });
  const skill_history = Array.from({ length: nRounds }, () => {
    const row: Record<string, number> = {};
    for (const f of forecasters) row[f] = 0.3 + Math.random() * 0.5;
    return row;
  });
  const steady_state = forecasters.map((f, i) => ({
    forecaster: f,
    index: i,
    mean_sigma: 0.5 + i * 0.05,
    mean_weight: 1 / 7,
    mean_score: 0.04 + i * 0.002,
  }));
  const rows = [
    { experiment: 'test', method: 'uniform', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.055, delta_crps_vs_equal: 0 },
    { experiment: 'test', method: 'skill', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.048, delta_crps_vs_equal: -0.007 },
    { experiment: 'test', method: 'mechanism', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.0448, delta_crps_vs_equal: -0.0102 },
    { experiment: 'test', method: 'best_single', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.042, delta_crps_vs_equal: -0.013 },
    { experiment: 'test', method: 'oracle', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.0344, delta_crps_vs_equal: -0.0206 },
    { experiment: 'test', method: 'inverse_variance', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.047, delta_crps_vs_equal: -0.008 },
    { experiment: 'test', method: 'trimmed_mean', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.049, delta_crps_vs_equal: -0.006 },
    { experiment: 'test', method: 'median', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.050, delta_crps_vs_equal: -0.005 },
  ];
  const calibration = [
    { tau: 0.1, nominal: 0.1, empirical: 0.12, gap: 0.02 },
    { tau: 0.25, nominal: 0.25, empirical: 0.26, gap: 0.01 },
    { tau: 0.5, nominal: 0.5, empirical: 0.49, gap: -0.01 },
    { tau: 0.75, nominal: 0.75, empirical: 0.74, gap: -0.01 },
    { tau: 0.9, nominal: 0.9, empirical: 0.87, gap: -0.03 },
  ];
  return {
    config: { T: nRounds, n_forecasters: 7, warmup: 168, series_name: 'elia_wind', forecasters },
    rows,
    per_round,
    per_agent_crps,
    forecaster_names: forecasters,
    skill_history,
    steady_state,
    calibration,
  };
}

function buildMockBaselines() {
  return {
    config: {
      series: 'elia_wind',
      T: 17344,
      T_eval: 17344,
      n_forecasters: 7,
      forecaster_names: ['Naive', 'EWMA(5)', 'ARIMA(2,1,1)', 'XGBoost', 'Neural Net', 'Theta', 'Ensemble'],
      mechanism_params: { gamma: 16, rho: 0.5, lam: 0.1 },
      vitali_lr: 0.01,
      taus: [0.1, 0.25, 0.5, 0.75, 0.9],
    },
    summary: [
      { series: 'elia_wind', method: 'uniform', mean_crps: 0.055, delta_vs_uniform: 0, pct_vs_uniform: 0 },
      { series: 'elia_wind', method: 'mechanism', mean_crps: 0.0448, delta_vs_uniform: -0.0102, pct_vs_uniform: -18.5 },
      { series: 'elia_wind', method: 'vitali_ogd', mean_crps: 0.019, delta_vs_uniform: -0.036, pct_vs_uniform: -65.5 },
    ],
  };
}

function buildMockDepositSensitivity() {
  return {
    deposit_sensitivity: {
      fixed: { uniform: 0.055, skill: 0.048, mechanism: 0.044, delta_skill: -0.007, delta_mech: -0.011, pct_skill: -12.7, pct_mech: -20.0 },
      exponential: { uniform: 0.055, skill: 0.050, mechanism: 0.047, delta_skill: -0.005, delta_mech: -0.008, pct_skill: -9.1, pct_mech: -14.5 },
      bankroll: { uniform: 0.055, skill: 0.051, mechanism: 0.049, delta_skill: -0.004, delta_mech: -0.006, pct_skill: -7.3, pct_mech: -10.9 },
    },
  };
}

function renderPage(initialEntry = '/audit') {
  // AuditPage reads ?tab= via useQueryParamState, which needs router context.
  return render(
    createElement(
      MemoryRouter,
      { initialEntries: [initialEntry] },
      createElement(AuditPage),
    ),
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AuditPage integration', () => {
  beforeEach(() => {
    mockAuditData.comparison = buildMockComparison();
    mockAuditData.baselines = buildMockBaselines();
    mockAuditData.depositSensitivity = buildMockDepositSensitivity();
    mockAuditData.loading = false;
    mockAuditData.errors = [];
  });
  afterEach(() => {
    cleanup();
  });

  // ── Tab rendering ──────────────────────────────────────────────────────

  it('renders all 6 tab buttons', () => {
    renderPage();
    for (const name of TAB_NAMES) {
      expect(screen.getByRole('tab', { name })).toBeTruthy();
    }
  });

  // ── Tab switching ──────────────────────────────────────────────────────

  it('defaults to the Theory tab', () => {
    renderPage();
    // Theory tab should be active (aria-selected="true")
    const theoryBtn = screen.getByRole('tab', { name: 'Theory' });
    expect(theoryBtn.getAttribute('aria-selected')).toBe('true');
  });

  it('opens the deep-linked tab from ?tab=', () => {
    renderPage('/audit?tab=Skill');
    const skillBtn = screen.getByRole('tab', { name: 'Skill' });
    expect(skillBtn.getAttribute('aria-selected')).toBe('true');
    const theoryBtn = screen.getByRole('tab', { name: 'Theory' });
    expect(theoryBtn.getAttribute('aria-selected')).toBe('false');
  });

  it('falls back to the default tab for an invalid ?tab=', () => {
    renderPage('/audit?tab=NotARealTab');
    const theoryBtn = screen.getByRole('tab', { name: 'Theory' });
    expect(theoryBtn.getAttribute('aria-selected')).toBe('true');
  });

  it('switches to Models tab on click', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: 'Models' }));
    // Models tab should now be active
    const modelsBtn = screen.getByRole('tab', { name: 'Models' });
    expect(modelsBtn.getAttribute('aria-selected')).toBe('true');
    // Theory tab should be inactive
    const theoryBtn = screen.getByRole('tab', { name: 'Theory' });
    expect(theoryBtn.getAttribute('aria-selected')).toBe('false');
  });

  it('switches to each tab and shows the correct panel content', () => {
    renderPage();

    // Click Models tab — should show Forecaster ranking
    fireEvent.click(screen.getByRole('tab', { name: 'Models' }));
    expect(screen.getByText('Forecaster ranking')).toBeTruthy();

    // Click Skill tab — should show skill-related content
    fireEvent.click(screen.getByRole('tab', { name: 'Skill' }));
    expect(screen.getByText(/Sigma Bar Chart|Skill Allocation|Convergence/)).toBeTruthy();

    // Click Wagers tab — should show wager-related content
    fireEvent.click(screen.getByRole('tab', { name: 'Wagers' }));
    expect(screen.getByText('Effective wager breakdown')).toBeTruthy();

    // Click Aggregation tab — should show aggregation-related content
    fireEvent.click(screen.getByRole('tab', { name: 'Aggregation' }));
    expect(screen.getByText('Method comparison')).toBeTruthy();

    // Click Improvements tab — should show improvement-related content
    fireEvent.click(screen.getByRole('tab', { name: 'Improvements' }));
    expect(screen.getAllByText(/model|skill|aggregation|economic/i).length).toBeGreaterThan(0);

    // Click back to Theory tab
    fireEvent.click(screen.getByRole('tab', { name: 'Theory' }));
    expect(screen.getByText('Literature summary')).toBeTruthy();
  });

  it('shows tab counter indicator', () => {
    renderPage();
    expect(screen.getByText(/Tab 1 of 6: Theory/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Models' }));
    expect(screen.getByText(/Tab 2 of 6: Models/)).toBeTruthy();

    fireEvent.click(screen.getByRole('tab', { name: 'Improvements' }));
    expect(screen.getByText(/Tab 6 of 6: Improvements/)).toBeTruthy();
  });

  // ── Loading state ──────────────────────────────────────────────────────

  it('displays loading state when data is loading', () => {
    mockAuditData.loading = true;
    mockAuditData.comparison = null;
    renderPage();
    expect(screen.getByText('Loading audit data…')).toBeTruthy();
  });

  it('does not show panel content while loading', () => {
    mockAuditData.loading = true;
    mockAuditData.comparison = null;
    renderPage();
    // Tab buttons should still render
    expect(screen.getByRole('tab', { name: 'Theory' })).toBeTruthy();
    // But panel content should not be visible
    expect(screen.queryByText('Forecaster ranking')).toBeNull();
  });

  // ── Error handling ─────────────────────────────────────────────────────

  it('shows error banner when errors are present', () => {
    mockAuditData.errors = ['comparison.json: Failed to fetch'];
    renderPage();
    expect(screen.getByText('Some data files could not be loaded:')).toBeTruthy();
    expect(screen.getByText('comparison.json: Failed to fetch')).toBeTruthy();
  });

  it('shows multiple errors in the banner', () => {
    mockAuditData.errors = [
      'comparison.json: Failed to fetch',
      'baselines.json: 404 Not Found',
    ];
    renderPage();
    expect(screen.getByText('comparison.json: Failed to fetch')).toBeTruthy();
    expect(screen.getByText('baselines.json: 404 Not Found')).toBeTruthy();
  });

  it('does not show error banner when there are no errors', () => {
    mockAuditData.errors = [];
    renderPage();
    expect(screen.queryByText('Some data files could not be loaded:')).toBeNull();
  });

  // ── Page header ────────────────────────────────────────────────────────

  it('renders the page header', () => {
    renderPage();
    expect(screen.getByText('Performance audit')).toBeTruthy();
  });
});
