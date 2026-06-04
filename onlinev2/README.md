# onlinev2

Online forecasting aggregation and wagering — simulation harness, experiments, and diagnostics.

Based on Lambert's (2008) self-financed weighted-score wagering mechanism, extending Raja–Pinson's one-shot design to the online setting with skill learning and deterministic staking.

## What this project extends

- **Core settlement** uses Lambert-style weighted-score wagering with bounded affine scores `s ∈ [0,1]`. In point mode the score is induced by absolute loss; in quantile mode it is induced by a finite-grid CRPS surrogate.
- The **online skill state** makes the overall interaction repeated; conditional truthfulness is per-round given fixed `m_t`.
- This directly targets Raja–Pinson's stated next step of adding **online learning and reputation** to their history-free, one-shot mechanism.

## Installation

```bash
cd onlinev2
pip install -e .
```

No `PYTHONPATH` or `sys.path` changes are required when the package is installed. Without installing, use `PYTHONPATH=src` when running scripts from the project root.

---

## Running experiments

Outputs are split by **block**:

- **Core experiments** write to: `outputs/core/experiments/<exp_name>/`
- **Behaviour experiments** write to: `outputs/behaviour/experiments/<exp_name>/`

**Core only** (17 mechanism/DGP experiments):

```bash
python experiments.py --block core
# or: python -m onlinev2.experiments.cli --block core
```

**Behaviour only** (12 user-behaviour experiments):

```bash
python experiments.py --block behaviour --exp all
```

Experiments: behaviour_matrix, preference_stress, intermittency_stress, arbitrage_scan, detection_adaptation, collusion_stress, insider_advantage, wash_activity_gaming, strategic_reporting, identity_attack_matrix, drift_adaptation, stake_policy_matrix.

**Both** (default):

```bash
python experiments.py --block all
```

**Single experiment**:

```bash
python experiments.py --block behaviour --exp behaviour_matrix
python experiments.py --block core --exp settlement
```

Every behaviour run writes `summary.md` and `summary.json` in the experiment folder. Use `--write_summary false` to skip them.

---

## Core mechanism only

Run the deterministic mechanism and **29 inline unit tests** in `mvp.py`:

```bash
python mvp.py
```

Run **pytest** tests (in `tests/`):

```bash
pytest -q
```

**Test count**: 29 inline tests in `mvp.py` + N pytest tests in `tests/` (e.g. `test_smoke.py`, `test_behaviour_boundary.py`, `test_metrics.py`, `test_arbitrageur.py`). CI should run both: `python mvp.py` and `pytest -q`.

---

## Behaviour block quickstart

Run one behaviour experiment:

```bash
python experiments.py --exp behaviour_matrix
```

Run intermittency stress test:

```bash
python experiments.py --exp intermittency_stress
```

---

## Running a specific behaviour preset

Use the behaviour preset name with `make_behaviour` in code, or run the corresponding experiment. From the CLI, behaviour experiments use presets internally; to vary presets (e.g. for `behaviour_matrix`) you can pass options via code or extend the CLI. Example pattern (if supported by your runner):

```bash
python experiments.py --exp behaviour_matrix --behaviour BURSTY_REALISTIC
python experiments.py --exp behaviour_matrix --behaviour SYBIL_SPLIT_K --k 10
```

Presets: `BENIGN_BASELINE`, `BURSTY_REALISTIC`, `HEDGED_RISK_AVERSE`, `COLLUSION_GROUP`, `SYBIL_SPLIT_K`, `MANIPULATOR`, `EVADER`, `INSIDER`, `ARBITRAGEUR`.

---

## Outputs

- **Core**: `outputs/core/experiments/<exp_name>/data/*.csv`, `outputs/core/experiments/<exp_name>/plots/*.png`
- **Behaviour**: `outputs/behaviour/experiments/<exp_name>/data/*.csv`, `outputs/behaviour/experiments/<exp_name>/plots/*.png`
- Every behaviour run also writes `summary.md` and `summary.json` in the experiment folder.

---

## Reproducing figures

Plots are generated during the experiment run. To regenerate plots from saved CSV logs you would need a separate script that reads the CSVs and calls the plotting helpers; the codebase currently generates figures as part of each experiment.

---

## Quick start

