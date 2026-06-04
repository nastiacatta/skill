/**
 * Unit tests for SkillAllocationPanel.
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
    ResponsiveContainer: Wrap, LineChart: Wrap, BarChart: Wrap,
    Line: () => null, Bar: () => null, XAxis: () => null, YAxis: () => null,
    Tooltip: () => null, CartesianGrid: () => null,
  };
});

import SkillAllocationPanel from '@/components/audit/SkillAllocationPanel';

// ── Helpers ────────────────────────────────────────────────────────────────

function buildMockComparison(opts?: { indistinguishable?: boolean }) {
  const forecasters = ['Naive', 'EWMA(5)', 'ARIMA(2,1,1)', 'XGBoost', 'Neural Net', 'Theta', 'Ensemble'];
  const steady_state = forecasters.map((f, i) => ({
    forecaster: f, index: i,
    mean_sigma: opts?.indistinguishable && i < 2 ? 0.5 : 0.8 - i * 0.1,
    mean_weight: 1 / 7, mean_score: 0.05 - i * 0.002,
  }));
  const skill_history = Array.from({ length: 100 }, () => {
    const row: Record<string, number> = {};
    forecasters.forEach((f, i) => { row[f] = 0.8 - i * 0.1 + (Math.random() - 0.5) * 0.001; });
    return row;
  });
  return {
    config: { T: 100, n_forecasters: 7, warmup: 168, series_name: 'elia_wind', forecasters },
    rows: [], per_round: [], per_agent_crps: [], forecaster_names: forecasters,
    skill_history, steady_state,
  };
}

function renderPanel() {
  return render(createElement(SkillAllocationPanel));
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('SkillAllocationPanel', () => {
  beforeEach(() => { mockAuditData.comparison = buildMockComparison(); });
  afterEach(() => { cleanup(); });

  it('renders without errors with valid data', () => {
    renderPanel();
    expect(screen.getByText('Steady-state skill estimates (σ)')).toBeTruthy();
    expect(screen.getByText('Skill trajectories over time')).toBeTruthy();
    expect(screen.getByText('Rank correlation')).toBeTruthy();
    expect(screen.getByText('Convergence analysis')).toBeTruthy();
    expect(screen.getByText('Parameter comparison')).toBeTruthy();
  });

  it('shows unavailable message when comparison is null', () => {
    mockAuditData.comparison = null;
    renderPanel();
    expect(screen.getByText(/Skill allocation data unavailable/)).toBeTruthy();
  });

  it('displays indistinguishable skill warning when pairs are close', () => {
    mockAuditData.comparison = buildMockComparison({ indistinguishable: true });
    renderPanel();
    expect(screen.getByText(/Indistinguishable skill estimates detected/)).toBeTruthy();
  });

  it('does not show indistinguishable warning when sigmas are well-separated', () => {
    renderPanel();
    expect(screen.queryByText(/Indistinguishable skill estimates detected/)).toBeNull();
  });

  it('displays parameter comparison table', () => {
    renderPanel();
    expect(screen.getAllByText('γ (skill sharpness)').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('ρ (EWMA learning rate)').length).toBeGreaterThanOrEqual(1);
  });

  it('shows Spearman ρ badge', () => {
    renderPanel();
    expect(screen.getAllByText('Spearman ρ:').length).toBeGreaterThanOrEqual(1);
  });
});
