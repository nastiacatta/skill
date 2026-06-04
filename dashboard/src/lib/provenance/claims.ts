/**
 * The provenance registry.
 *
 * One entry per headline on-screen number, mapping it to the single source it
 * is allowed to come from. Every expected value below is copied from the
 * verified claim table in the thesis draft, not re-derived.
 *
 * Two source kinds:
 *  - `artefact`: the value lives in a committed file under `public/data/`. The
 *    test loads the file, resolves the pointer(s), replays `derive`/`reduce`,
 *    and asserts the result matches `expected` within `tolerance`.
 *  - `draft`: the value lives only in the thesis draft (no committed dashboard
 *    artefact). The test asserts the literal the dashboard renders is present
 *    in the cited code file, so an edit that moves the number without updating
 *    the registry trips the gate.
 *
 * A claim with no verifiable source is recorded with `status: 'unverifiable'`
 * and a note, never given an invented source.
 *
 * Paths: artefact `file` is relative to `dashboard/public/`. Draft `rendersIn`
 * file is relative to `dashboard/src/`.
 */

import type { ProvenanceClaim } from './types';

// Method-row indices in the Elia comparison.json `rows` array (same order for
// wind and electricity).
const ROW = {
  uniform: 0,
  skill: 1,
  mechanism: 2,
  best_single: 3,
} as const;

/** Percentage change of `a` relative to `b`, signed. */
const pctChange = (a: number, b: number) => ((a - b) / b) * 100;

/** Median of a numeric array. */
function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Linear-interpolated q-quantile (q in [0,1]) of a numeric array. */
function quantile(xs: number[], q: number): number {
  const s = [...xs].sort((a, b) => a - b);
  const i = q * (s.length - 1);
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  if (lo === hi) return s[lo];
  return s[lo] * (1 - (i - lo)) + s[hi] * (i - lo);
}

const WIND = 'data/real_data/elia_wind/data/comparison.json';
const ELEC = 'data/real_data/elia_electricity/data/comparison.json';
const CAMS = 'data/real_data/cams_pm25/data/cams_headline.json';
const RECAL = 'data/real_data/elia_wind/data/calibration_recal.json';
const OPS = 'data/real_data/elia_wind/data/elia_operational_baseline.json';
const ARB = 'data/behaviour/experiments/arbitrage_scan/data/arbitrage_scan_by_lam.csv';
const INSIDER = 'data/behaviour/experiments/insider_advantage/data/insider_advantage_summary.csv';
const RESET = 'data/behaviour/experiments/reputation_reset/data/reputation_reset_summary.csv';