```bash
cd onlinev2
pip install -e .

# Run all experiments (core + behaviour, separate output roots)
python experiments.py --exp all

# Run a single experiment
python experiments.py --exp aggregation
python experiments.py --block behaviour --exp behaviour_matrix

# Run simulation + 29 inline unit tests
python mvp.py
```

---

## Project structure

```
onlinev2/
│
├── mvp.py                          # Thin demo; delegates to onlinev2.simulation
├── experiments.py                  # Thin entry; delegates to onlinev2.experiments.cli
│
├── src/onlinev2/                   # Installable package (pip install -e .)
│   │
│   ├── core/                       # —— CANONICAL MECHANISM: types, runner, scoring, settlement, skill, metrics, staking, weights ——
│   │   #   Use onlinev2.core in new code. No behaviour, no I/O.
│   │
│   ├── mechanism/                  # —— Compatibility shim (re-exports from core) ——
│   │
│   ├── behaviour/                  # —— USER & ADVERSARY BEHAVIOUR ——
│   │   ├── README.md               #   Boundary: act() sees only past state
│   │   ├── protocol.py             #   RoundPublicState, AgentAction, BehaviourModel
│   │   ├── traits.py, population.py, composite.py, factory.py, baselines.py
│   │   ├── config/                 #   Presets: get_preset_kwargs, PRESET_NAMES
│   │   ├── policies/               #   Participation, belief, reporting, staking, identity
│   │   ├── adversaries/            #   Arbitrageur, manipulator, collusion, evader, insider
│   │   └── plotting/               #   make_behaviour_dashboard (7 plots + heatmap)
│   │
│   ├── legacy_dgps/                #   Function-based DGP generators (used by mvp.py)
│   ├── dgps/                       #   Object-based DGP registry
│   ├── plotting/                   #   Shared style only (style.py)
│   ├── io/                         #   output_paths.py (ExperimentPaths)
│   └── experiments/                #   CLI, registry, summarise, config; runners/runner_module.py = all run_* experiments
│
├── scripts/                        # Entry-point scripts
│   ├── run_weight_learning.py
│   └── r/                          # R plotting scripts (ggplot2)
│
├── tests/
│   └── test_smoke.py
│
└── outputs/                        # Generated by experiments (not in source control)
    ├── core/experiments/<name>/     #   Core mechanism experiments
    │   ├── plots/, data/
    ├── behaviour/experiments/<name>/ #   Behaviour experiments
    │   ├── plots/, data/, summary.md, summary.json
    └── tests/test_results.txt
```

---

## Terminology

| Symbol | Name | Definition |
|--------|------|------------|
| `b_i` | **deposit** (stake) | money put up by agent i |
| `σ_i` | **learned performance score** | in [σ_min, 1], a monotone transform of EWMA loss |
| `m_i` | **effective wager** | `b_i · g(σ_i)` where `g(σ) = λ + (1-λ)·σ^η`, the portion at risk |
| `Π_i` | **payout** | total returned from settlement pool (≥ 0 for active agents) |
| `π_i` | **profit** | `Π_i - m_i`, can be negative (you can lose up to your wager) |
| `W_i` | **wealth** | bankroll, updated as `max(0, W + π)` each round |
| `c_i` | **confidence** | multiplier from quantile width on the observation scale (Masters notes §Step 1), in [c_min, c_max] |
| `η` | **skill gate exponent** | power-law steepness (1=linear, 2–4=recommended) |
| `ω_max` | **weight cap** | max aggregation share any single agent may hold |

> **Symbol hygiene**: To avoid collisions between mechanism and DGP variables:
> - `b_i` = deposit (mechanism), `β_i` = forecaster bias (latent DGP)
> - `m_i` = effective wager (mechanism), `μ_{i,t}` = posterior mean (latent DGP)
> - `σ_i` = learned performance score (mechanism), `τ_i` = observation noise (DGP)

---

## Deposit modes

Three deposit modes are available in `run_simulation(deposit_mode=...)`:

| Mode | How deposits are set | When to use |
|------|---------------------|-------------|
| `"exponential"` | `b ~ Exp(scale)`, independent of quality | Default baseline (random noise) |
| `"fixed"` | `b_i = fixed_deposit` for all active agents | Isolate the effect of skill learning |
| `"bankroll"` | Deterministic pipeline: wealth → confidence → deposit → skill gate → cap | Full mechanism with no random noise |

