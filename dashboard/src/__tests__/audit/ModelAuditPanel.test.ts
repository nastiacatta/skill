/**
 * Unit tests for ModelAuditPanel.
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
  };
});

import ModelAuditPanel from '@/components/audit/ModelAuditPanel';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildMockComparison(nRounds = 200) {
  const forecasters = ['Naive', 'EWMA(5)', 'ARIMA(2,1,1)', 'XGBoost', 'Neural Net', 'Theta', 'Ensemble'];
  const per_round = Array.from({ length: nRounds }, (_, i) => ({
    t: i, y: Math.random(),
    crps_uniform: 0.05, crps_skill: 0.045, crps_mechanism: 0.044, crps_best_single: 0.04,
  }));
  const per_agent_crps = Array.from({ length: nRounds }, () => {
    const row: Record<string, number> = {};
    for (const f of forecasters) row[f] = 0.03 + Math.random() * 0.04;
    return row;
  });
  return {
    config: { T: nRounds, n_forecasters: 7, warmup: 168, series_name: 'elia_wind', forecasters },
    rows: [
      { experiment: 'test', method: 'uniform', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.05, delta_crps_vs_equal: 0 },
    ],
    per_round, per_agent_crps, forecaster_names: forecasters, skill_history: [], steady_state: [],
  };
}

function renderPanel() {
  return render(createElement(ModelAuditPanel));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('ModelAuditPanel', () => {
  beforeEach(() => { mockAuditData.comparison = buildMockComparison(200); });
  afterEach(() => { cleanup(); });

  it('renders without errors with valid data', () => {
    renderPanel();
    expect(screen.getByText('Forecaster ranking')).toBeTruthy();
    expect(screen.getByText('Per-round CRPS')).toBeTruthy();
    expect(screen.getByText('Regime breakdown')).toBeTruthy();
    expect(screen.getByText('Model annotations')).toBeTruthy();
    expect(screen.getByText('XGBoost deep dive')).toBeTruthy();
  });

  it('displays all 7 forecasters', () => {
    renderPanel();
    for (const f of ['Naive', 'EWMA(5)', 'ARIMA(2,1,1)', 'XGBoost', 'Neural Net', 'Theta', 'Ensemble']) {
      expect(screen.getAllByText(f, { exact: false }).length).toBeGreaterThanOrEqual(1);
    }
  });

  it('shows sample-size warning when rounds < 100', () => {
    mockAuditData.comparison = buildMockComparison(50);
    renderPanel();
    expect(screen.getByText(/Sample size warning/)).toBeTruthy();
  });

  it('does not show sample-size warning when rounds >= 100', () => {
    renderPanel();
    expect(screen.queryByText(/Sample size warning/)).toBeNull();
  });

  it('shows unavailable message when comparison is null', () => {
    mockAuditData.comparison = null;
    renderPanel();
    expect(screen.getByText(/Model audit data unavailable/)).toBeTruthy();
  });

  it('renders XGBoost improvement suggestions', () => {
    renderPanel();
    expect(screen.getByText('Conformal prediction wrappers')).toBeTruthy();
  });

  it('renders the forecaster selector dropdown', () => {
    renderPanel();
    expect(screen.getByDisplayValue('All forecasters')).toBeTruthy();
  });
});
