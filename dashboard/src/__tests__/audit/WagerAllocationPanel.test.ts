/**
 * Unit tests for WagerAllocationPanel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createElement } from 'react';

// ── Mock useAuditData ──────────────────────────────────────────────────────

const mockAuditData = {
  comparison: null as ReturnType<typeof buildMockComparison> | null,
  baselines: null,
  depositSensitivity: null,
  loading: false,
  errors: [],
};

vi.mock('@/hooks/useAuditData', () => ({
  useAuditData: () => mockAuditData,
}));

// ── Mock Recharts ──────────────────────────────────────────────────────────

vi.mock('recharts', () => {
  const Wrap = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', null, children);
  return {
    ResponsiveContainer: Wrap, BarChart: Wrap,
    Bar: () => null, XAxis: () => null, YAxis: () => null,
    Tooltip: () => null, CartesianGrid: () => null, Legend: () => null,
  };
});

import WagerAllocationPanel from '@/components/audit/WagerAllocationPanel';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildMockComparison(opts?: { highConcentration?: boolean }) {
  const forecasters = ['Naive', 'EWMA(5)', 'ARIMA(2,1,1)', 'XGBoost', 'Neural Net', 'Theta', 'Ensemble'];
  const steady_state = forecasters.map((f, i) => ({
    forecaster: f, index: i, mean_sigma: 0.5,
    mean_weight: opts?.highConcentration ? (i === 0 ? 0.9 : 0.1 / 6) : 1 / 7,
    mean_score: 0.05,
  }));
  return {
    config: { T: 200, n_forecasters: 7, warmup: 168, series_name: 'elia_wind', forecasters },
    rows: [], per_round: [], per_agent_crps: [], forecaster_names: forecasters,
    skill_history: [], steady_state,
  };
}

function renderPanel() {
  return render(createElement(WagerAllocationPanel));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('WagerAllocationPanel', () => {
  beforeEach(() => {
    mockAuditData.comparison = buildMockComparison();
  });
  afterEach(() => { cleanup(); });

  it('renders without errors with valid data', () => {
    renderPanel();
    expect(screen.getByText('Effective wager breakdown')).toBeTruthy();
    expect(screen.getByText('Concentration metrics')).toBeTruthy();
    // The normalised-weights bar and the standalone "Why fixed unit deposits"
    // section were removed in research_trim_v2 (M1 §2 GREEN). The fixed-deposit
    // rationale now reads as a one-line gloss beneath the concentration tiles.
    expect(screen.getByText(/Fixed unit deposits/)).toBeTruthy();
  });

  it('shows high-concentration warning when Gini > 0.5', () => {
    mockAuditData.comparison = buildMockComparison({ highConcentration: true });
    renderPanel();
    expect(screen.getByText(/High concentration warning/)).toBeTruthy();
  });

  it('does not show high-concentration warning when weights are equal', () => {
    // Use integer weights to avoid floating-point Gini artifacts
    const comp = buildMockComparison({ highConcentration: false });
    comp.steady_state = comp.steady_state.map((s) => ({ ...s, mean_weight: 1 }));
    mockAuditData.comparison = comp;
    renderPanel();
    expect(screen.queryByText(/High concentration warning/)).toBeNull();
  });

  it('shows unavailable message when comparison is null', () => {
    mockAuditData.comparison = null;
    renderPanel();
    expect(screen.getByText(/Wager allocation data unavailable/)).toBeTruthy();
  });

  it('displays Gini and N_eff metrics', () => {
    renderPanel();
    expect(screen.getAllByText('Gini coefficient').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Effective N').length).toBeGreaterThanOrEqual(1);
  });
});
