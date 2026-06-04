/**
 * Unit tests for AggregationAccuracyPanel.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { createElement } from 'react';

// ── Mock useAuditData ──────────────────────────────────────────────────────

const mockAuditData = {
  comparison: null as Record<string, unknown> | null,
  baselines: null as Record<string, unknown> | null,
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
    ResponsiveContainer: Wrap, LineChart: Wrap, BarChart: Wrap,
    Line: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null,
    Tooltip: () => null, CartesianGrid: () => null, ReferenceLine: () => null,
  };
});

import AggregationAccuracyPanel from '@/components/audit/AggregationAccuracyPanel';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildMockComparison() {
  return {
    config: { T: 200, n_forecasters: 7, warmup: 168, series_name: 'elia_wind', forecasters: [] },
    rows: [
      { experiment: 'test', method: 'uniform', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.055, delta_crps_vs_equal: 0 },
      { experiment: 'test', method: 'skill', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.048, delta_crps_vs_equal: -0.007 },
      { experiment: 'test', method: 'mechanism', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.0448, delta_crps_vs_equal: -0.0102 },
      { experiment: 'test', method: 'best_single', seed: 0, DGP: 'elia', preset: 'default', mean_crps: 0.042, delta_crps_vs_equal: -0.013 },
    ],
    per_round: [], per_agent_crps: [], forecaster_names: [],
    calibration: [
      { tau: 0.1, nominal: 0.1, empirical: 0.07, gap: -0.03 },
      { tau: 0.25, nominal: 0.25, empirical: 0.24, gap: -0.01 },
      { tau: 0.5, nominal: 0.5, empirical: 0.49, gap: -0.01 },
      { tau: 0.75, nominal: 0.75, empirical: 0.74, gap: -0.01 },
      { tau: 0.9, nominal: 0.9, empirical: 0.85, gap: -0.05 },
    ],
  };
}

function buildMockBaselines() {
  return {
    config: { series: 'elia_wind', T: 17344, T_eval: 17176, n_forecasters: 7, forecaster_names: [], mechanism_params: {}, vitali_lr: 0.01, taus: [] },
    summary: [
      { series: 'elia_wind', method: 'uniform', mean_crps: 0.055, delta_vs_uniform: 0, pct_vs_uniform: 0 },
      { series: 'elia_wind', method: 'mechanism', mean_crps: 0.0448, delta_vs_uniform: -0.0102, pct_vs_uniform: -44.1 },
      { series: 'elia_wind', method: 'vitali_ogd', mean_crps: 0.035, delta_vs_uniform: -0.02, pct_vs_uniform: -65.5 },
      { series: 'elia_wind', method: 'oracle', mean_crps: 0.0344, delta_vs_uniform: -0.0206, pct_vs_uniform: -37.5 },
      { series: 'elia_wind', method: 'inverse_variance', mean_crps: 0.049, delta_vs_uniform: -0.006, pct_vs_uniform: -10.9 },
      { series: 'elia_wind', method: 'trimmed_mean', mean_crps: 0.050, delta_vs_uniform: -0.005, pct_vs_uniform: -9.1 },
      { series: 'elia_wind', method: 'median', mean_crps: 0.052, delta_vs_uniform: -0.003, pct_vs_uniform: -5.5 },
    ],
  };
}

function renderPanel() {
  return render(createElement(AggregationAccuracyPanel));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('AggregationAccuracyPanel', () => {
  beforeEach(() => {
    mockAuditData.comparison = buildMockComparison();
    mockAuditData.baselines = buildMockBaselines();
  });
  afterEach(() => { cleanup(); });

  it('renders without errors with valid data', () => {
    renderPanel();
    expect(screen.getByText('Method comparison')).toBeTruthy();
    expect(screen.getByText('Oracle gap')).toBeTruthy();
    expect(screen.getByText('Vitali OGD comparison')).toBeTruthy();
    expect(screen.getByText('Calibration reliability diagram')).toBeTruthy();
    expect(screen.getByText('Alternative approaches')).toBeTruthy();
    expect(screen.getByText('Why the aggregate is miscalibrated')).toBeTruthy();
  });

  it('displays method comparison table with methods', () => {
    renderPanel();
    expect(screen.getByText('Uniform')).toBeTruthy();
    expect(screen.getByText('Mechanism')).toBeTruthy();
    expect(screen.getByText('Skill-weighted')).toBeTruthy();
  });

  it('shows oracle gap badge', () => {
    renderPanel();
    // Oracle gap = (0.0448 - 0.0344) / 0.0344 * 100 ≈ 30.2%
    expect(screen.getAllByText(/\d+\.\d+%/).length).toBeGreaterThanOrEqual(1);
  });

  it('shows unavailable message when comparison is null', () => {
    mockAuditData.comparison = null;
    renderPanel();
    expect(screen.getByText(/Aggregation accuracy data unavailable/)).toBeTruthy();
  });

  it('renders all 4 alternative approaches', () => {
    renderPanel();
    expect(screen.getByText(/Per-quantile Online Gradient Descent/)).toBeTruthy();
    expect(screen.getByText(/Kernel-embedded probabilistic forecast pooling/)).toBeTruthy();
    expect(screen.getByText(/Quasi-arithmetic pooling/)).toBeTruthy();
    expect(screen.getByText(/Empirical recalibration transform/)).toBeTruthy();
  });

  it('renders Ranjan-Gneiting explanation', () => {
    renderPanel();
    expect(screen.getByText(/Ranjan & Gneiting/)).toBeTruthy();
  });
});