### Bankroll staking pipeline (`deposit_mode="bankroll"`)

Each round follows five steps in theorem-safe mode:

1. Prior-round state determines `σ_{i,t}`.
2. Confidence is either constant, exogenous, or **lagged from round t-1** (default: `lag_confidence=True`).
3. Deposit is chosen from wealth and that pre-round confidence signal: `b_i = min(W_i, b_max, f · W_i · c_i)`.
4. Effective wager: `m_i = b_i · (λ + (1-λ) · σ_i^η)`.
5. Current reports are scored and settlement is applied.
6. Weight cap (optional): bounded simplex projection with upper bound `ω_max`.
7. Wealth update: `W_{i,t+1} = max(0, W_{i,t} + π_{i,t})`.

Per-round truthfulness is preserved only when `b_{i,t}` and hence `m_{i,t}` are fixed with respect to the round-t report. Using current-round report width to set deposits (`lag_confidence=False`) is an empirical design variant, not a theorem-preserving one. Pass `strict_truthfulness=True` to turn that violation from a runtime warning into a hard error — recommended whenever the downstream analysis claims Lambert/Raja truthfulness.

Key parameters: `eta` (exponent, default 2.0), `W0` (initial wealth), `f_stake` (base fraction), `omega_max` (cap), `beta_c` (confidence steepness), `strict_truthfulness` (opt-in truthfulness guard).

---

## Experiments

| # | CLI name | What it tests | Key plots |
|---|----------|---------------|-----------|
| 1 | `settlement` | Budget balance, non-negative payouts, equal-score zero profit | Budget gap, profit/ROI histograms |
| 2 | `skill_wager` | Skill and wager evolution under intermittent participation | σ, wager, cumulative profit per agent |
| 3 | `aggregation` | Aggregate CRPS-hat: blended / equal / stake / skill / bankroll | Rolling + cumulative CRPS-hat (5 methods) |
| 4 | `calibration` | Quantile reliability (coverage vs nominal τ) | Reliability diagram |
| 5 | `parameter_sweep` | Grid over λ and σ_min | Heatmaps (CRPS, Gini) |
| 6 | `sybil` | Sybil resistance — splitting identities doesn't help | Profit difference and ratio by k |
| 7 | `scoring` | Point/MAE vs quantiles/CRPS-hat side-by-side | Invariant table, σ evolution, profit |
| 8 | `fixed_deposit` | Isolate skill effect (fixed deposits) | σ, wager, profit |
| 9 | `skill_recovery` | Bayes-consistent latent DGP — verify skill ordering | τ vs loss/σ, PIT, calibration |
| 10 | `baseline_dgp` | Baseline DGP diagnostic (y ~ U(0,1)) | Truth vs reports, noise vs MAE |
| 11 | `latent_fixed_dgp` | Latent-fixed DGP diagnostic (Φ(Z)) | Shrinkage, fan charts, calibration |
| 12 | `aggregation_dgp` | Aggregation DGP diagnostic (methods 1 & 3) | Truth vs reports, scatter, MAE |
| 13 | `dgp_comparison` | Side-by-side comparison of all 4 DGPs | Time series, distributions, scatter |
| 14 | `weight_comparison` | Weight learning: exogenous vs endogenous DGPs | Convergence, target vs learned |
| 15 | `weight_rules` | Five weight rules (uniform, deposit, skill, mechanism, best-single) under two deposit policies | CRPS by method, warm-start |
| 16 | `deposit_policies` | Four deposit policies under Mechanism weight rule (IID-Exp, Fixed-Unit, Oracle-Precision, Bankroll-Confidence) | CRPS by regime |
| 17 | `selective_participation` | Strategic missingness: κ=0 (freeze) vs κ>0 (decay) | Skill and profit under selective absence |

---

## Mechanism notes

### Scoring rules

- **Point/MAE** (`point_mae`): elicits a **median-type** point forecast.
  `s = 1 - |y - r|`, bounded in [0,1] for `y, r ∈ [0,1]`.
  Absolute loss is proper for the median, and strictly proper only when the predictive median is unique.
- **Quantiles/CRPS-hat** (`quantiles_crps`): elicits a **grid of predictive quantiles**.
  `s = 1 - Ĉ/2`, where `Ĉ = (2/K) Σ_k L^{τ_k}`.
  This is a finite-grid quantile approximation to CRPS, not exact CRPS.
