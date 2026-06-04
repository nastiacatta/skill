# Reproduction Guide

This document describes three tracks for reproducing the results. All tracks are independent; the dashboard track requires no Python or R installation.

## Prerequisites

- **Python ≥ 3.10** (for tracks a and b)
- **Node.js + npm** (for track c)
- No special hardware required; all experiments run on CPU

---

## Track (a) — Python environment, experiments, and tests

### Install

```bash
cd onlinev2
pip install -e ".[dev]"
```

### Run the test suite

```bash
# From the onlinev2/ directory
pytest tests/
```

This runs unit tests, property-based audit tests, and smoke tests. Audit tests are collected under `pytest -m audit`. A small number of parity tests are marked `@pytest.mark.skip` (they require the external reference implementation of Vitali & Pinson (2025) which is not included).

### Run experiments

From `onlinev2/`, run a single experiment by name:

```bash
python experiments.py --exp <name>
```

**Core experiments** (mechanism correctness and calibration):

| Name | Description |
|------|-------------|
| `settlement` | Settlement sanity: self-financing and non-negative transfers |
| `skill_wager` | Skill-weight convergence vs equal-weight baseline |
| `aggregation` | Forecast aggregation quality across DGPs |
| `calibration` | PIT calibration of the aggregate |
| `parameter_sweep` | Grid search over γ and ρ |
| `sybil` | Sybil-attack profit ratio |
| `scoring` | Scoring-rule properties |
| `fixed_deposit` | Fixed vs bankroll-proportional deposit policies |
| `skill_recovery` | Skill recovery after forecaster replacement |
| `baseline_dgp` | Baseline DGP comparison |
| `latent_fixed_dgp` | Latent fixed DGP experiments |
| `aggregation_dgp` | Aggregation DGP sweep |
| `dgp_comparison` | DGP comparison across settings |
| `weight_comparison` | Weight rule comparison |
| `weight_rules` | Weight rule analysis |
| `deposit_policies` | Deposit policy sweep |
| `master_comparison` | Full real-data mechanism comparison (headline results) |
| `bankroll_ablation` | Bankroll policy ablation |

**Behaviour experiments** (strategic forecaster behaviour):

| Name | Description |
|------|-------------|
| `behaviour_matrix` | Full behaviour preset matrix |
| `preference_stress` | Preference stress tests |
| `intermittency_stress` | Intermittent participation stress |
| `arbitrage_scan` | Arbitrage opportunity scan |
| `sybil_arbitrage` | Sybil + arbitrage interaction |

Run all core experiments:

```bash
python experiments.py --block core
```

Run all behaviour experiments:

```bash
python experiments.py --block behaviour
```

Outputs write to `onlinev2/outputs/core/experiments/<exp_name>/` and `onlinev2/outputs/behaviour/experiments/<exp_name>/`.

---

## Track (b) — Regenerate key figures from scripts

The following scripts in `scripts/` regenerate headline figures. Run from the repository root.

**Real-data validation plots:**

```bash
python scripts/run_real_data_with_skill.py
python scripts/run_baseline_comparison.py
python scripts/run_sensitivity_sweep.py
```

**Figure scripts (require R):**

```bash
Rscript scripts/plot_real_data_validation.R
Rscript scripts/plot_skill_signal.R
```

**Pre-bundled presentation figures (no regeneration needed):**

The 42 headline figures used in the thesis presentation are already bundled for
viewing in `dashboard/public/presentation-plots/`. No figure-regeneration step
is required to review these results — they are served directly by the dashboard
(Track c).

> Note: `scripts/gen_thesis_figures.py` is present in the repository but is a
> legacy script that writes to a `writing/figures/` path not included in this
> submission. It is not part of the reproduction workflow and should not be run
> from a clean checkout.

**Shell reproduction script** (end-to-end: installs, tests, runs headline experiments):

```bash
bash scripts/reproduce_submission.sh
```

---

## Track (c) — View results in the dashboard (no regeneration required)

The dashboard ships with pre-generated data under `dashboard/public/data/`. No Python or experiment runs are needed to view results.

```bash
cd dashboard
npm install
npm run dev
```

Then open the URL printed by Vite (typically `http://localhost:5173`).

The dashboard is fully static: all plots and tables are rendered from the bundled JSON files. The `dashboard/public/data/` directory contains outputs from the core and behaviour experiment runs, real-data comparisons, and audit diagnostics.

To build a production bundle:

```bash
npm run build   # outputs to dashboard/dist/
```
