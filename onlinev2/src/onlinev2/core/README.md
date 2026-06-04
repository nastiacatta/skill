# Core (canonical mechanism)

Deterministic platform logic for the online wagering mechanism. **This is the single source of truth** for scoring, aggregation, settlement, skill updates, and the round runner.

- **`types.py`** — MechanismParams, MechanismState, AgentInput, Report.
- **`runner.py`** — run_round(state, params, actions, y_t): pure deterministic round execution.
- **`scoring.py`** — Loss and score functions (MAE, CRPS-hat, pinball).
- **`aggregation.py`** — Quantile averaging by effective wager weights.
- **`settlement.py`** — Lambert skill pool + utility payoff, profit.
- **`skill.py`** — EWMA loss, loss-to-skill mapping, calibrate_gamma, missingness_L0.
- **`weights.py`** — Effective wager and refund.
- **`staking.py`** — Confidence, choose_deposits, cap_weight_shares, update_wealth.
- **`metrics.py`** — PIT, sharpness, HHI, N_eff, Gini, NetworkExporter (in-memory only).

**Boundary:** Core does **not** import `onlinev2.behaviour`. No plotting, no CSV writing, no subprocess. The behaviour layer produces actions that satisfy the AgentInput protocol; the simulator passes them into `run_round`.

**Compatibility:** `onlinev2.mechanism` re-exports from `onlinev2.core` for backward compatibility. Prefer `onlinev2.core` in new code and docs.