- Both modes satisfy the bounded-score requirement `s ∈ [0,1]`.

### Weighted quantile averaging

The aggregate forecast is the pointwise wager-weighted average:
`q̂_t(τ_k) = Σ_i w_i · q_{i,t}(τ_k)`, `w_i = m_i / Σ_j m_j`.

For point reports this reduces to a weighted arithmetic mean.
For quantile reports this is pointwise weighted quantile averaging.
It should not be described as quasi-arithmetic pooling unless that operator is actually implemented.

### ROI bounds

Skill pool: `π_skill_i / m_i = s_i - s̄ ∈ [-1, 1]`.
When utility U > 0, total ROI can exceed 1. The bound applies only to the skill pool.

### Round ordering

In theorem-safe mode (`lag_confidence=True`, default): `σ_t` from `L_{t-1}` → lagged confidence or precommitted deposit → `m_t` → current report → score `s_t` → settle → update `L_t`.

Per-round truthfulness holds only if `m_{i,t}` is fixed with respect to `r_{i,t}`. The effective wager `m_{i,t} = b_{i,t}(λ + (1-λ)σ_{i,t}^η)` satisfies this when `b_{i,t}` is precommitted or derived from lagged information. If `b_{i,t}` is computed from the current report width (`lag_confidence=False`), the standard Lambert truthfulness argument does not apply.

### Sybil resistance

The mechanism is invariant to identity splits or merges only in the narrow case where the split identities submit identical reports and the total wager is conserved. This should not be stated as a general sybilproofness result for arbitrary dynamic behaviour.

---

## DGPs (data generating processes)

| Name | Truth source | Description |
|------|-------------|-------------|
| `baseline` | Exogenous | y ~ U(0,1); reports = y + noise (τ_i) |

Note: the baseline DGP is a diagnostic toy design. Because reports are built from the realised `y_t` plus clipping, boundary effects can distort MAE and CRPS comparisons near 0 and 1. Use the latent-fixed DGP for cleaner skill-recovery claims.

| `latent_fixed` | Exogenous | Z ~ N(0,σ_z²), y = Φ(Z); Bayes-consistent reports |
| `aggregation_method1` | Endogenous | y = w @ x_latent + noise; shared AR(1) mean |
| `aggregation_method3` | Endogenous | Adds per-forecaster mean shocks η |

---

## Unit tests

**29 inline tests in `mvp.py`**: run with `python mvp.py`.

Core mechanism: two-player closed form, equal-score zero profit, permutation invariance,
zero-wager dummy, score shift invariance, ROI bounds (skill pool), near-zero wager.

Scoring: MAE median sanity, pinball non-negativity, CRPS non-neg/bounds/ordering, score bounds.

Missing agents: exclusion, all-missing zero payout, zero-element fields.

Budget: identity with utility, sigma timing, wager independence of current loss.

Smoke: quantiles + utility, extreme parameters.

Bankroll staking: budget balanced, wealth non-negative, deposit ≤ wealth, wager ≤ deposit,
skill gate effect, weight cap, wager-skill correlation, eta backward compatibility.

**Pytest tests in `tests/`**: run with `pytest -q`. Includes `test_smoke.py`, `test_behaviour_boundary.py`, `test_metrics.py`, `test_arbitrageur.py` (boundary, action validation, identity invariants, reproducibility, metrics, arbitrageur constraints).

---

## Old API (deposit_mode) and new behaviour API

**Old API still works**: `run_simulation(deposit_mode="exponential"|"fixed"|"bankroll", ...)` in `mvp.py` runs the original pipeline with no behaviour layer. All existing core experiments use this or the legacy DGP generators.

**New behaviour API**: Behaviour experiments use `BehaviourModel.act(RoundPublicState)` to produce a list of `AgentAction`; the core `run_round(state, params, actions, y_t)` consumes those actions. Use `make_behaviour(preset_name, n_users=..., seed=...)` from `onlinev2.behaviour.factory` to build a model from a named preset. Example for `behaviour_matrix`: build population with presets from `onlinev2.behaviour.config`, then wrap in `CompositeBehaviourModel`; or call `make_behaviour("BURSTY_REALISTIC", n_users=10, seed=42)` to get a ready-to-use model.