export const PROVENANCE_CLAIMS: ProvenanceClaim[] = [
  // ── B. Real-data: Elia offshore wind (headline) ──────────────────────────
  {
    id: 'C1',
    label: 'Wind CRPS reduction vs uniform',
    expected: -7.12,
    tolerance: 0.05,
    unit: '%',
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: [`/rows/${ROW.mechanism}/mean_crps`, `/rows/${ROW.uniform}/mean_crps`],
      derive: ([mech, uni]) => pctChange(mech, uni),
    },
    renderedBy: ['HomePage.tsx', 'ResultsPage.tsx', 'NotesPage.tsx', 'panelFramings.ts'],
    status: 'verified',
    note: 'Draft rounds to -7.1%. Uniform 0.040786, mechanism 0.037881.',
  },
  {
    id: 'C2',
    label: 'Wind DM statistic (Andrews HAC lag 12)',
    expected: 22.35,
    tolerance: 0.01,
    unit: 't',
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/dm_test/statistic'],
    },
    renderedBy: ['HomePage.tsx', 'NotesPage.tsx'],
    status: 'verified',
    note: 'Legacy horizon-1 statistic 40.77 is also in the artefact; label the bandwidth.',
  },
  {
    id: 'C2b',
    label: 'Wind DM legacy horizon-1 statistic',
    expected: 40.77,
    tolerance: 0.01,
    unit: 't',
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/dm_test/statistic_legacy_horizon1'],
    },
    renderedBy: ['(registry-only: legacy statistic retained for provenance, not surfaced)'],
    status: 'verified',
    note: 'Legacy horizon-1 DM statistic. Retained in the registry for provenance; no longer shown on any rendered surface.',
  },
  {
    id: 'C3-lower',
    label: 'Wind ΔCRPS 95% CI lower bound',
    expected: -0.003186,
    tolerance: 1e-5,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: [`/rows/${ROW.mechanism}/delta_ci_lower`],
    },
    renderedBy: ['NotesPage.tsx', 'ResultsPage.tsx'],
    status: 'verified',
    note: 'Draft displays [-0.00321, -0.00260], rounded from the artefact CI.',
  },
  {
    id: 'C3-upper',
    label: 'Wind ΔCRPS 95% CI upper bound',
    expected: -0.002599,
    tolerance: 1e-5,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: [`/rows/${ROW.mechanism}/delta_ci_upper`],
    },
    renderedBy: ['NotesPage.tsx', 'ResultsPage.tsx'],
    status: 'verified',
  },
  {
    id: 'C4-T',
    label: 'Wind raw run length T',
    expected: 17544,
    tolerance: 0,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/config/T'],
    },
    renderedBy: ['HomePage.tsx', 'NotesPage.tsx', 'DataOverviewSlide.tsx'],
    status: 'verified',
    note: 'T_eval = 17,344 = T - 200 warmup; both numbers appear on cards.',
  },
  {
    id: 'C4-warmup',
    label: 'Wind warmup rounds',
    expected: 200,
    tolerance: 0,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/config/warmup'],
    },
    renderedBy: ['HomePage.tsx', 'NotesPage.tsx'],
    status: 'verified',
  },
  {
    id: 'C4-Teval',
    label: 'Wind evaluation rounds T_eval',
    expected: 17344,
    tolerance: 0,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/config/T', '/config/warmup'],
      derive: ([T, warmup]) => T - warmup,
    },
    renderedBy: ['HomePage.tsx', 'ResultsPage.tsx', 'NotesPage.tsx'],
    status: 'verified',
  },
  {
    id: 'C4-n',
    label: 'Wind panel size (forecasters)',
    expected: 7,
    tolerance: 0,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/config/n_forecasters'],
    },
    renderedBy: ['HomePage.tsx', 'ResultsPage.tsx', 'NotesPage.tsx'],
    status: 'verified',
  },
  {
    id: 'C6',
    label: 'Wind skill-gate-only reduction vs uniform',
    expected: -5.15,
    tolerance: 0.05,
    unit: '%',
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: [`/rows/${ROW.skill}/mean_crps`, `/rows/${ROW.uniform}/mean_crps`],
      derive: ([skill, uni]) => pctChange(skill, uni),
    },
    renderedBy: ['NotesPage.tsx'],
    status: 'verified',
    note: 'Skill gate alone is roughly three-quarters of the headline (−5.15% of −7.1%).',
  },
  {
    id: 'C7-median',
    label: 'Wind median per-round CRPS reduction',
    expected: -7.2,
    tolerance: 0.1,
    unit: '%',
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: [],
      computeFromDoc: (doc) => {
        const rows = (doc as { per_round: Record<string, number>[] }).per_round;
        const mech = median(rows.map((r) => r.crps_mechanism));
        const uni = median(rows.map((r) => r.crps_uniform));
        return pctChange(mech, uni);
      },
    },
    renderedBy: ['PerRoundPercentilePanel.tsx'],
    status: 'verified',
    note: 'tab:wind-tail-metrics. Median of crps_mechanism vs crps_uniform.',
  },
  {
    id: 'C7-p95',
    label: 'Wind 95th-percentile per-round CRPS reduction',
    expected: -6.1,
    tolerance: 0.1,
    unit: '%',
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: [],
      computeFromDoc: (doc) => {
        const rows = (doc as { per_round: Record<string, number>[] }).per_round;
        const mech = quantile(rows.map((r) => r.crps_mechanism), 0.95);
        const uni = quantile(rows.map((r) => r.crps_uniform), 0.95);
        return pctChange(mech, uni);
      },
    },
    renderedBy: ['PerRoundPercentilePanel.tsx'],
    status: 'verified',
    note: 'tab:wind-tail-metrics p95 reduction.',
  },
  {
    id: 'C8-sigma-xgb',
    label: 'Wind tail-mean σ, XGBoost (top of ordering)',
    expected: 0.808,
    tolerance: 0.005,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/steady_state/0/mean_sigma'],
    },
    renderedBy: ['SkillAllocationPanel.tsx', 'ModelAuditPanel.tsx'],
    status: 'verified',
    note: 'σ ordering: XGBoost 0.80, ARIMA 0.79, Naive 0.78, MLP 0.76, Ensemble 0.74, EWMA 0.69, Theta 0.67.',
  },
  {
    id: 'C8-sigma-theta',
    label: 'Wind tail-mean σ, Theta (bottom of ordering)',
    expected: 0.685,
    tolerance: 0.005,
    source: {
      kind: 'artefact',
      file: WIND,
      pointers: ['/steady_state/6/mean_sigma'],
    },
    renderedBy: ['SkillAllocationPanel.tsx', 'ModelAuditPanel.tsx'],
    status: 'verified',
  },
  {
    id: 'C9',
    label: 'Wind aggregation weight span (Theta–XGBoost) vs uniform 0.143',
    expected: 0.143,
    tolerance: 0,
    source: {
      kind: 'draft',
      citation: '60_results_real_data.md:113',
      rendersIn: { file: 'pages/Appendix.tsx', literal: '0.122 on Theta to 0.158 on XGBoost' },
    },
    renderedBy: ['Appendix.tsx'],
    status: 'verified',
    note: 'Draft span 0.122-0.158 vs uniform 0.143. The artefact steady_state.mean_weight is a different (skill-gate) normalisation, so the displayed span is draft-pinned.',
  },

  // ── C. Real-data: Elia electricity-imbalance (null) ──────────────────────
  {
    id: 'C10-dm',
    label: 'Electricity DM statistic (null)',
    expected: 0.0074,
    tolerance: 0.0001,
    unit: 't',
    source: {
      kind: 'artefact',
      file: ELEC,
      pointers: ['/dm_test/statistic'],
    },
    renderedBy: ['NotesPage.tsx', 'ResultsPage.tsx'],
    status: 'verified',
    note: 'Draft rounds t = 0.01; p = 0.994.',
  },
  {
    id: 'C10-p',
    label: 'Electricity DM p-value',
    expected: 0.994123,
    tolerance: 0.0005,
    source: {
      kind: 'artefact',
      file: ELEC,
      pointers: ['/dm_test/p_value'],
    },
    renderedBy: ['NotesPage.tsx', 'ResultsPage.tsx'],
    status: 'verified',
  },
  {
    id: 'C10-crps',
    label: 'Electricity mechanism CRPS (≈ uniform, both 0.0905)',
    expected: 0.090517,
    tolerance: 5e-5,
    source: {
      kind: 'artefact',
      file: ELEC,
      pointers: [`/rows/${ROW.mechanism}/mean_crps`],
    },
    renderedBy: ['NotesPage.tsx'],
    status: 'verified',
    note: 'Uniform and mechanism identical to 4 dp.',
  },
  {
    id: 'C11',
    label: 'Electricity raw run length T (T_eval 9,800)',
    expected: 10000,
    tolerance: 0,
    source: {
      kind: 'artefact',
      file: ELEC,
      pointers: ['/config/T'],
    },
    renderedBy: ['NotesPage.tsx', 'ResultsPage.tsx'],
    status: 'verified',
    note: 'Draft reports T_eval = 9,800 = 10,000 - 200 warmup.',
  },

  // ── D. CAMS air-quality (committed artefact: cams_headline.json) ──────────
  {
    id: 'C12',
    label: 'CAMS PM2.5 reduction vs uniform',
    expected: -13.49,
    tolerance: 0.05,
    unit: '%',
    source: {
      kind: 'artefact',
      file: CAMS,
      pointers: ['/results/mean_crps_mechanism', '/results/mean_crps_uniform'],
      derive: ([mech, uni]) => pctChange(mech, uni),
    },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Draft rounds to -13.5%. Mechanism 0.12568 vs uniform 0.14528. Evidence-only; the live card surfaces are guarded by C12-card-guard.',
  },
  {
    id: 'C12-card-guard',
    label: 'CAMS -13.5% must never appear on a live card surface',
    expected: -13.5,
    tolerance: 0,
    unit: '%',
    source: {
      kind: 'draft',
      citation: '60_results_real_data.md:249',
      mustNotAppearIn: {
        literal: '13.5',
        files: [
          'components/platform/panelFramings.ts',
          'pages/HomePage.tsx',
          'pages/platform/PlatformLandingPage.tsx',
        ],
      },
    },
    renderedBy: ['CamsEvidencePanel.tsx (the only surface that renders it, from the artefact)'],
    status: 'verified',
    note: 'The headline is artefact-backed on the evidence surface (C12). The live cards must never show it as a readout; this guard keeps the literal out of the three visitor-facing card files.',
  },
  {
    id: 'C12-dm-t',
    label: 'CAMS DM statistic',
    expected: 25.85,
    tolerance: 0.01,
    unit: 't',
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/dm_t'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Draft 25.85, p approx 0 (tab:dm-tests).',
  },
  {
    id: 'C12-median',
    label: 'CAMS per-round median baseline CRPS',
    expected: 0.14761,
    tolerance: 5e-5,
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/mean_crps_median'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Draft 0.1476. Median does not beat the mechanism on CAMS.',
  },
  {
    id: 'C12-hhi',
    label: 'CAMS weight Herfindahl index',
    expected: 0.084457,
    tolerance: 5e-5,
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/herfindahl'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Draft prints 0.084; shares stay near uniform.',
  },
  {
    id: 'C12-neff',
    label: 'CAMS effective count N_eff = 1/HHI',
    expected: 11.84,
    tolerance: 0.01,
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/effective_n'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Draft states HHI 0.084 and the identity N_eff = 1/HHI; 1/0.084457 = 11.84.',
  },
  {
    id: 'C12-ugm3-mech',
    label: 'CAMS mechanism CRPS in ug/m3',
    expected: 16.41,
    tolerance: 0.01,
    unit: 'ug/m3',
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/mean_crps_mechanism_ugm3'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Draft 16.4 ug/m3 on the [1.5, 132.1] range.',
  },
  {
    id: 'C12-ugm3-uni',
    label: 'CAMS uniform CRPS in ug/m3',
    expected: 18.97,
    tolerance: 0.01,
    unit: 'ug/m3',
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/mean_crps_uniform_ugm3'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Draft 19.0 ug/m3.',
  },
  {
    id: 'C12-ci-lo',
    label: 'CAMS 95% bootstrap CI lower bound on dCRPS',
    expected: 0.015569,
    tolerance: 1e-5,
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/bootstrap_ci_lo'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Thesis tab prints "--"; bootstrap design documented at meth:9 (168h blocks, B=2000).',
  },
  {
    id: 'C12-ci-hi',
    label: 'CAMS 95% bootstrap CI upper bound on dCRPS',
    expected: 0.023098,
    tolerance: 1e-5,
    source: { kind: 'artefact', file: CAMS, pointers: ['/results/bootstrap_ci_hi'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
  },
  {
    id: 'C12-n',
    label: 'CAMS panel size (forecasters)',
    expected: 12,
    tolerance: 0,
    source: { kind: 'artefact', file: CAMS, pointers: ['/panel/n_forecasters'] },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: '11 CTMs plus the ensemble median.',
  },
  {
    id: 'C12-dayahead',
    label: 'CAMS day-ahead slice reduction (draft-only, no artefact)',
    expected: -2.0,
    tolerance: 0,
    unit: '%',
    source: {
      kind: 'draft',
      citation: '60_results_real_data.md:255-258, tab:dm-tests row real:66',
      rendersIn: { file: 'components/charts/CamsEvidencePanel.tsx', literal: '-2.0%' },
    },
    renderedBy: ['CamsEvidencePanel.tsx'],
    status: 'verified',
    note: 'Day-ahead slice has no artefact value (n=61, t=1.84, p=0.066). Draft-pinned literal only; never artefact-traced.',
  },

  // ── E. Recalibration (post-hoc) ──────────────────────────────────────────
  {
    id: 'C13',
    label: 'Recalibration: tail deviation reduction',
    expected: -41.35,
    tolerance: 0.1,
    unit: '%',
    source: {
      kind: 'artefact',
      file: RECAL,
      pointers: ['/recal_tail_dev', '/mech_tail_dev'],
      derive: ([recal, mech]) => pctChange(recal, mech),
    },
    renderedBy: ['RecalibrationPanel.tsx'],
    status: 'verified',
    note: 'Draft 41.4%. 0.01857 -> 0.01089. The legacy "74% tail closed" is stale and must not appear.',
  },
  {
    id: 'C14',
    label: 'Recalibration: centre deviation reduction',
    expected: -90.98,
    tolerance: 0.1,
    unit: '%',
    source: {
      kind: 'artefact',
      file: RECAL,
      pointers: ['/recal_centre_dev', '/mech_centre_dev'],
      derive: ([recal, mech]) => pctChange(recal, mech),
    },
    renderedBy: ['RecalibrationPanel.tsx'],
    status: 'verified',
    note: 'Draft 91.0%. 0.02905 -> 0.00262.',
  },
  {
    id: 'C15',
    label: 'Recalibration: CRPS cost',
    expected: 1.58,
    tolerance: 0.05,
    unit: '%',
    source: {
      kind: 'artefact',
      file: RECAL,
      pointers: ['/recal_mean_crps', '/mech_mean_crps'],
      derive: ([recal, mech]) => pctChange(recal, mech),
    },
    renderedBy: ['RecalibrationPanel.tsx'],
    status: 'verified',
    note: 'Draft +1.6%. 0.01999 -> 0.02031.',
  },
  {
    id: 'C16',
    label: 'Recalibration: sharpness change (80% PI width)',
    expected: -12.29,
    tolerance: 0.1,
    unit: '%',
    source: {
      kind: 'artefact',
      file: RECAL,
      pointers: ['/recal_mean_sharpness', '/mech_mean_sharpness'],
      derive: ([recal, mech]) => pctChange(recal, mech),
    },
    renderedBy: ['RecalibrationPanel.tsx'],
    status: 'verified',
    note: 'Draft -12.3%. 0.08868 -> 0.07779.',
  },

  // ── F. Robustness / adversary catalogue (per 1,000 rounds) ───────────────
  {
    id: 'C21-lo',
    label: 'Arbitrage profit at gate floor λ = 0 (per 1k rounds)',
    expected: 11.68,
    tolerance: 0.02,
    source: {
      kind: 'artefact',
      file: ARB,
      format: 'csv',
      pointers: ['lam=0.0:mean_profit'],
    },
    renderedBy: ['AdversaryCatalogue.tsx'],
    status: 'verified',
    note: 'Profit rises with the gate floor; this is the floor of the open arbitrage surface.',
  },
  {
    id: 'C21-hi',
    label: 'Arbitrage profit at gate floor λ = 1 (per 1k rounds)',
    expected: 24.22,
    tolerance: 0.02,
    source: {
      kind: 'artefact',
      file: ARB,
      format: 'csv',
      pointers: ['lam=1.0:mean_profit'],
    },
    renderedBy: ['AdversaryCatalogue.tsx'],
    status: 'verified',
  },
  {
    id: 'C22',
    label: 'Privileged-information insider profit (per 1k rounds, top of catalogue)',
    expected: 57.14,
    tolerance: 0.05,
    source: {
      kind: 'artefact',
      file: INSIDER,
      format: 'csv',
      pointers: ['scenario=insider_lagged:mean_insider_profit'],
    },
    renderedBy: ['AdversaryCatalogue.tsx'],
    status: 'verified',
    note: 'CI [+52.9, +61.4]. Draft top of catalogue.',
  },
  {
    id: 'C23-reset',
    label: 'Reputation-reset attacker profit (per 1k rounds)',
    expected: -3.49,
    tolerance: 0.02,
    source: {
      kind: 'artefact',
      file: RESET,
      format: 'csv',
      pointers: ['scenario=reputation_reset:mean_attacker_profit'],
    },
    renderedBy: ['AdversaryCatalogue.tsx'],
    status: 'verified',
    note: 'Fixed-identity manipulator -20.00 -> -3.49 reset, an 83% reduction; never crosses zero.',
  },
  {
    id: 'C23-fixed',
    label: 'Fixed-identity manipulator profit (per 1k rounds)',
    expected: -20.0,
    tolerance: 0.01,
    source: {
      kind: 'artefact',
      file: RESET,
      format: 'csv',
      pointers: ['scenario=manipulator_no_reset:mean_attacker_profit'],
    },
    renderedBy: ['AdversaryCatalogue.tsx'],
    status: 'verified',
  },

  {
    id: 'C26',
    label: 'Diversified-report sybil leakage',
    expected: 6.5,
    tolerance: 0,
    unit: '%',
    source: {
      kind: 'draft',
      citation: 'appendix/J_adversary_detail.md:122, 80_robustness.md:36',
      rendersIn: { file: 'components/behaviour/AdversaryCatalogue.tsx', literal: '+6.5%' },
    },
    renderedBy: ['AdversaryCatalogue.tsx'],
    status: 'verified',
    note: 'core/experiments/sybil diversified_mean_ratio = 1.0645, so (1.0645 - 1) x 100 = +6.5% over narrow-Lambert. Point estimate (se null), no CI on the card. Distinct from the public epsilon-sweep sensitivity artefact.',
  },

  // ── G. Operational benchmark (wind, MW units) ────────────────────────────
  {
    id: 'C24-mech',
    label: 'Operational: mechanism CRPS (MW equivalent, grid-9)',
    expected: 83.67,
    tolerance: 0.05,
    unit: 'MW',
    source: {
      kind: 'artefact',
      file: OPS,
      pointers: ['/our_mechanism_post_fix/rows/mechanism/crps_mw_equivalent'],
    },
    renderedBy: ['EliaOperationalBaseline.tsx', 'StatTile.tsx'],
    status: 'verified',
    note: 'Draft 83.7 MW.',
  },
  {
    id: 'C24-xgb',
    label: 'Operational: best single (XGBoost) CRPS (MW equivalent)',
    expected: 69.46,
    tolerance: 0.05,
    unit: 'MW',
    source: {
      kind: 'artefact',
      file: OPS,
      pointers: ['/our_mechanism_post_fix/rows/best_single/crps_mw_equivalent'],
    },
    renderedBy: ['EliaOperationalBaseline.tsx'],
    status: 'verified',
    note: 'Draft 69.5 MW; XGBoost beats the mechanism by 17.0%.',
  },
  {
    id: 'C24-gap',
    label: 'Operational: XGBoost beats mechanism by',
    expected: -16.98,
    tolerance: 0.1,
    unit: '%',
    source: {
      kind: 'artefact',
      file: OPS,
      pointers: [
        '/our_mechanism_post_fix/rows/best_single/crps_mw_equivalent',
        '/our_mechanism_post_fix/rows/mechanism/crps_mw_equivalent',
      ],
      derive: ([xgb, mech]) => pctChange(xgb, mech),
    },
    renderedBy: ['EliaOperationalBaseline.tsx'],
    status: 'verified',
    note: 'Draft rounds to 17.0%.',
  },
  {
    id: 'C25',
    label: 'Reserve translation: 7.1% ≈ 6.4 MW/hr avoided',
    expected: 6.4,
    tolerance: 0,
    unit: 'MW',
    source: {
      kind: 'draft',
      citation: '99_conclusion.md / 10_intro_and_background.md:76',
      rendersIn: { file: 'components/dashboard/navModel.tsx', literal: '6.4' },
    },
    renderedBy: ['navModel.tsx'],
    status: 'verified',
    note: 'Derived in the draft (7.1% of mean reserve); worth ~1e5-1e6 EUR/yr per asset.',
  },

  // ── A. Synthetic-panel claims (live simulator + committed artefacts) ─────
  {
    id: 'C18',
    label: 'Synthetic skill recovery: Spearman σ vs inverse-CRPS',
    expected: 1.0,
    tolerance: 0,
    source: {
      kind: 'draft',
      citation: '50_results_synthetic.md:30',
      rendersIn: { file: 'components/slides/SyntheticResultsSlide.tsx', literal: 'Spearman ρ = 1.0' },
    },
    renderedBy: ['SyntheticResultsSlide.tsx'],
    status: 'verified',
    note: 'Synthetic-only, +1.00 across 20 seeds; reproducible live in the simulator.',
  },
];

/**
 * Claims whose source is a committed artefact (JSON or CSV). These are the
 * entries the gate can check by loading the file and comparing values.
 */
export const ARTEFACT_CLAIMS = PROVENANCE_CLAIMS.filter((c) => c.source.kind === 'artefact');

/**
 * Claims whose source is a draft-pinned constant. The gate checks the rendered
 * literal is present in the cited code file.
 */
export const DRAFT_CLAIMS = PROVENANCE_CLAIMS.filter((c) => c.source.kind === 'draft');

export { median, quantile, pctChange };
