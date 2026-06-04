# Snapshot Manifest

Golden-value snapshots used to guarantee preservation of the current
mainline output of every production function touched by this bugfix
spec.  Each snapshot is keyed by `(module, function, seed)` and serialised
as JSON.

**Capture policy.**  Snapshots are NOT captured in Task 1.  Each fix task
(2–6) captures the snapshots for the functions it is about to touch
*before* applying the fix, using `snapshots.capture(...)`.  Post-fix,
`snapshots.assert_matches(...)` asserts bit-identical output on the
non-buggy seeds in `AUDIT_SEEDS = [0, 1, 2, 42, 2024]`.

**Coverage.**  The table below is the full set of functions that could
be touched if all five bug conditions fire.  Gated entries (e.g. the
Michael port parity) only require a snapshot if their bug condition
fires.

| Module | Function | Mode | Touched by task | Status |
|---|---|---|---|---|
| `core/skill.py` | `loss_to_skill` | `(L_ref, σ_min=0.1, γ=2.0)` | 2 (D) | ✓ captured × 5 seeds |
| `core/skill.py` | `update_ewma_loss` | `(L_prev, losses, α, ρ=0.1, κ=0, L0)` | 2 (D) | ✓ captured × 5 seeds |
| `core/skill.py` | `calibrate_gamma` | `(σ_ref=0.5, σ_min=0.1, L_ref)` | 2 (D) | ✓ captured × 5 seeds |
| `core/skill.py` | `default_initial_loss` | `(σ_min=0.1, γ=2.0, σ_init=0.9)` | 2 (D) | ✓ captured × 5 seeds |
| `core/aggregation.py` | `aggregate_forecast` (point) | 1-D reports | 5 (B) |
| `core/aggregation.py` | `aggregate_forecast` (quantile) | 2-D reports + monotone | 5 (B) |
| `core/metrics.py` | `validate_quantile_monotonicity` | canonical quantile | 5 (B) |
| `core/settlement.py` | `settle_round` | canonical settlement | 3 (E) | ✓ captured × 5 seeds |
| `core/settlement.py` | `raja_competitive_payout` | (scores, m) | 3 (E) | ✓ captured × 5 seeds |
| `core/settlement.py` | `utility_payoff` | (s, m, s_c, U) | 3 (E) | ✓ captured × 5 seeds |
| `core/settlement.py` | `skill_payoff` | (s, m, α) | 3 (E) | ✓ captured × 5 seeds |
| `core/staking.py` | `effective_wager_bankroll` | (b, σ, λ, η) | 3 (E) | ✓ captured × 5 seeds |
| `core/staking.py` | `choose_deposits` | (W, c, α, f, b_max) | 3 (E) | ✓ captured × 5 seeds |
| `core/staking.py` | `update_wealth` | (W, profit) | 3 (E) | ✓ captured × 5 seeds |
| `core/staking.py` | `cap_weight_shares` | (m, ω_max) | 3 (E) | ✓ captured × 5 seeds |
| `core/weights.py` | `effective_wager` | (b, σ, λ, η) | 3 (E) | ✓ captured × 5 seeds |
| `core/michael_allocation.py` | `michael_oos_allocation` | (losses, α) | 3 (E) | ✓ captured × 5 seeds |
| `core/michael_allocation.py` | `michael_rewards` | (U, δ, r_is, r_oos) | 3 (E) | ✓ captured × 5 seeds |
| `core/michael_allocation.py` | `normalise_present` | (v, α) | 3 (E) | ✓ captured × 5 seeds |
| `real_data/forecasters.py` | `NaiveForecaster.predict` | canonical history | 4 (C) |
| `real_data/forecasters.py` | `NaiveForecaster.predict_quantiles` | canonical taus | 4 (C) |
| `real_data/forecasters.py` | `MovingAverageForecaster.predict` | canonical history | 4 (C) |
| `real_data/forecasters.py` | `MovingAverageForecaster.predict_quantiles` | canonical taus | 4 (C) |
| `real_data/forecasters.py` | `ARIMAForecaster.predict` | canonical history | 4 (C) |
| `real_data/forecasters.py` | `ARIMAForecaster.predict_quantiles` | canonical taus | 4 (C) |
| `real_data/forecasters.py` | `XGBoostForecaster.predict` | canonical history | 4 (C) |
| `real_data/forecasters.py` | `XGBoostForecaster.predict_quantiles` | canonical taus | 4 (C) |
| `real_data/forecasters.py` | `MLPForecaster.predict` | canonical history | 4 (C) |
| `real_data/forecasters.py` | `MLPForecaster.predict_quantiles` | canonical taus | 4 (C) |
| `real_data/forecasters.py` | `ThetaForecaster.predict` | canonical history | 4 (C) |
| `real_data/forecasters.py` | `ThetaForecaster.predict_quantiles` | canonical taus | 4 (C) |
| `real_data/forecasters.py` | `EnsembleForecaster.predict` | canonical history | 4 (C) |
| `real_data/forecasters.py` | `EnsembleForecaster.predict_quantiles` | canonical taus | 4 (C) |
| `real_data/runner.py` | `run_real_data_comparison` (rows) | Elia slice T=500, N=7 | 6 (A) |
| `core/runner.py` | `run_round` (`michael_robust_lr`) | AR(1) T=300, N=4 | 6 (A) |

Entries are appended/updated by each fix task as snapshots are captured.
