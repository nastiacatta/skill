/**
 * CamsEvidencePanel — the real CAMS artefact evidence surface.
 *
 * Asserts the panel renders the verified headline (-13.5%, mechanism vs
 * uniform), the DM statistic, the 12-model weight chart labelled by the panel
 * members, and the ug/m3 anchors, and that it degrades to nothing when the
 * artefact is absent. The rendered figures must trace to the artefact the
 * loader returns (no recomputation beyond the displayed -13.5% derivation).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { MemoryRouter } from 'react-router-dom';

// ── Mock Recharts (jsdom has no layout) ─────────────────────────────────────
vi.mock('recharts', () => {
  const Wrap = ({ children }: { children?: React.ReactNode }) =>
    createElement('div', null, children);
  return {
    ResponsiveContainer: Wrap,
    BarChart: ({ data, children }: { data?: Array<{ name: string }>; children?: React.ReactNode }) =>
      createElement(
        'div',
        { 'data-testid': 'weight-chart' },
        (data ?? []).map((d) => createElement('span', { key: d.name, 'data-bar': d.name }, d.name)),
        children,
      ),
    Bar: () => null,
    Cell: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
    CartesianGrid: () => null,
    ReferenceLine: () => null,
    LabelList: () => null,
  };
});

// ── Mock the loader. Values copied from the committed artefact. ──────────────
const FORECASTERS = [
  'CHIMERE', 'DEHM', 'EMEP', 'EURADIM', 'GEMAQ', 'LOTOS',
  'MATCH', 'MINNI', 'MOCAGE', 'MONARCH', 'SILAM', 'ENSEMBLE_MEDIAN',
];

const ARTEFACT = {
  schema_version: 'cams_pm25_experiment.v1',
  description: 'CAMS test fixture',
  panel: { n_forecasters: 12, forecaster_names: FORECASTERS, panel_type: 'heterogeneous_CTM' },
  block: { start: '2024-12-01', end: '2025-02-28', n_hours_total: 2160, n_hours_eval: 1960, warmup: 200 },
  params: {
    gamma: 16, rho: 0.5, lam: 0.05, eta: 2, normalize_mode: 'expanding_causal',
    tau_grid: [0.1, 0.5, 0.9], bootstrap_block_size_hours: 168, bootstrap_n_replicates: 2000,
  },
  results: {
    mean_crps_uniform: 0.14527574218867054,
    mean_crps_mechanism: 0.12567643804344217,
    mean_crps_median: 0.14760750562025,
    mean_crps_ensemble_alone: 0.15049981533455176,
    pct_reduction: 13.491105844618318,
    dm_t: 25.850123557747736, dm_p: 0.0, dm_hac_lag: 1,
    bootstrap_ci_lo: 0.015568600587303739, bootstrap_ci_hi: 0.02309757690836684,
    herfindahl: 0.08445651862632626, effective_n: 11.840412276812534,
    mean_crps_uniform_ugm3: 18.971335044890033, mean_crps_mechanism_ugm3: 16.41189215384675,
    pm25_range_lo: 1.4745005369186401, pm25_range_hi: 132.06295776367188,
    mean_weights: Object.fromEntries(FORECASTERS.map((f, i) => [f, 0.07 + i * 0.001])),
  },
};

const loadCamsHeadline = vi.fn();
vi.mock('@/lib/adapters', () => ({
  loadCamsHeadline: () => loadCamsHeadline(),
}));

import CamsEvidencePanel from '@/components/charts/CamsEvidencePanel';

function renderPanel() {
  return render(createElement(MemoryRouter, null, createElement(CamsEvidencePanel)));
}

afterEach(cleanup);
beforeEach(() => loadCamsHeadline.mockReset());

describe('CamsEvidencePanel — real CAMS artefact evidence', () => {
  it('renders the headline -13.5% with the mechanism vs uniform sublabel', async () => {
    loadCamsHeadline.mockResolvedValue(ARTEFACT);
    renderPanel();
    const headline = await screen.findByTestId('cams-headline');
    // -13.49 rounds to the displayed -13.5.
    expect(headline.textContent).toContain('-13.5');
    expect(headline.textContent).toContain('0.1257');
    expect(headline.textContent).toContain('0.1453');
  });

  it('shows the DM statistic 25.85 and p approx 0 (never the literal 0 alone)', async () => {
    loadCamsHeadline.mockResolvedValue(ARTEFACT);
    renderPanel();
    const dm = await screen.findByTestId('cams-dm');
    expect(dm.textContent).toContain('25.85');
    expect(dm.textContent).toContain('p approx 0');
  });

  it('renders one weight bar per forecaster, labelled by the 12 panel members', async () => {
    loadCamsHeadline.mockResolvedValue(ARTEFACT);
    renderPanel();
    const chart = await screen.findByTestId('weight-chart');
    const bars = within(chart).getAllByText((_t, el) => el?.hasAttribute('data-bar') ?? false);
    expect(bars).toHaveLength(12);
    for (const name of FORECASTERS) {
      expect(chart.querySelector(`[data-bar="${name}"]`)).not.toBeNull();
    }
  });

  it('shows the ug/m3 anchors 16.4 and 19.0', async () => {
    loadCamsHeadline.mockResolvedValue(ARTEFACT);
    renderPanel();
    const line = await screen.findByTestId('cams-ugm3');
    expect(line.textContent).toContain('16.4');
    expect(line.textContent).toContain('19.0');
  });

  it('keeps the day-ahead slice as a draft-pinned -2.0% line', async () => {
    loadCamsHeadline.mockResolvedValue(ARTEFACT);
    renderPanel();
    const dayahead = await screen.findByTestId('cams-dayahead');
    expect(dayahead.textContent).toContain('-2.0%');
  });

  it('renders nothing when the artefact is absent', async () => {
    loadCamsHeadline.mockResolvedValue(null);
    const { container } = renderPanel();
    // Give the effect a tick; the panel should stay empty.
    await waitFor(() => expect(loadCamsHeadline).toHaveBeenCalled());
    expect(container.querySelector('[data-testid="cams-evidence"]')).toBeNull();
  });
});
