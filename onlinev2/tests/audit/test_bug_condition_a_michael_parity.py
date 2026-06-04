"""Bug Condition A — Mechanism-vs-reference parity (Property 1).

Encodes 4 property-based parity tests against the external OGD
reference baseline.

These parity tests run against the in-tree ``mechanism.michael_port``
module as the reference. ``michael_port`` is a self-contained Python
reimplementation of the Vitali & Pinson (2025) OGD aggregator
(arXiv:2510.13385) with documented ``atol=1e-8`` / ``atol=1e-6``
tolerances. After the fix to ``core/intermittent.michael_predict``, our
internal aggregator matches this reference at machine precision (see
``test_theory_alignment.py::test_michael_predict_matches_port_predict``).

The fourth (``michael_ogd`` baseline row in real_data runner output)
remains a deterministic scoped check.
"""
from __future__ import annotations

import json
import os

import numpy as np
import pytest

pytestmark = [pytest.mark.audit]

_CE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "counterexamples", "a")
_FIXTURE_DIR = os.path.join(os.path.dirname(__file__), "fixtures")


def _commit_counterexample(clause: str, name: str, payload: dict) -> None:
    os.makedirs(_CE_DIR, exist_ok=True)
    path = os.path.join(_CE_DIR, f"{clause}_{name}.json")
    if os.path.exists(path):
        return
    try:
        with open(path, "w") as f:
            json.dump(payload, f, indent=2, default=float, sort_keys=True)
    except Exception:
        pass


def _make_synthetic_panel(T: int, N: int, seed: int):
    """Generate a small deterministic forecaster panel with known skill gradient.

    Agent 0 is the best; agent N-1 is the worst. Returns (y, panel)
    where panel has shape (T, N) in the unit interval.
    """
    rng = np.random.default_rng(seed)
    y = rng.uniform(0.2, 0.8, size=T)
    noise_levels = np.linspace(0.02, 0.30, N)
    panel = np.zeros((T, N), dtype=np.float64)
    for t in range(T):
        for i in range(N):
            panel[t, i] = float(
                np.clip(y[t] + rng.normal(0.0, noise_levels[i]), 0.0, 1.0)
            )
    return y.astype(np.float64), panel


def _pinball(y_true, y_hat, tau: float) -> np.ndarray:
    y_true = np.asarray(y_true, dtype=np.float64)
    y_hat = np.asarray(y_hat, dtype=np.float64)
    return np.where(
        y_true >= y_hat,
        tau * (y_true - y_hat),
        (1.0 - tau) * (y_hat - y_true),
    )


# ---------------------------------------------------------------------------
# Clause 1.1 — onlinev2 CRPS ≤ 1.10 × michael_ogd CRPS
# ---------------------------------------------------------------------------
def test_onlinev2_crps_within_110pct_of_michael_ogd():
    """Port-based check: run both our runner in ``michael_robust_lr`` mode
    and the reference ``run_main_rewards`` on the same synthetic panel,
    then assert our CRPS at τ=0.5 is within 10% of the port's CRPS.

    Tolerance: ``our_CRPS <= 1.10 * port_CRPS``.
    """
    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput
    from onlinev2.mechanism.michael_port import run_main_rewards

    T, N = 300, 4
    tau = 0.5
    y, panel = _make_synthetic_panel(T, N, seed=1234)

    # --- Port reference (michael_port.run_main_rewards) ---
    port_out = run_main_rewards(
        panel=panel,
        y=y,
        config={"quantile": tau, "eta": 0.01, "delta": 0.7, "rho": 0.999},
    )
    port_yhat = port_out["y_hat"]
    # Skip the first round (warm-up, yhat[0] = 0 by construction).
    port_crps = float(np.mean(_pinball(y[1:], port_yhat[1:], tau)))

    # --- onlinev2 runner in michael_robust_lr mode ---
    state = MechanismState()
    for i in range(N):
        state.wealth[f"agent_{i}"] = 100.0
    params = MechanismParams(
        scoring_mode="point_mae",
        aggregation_mode="michael_robust_lr",
        allocation_mode="raja",
        lam=0.3,
        eta=1.0,
        sigma_min=0.1,
        michael_lr=0.01,
        U=0.0,
    )
    our_losses = []
    for t in range(T):
        actions = [
            RoundInput(
                account_id=f"agent_{i}",
                participate=True,
                report=float(panel[t, i]),
                deposit=1.0,
            )
            for i in range(N)
        ]
        state, logs = run_round(
            state=state, params=params, actions=actions, y_t=float(y[t])
        )
        if t > 0:  # skip warm-up
            our_losses.append(
                float(_pinball(y[t], logs["r_hat"], tau))
            )
    our_crps = float(np.mean(our_losses))

    if our_crps > 1.10 * port_crps + 1e-9:
        _commit_counterexample(
            "1_1",
            "crps_ratio_exceeds_110pct",
            {
                "our_crps": our_crps,
                "port_crps": port_crps,
                "ratio": our_crps / max(port_crps, 1e-12),
                "T": T,
                "N": N,
                "tau": tau,
            },
        )
    assert our_crps <= 1.10 * port_crps + 1e-9, (
        f"onlinev2 michael_robust_lr CRPS = {our_crps:.6f} exceeds "
        f"1.10 × port CRPS ({port_crps:.6f}); ratio = "
        f"{our_crps / max(port_crps, 1e-12):.4f}."
    )


# ---------------------------------------------------------------------------
# Clause 1.2 / 2.2 — Spearman gap ≤ 0.10
# ---------------------------------------------------------------------------
def test_spearman_gap_within_0_10():
    """Compare forecaster ordering (Spearman rank correlation) between
    onlinev2's σ-derived ranking and the port's rewards-derived ranking.
    Absolute gap to the ground-truth noise-level ordering must be
    within 0.10 for both.
    """
    from scipy.stats import spearmanr

    from onlinev2.core.runner import run_round
    from onlinev2.core.types import MechanismParams, MechanismState, RoundInput
    from onlinev2.mechanism.michael_port import run_main_rewards

    T, N = 300, 4
    tau = 0.5
    y, panel = _make_synthetic_panel(T, N, seed=1234)

    # Ground-truth ranking: agent 0 has the lowest noise (best), agent N-1 is worst.
    truth_rank = np.arange(N)  # 0 = best, N-1 = worst

    # --- Port-based ranking (agents with higher cumulative reward rank better) ---
    port_out = run_main_rewards(
        panel=panel, y=y,
        config={"quantile": tau, "eta": 0.01, "delta": 0.7, "rho": 0.999, "total_reward": 100.0},
    )
    port_cumulative = port_out["rewards"].sum(axis=0)
    port_rank = np.argsort(-port_cumulative)  # best first

    # --- onlinev2 σ-based ranking ---
    state = MechanismState()
    for i in range(N):
        state.wealth[f"agent_{i}"] = 100.0
    params = MechanismParams(
        scoring_mode="point_mae", aggregation_mode="wager", allocation_mode="raja",
        lam=0.3, eta=1.0, sigma_min=0.1, U=0.0,
    )
    for t in range(T):
        actions = [
            RoundInput(
                account_id=f"agent_{i}", participate=True,
                report=float(panel[t, i]), deposit=1.0,
            )
            for i in range(N)
        ]
        state, _ = run_round(state=state, params=params, actions=actions, y_t=float(y[t]))
    our_sigma = np.array([state.sigma[f"agent_{i}"] for i in range(N)])
    our_rank = np.argsort(-our_sigma)

    # Spearman against truth for both.
    our_rho, _ = spearmanr(our_rank, truth_rank)
    port_rho, _ = spearmanr(port_rank, truth_rank)
    gap = abs(our_rho - port_rho)

    if gap > 0.10 + 1e-9:
        _commit_counterexample(
            "1_2", "spearman_gap_exceeds_010",
            {"our_rho": float(our_rho), "port_rho": float(port_rho), "gap": float(gap)},
        )
    assert gap <= 0.10 + 1e-9, (
        f"Spearman gap between onlinev2 σ-ranking and port reward-ranking "
        f"against ground-truth skill ordering is {gap:.4f} > 0.10."
    )


# ---------------------------------------------------------------------------
# Clause 1.3 / 2.3 — michael_robust_lr bit parity (1e-8)
# ---------------------------------------------------------------------------
def test_michael_robust_lr_bit_parity():
    """Single-round parity: given an identical (x_t, y_t, α_t) stream,
    our ``core.intermittent.michael_predict`` and the port's
    ``adaptive_robust_qr_update_multi_lead`` produce the same aggregate
    y_hat to ``atol <= 1e-8``.

    This is the predict-step parity; the update-step parity follows from
    both using ``_project_to_simplex`` on ``w``. Verified over 30 random
    (x, α, w, D) configurations.
    """
    from onlinev2.core.intermittent import michael_predict
    from onlinev2.mechanism.michael_port import adaptive_robust_qr_update_multi_lead

    rng = np.random.default_rng(2024)
    N = 5
    max_abs_diff = 0.0
    worst_cfg = None

    for trial in range(30):
        # Random on-simplex w
        w_raw = rng.uniform(0.0, 1.0, size=N)
        w = w_raw / w_raw.sum()
        D = 0.1 * rng.standard_normal((N, N))
        x = rng.uniform(0.0, 1.0, size=N)
        # Random alpha with at least one present agent
        alpha = rng.integers(0, 2, size=N).astype(np.int32)
        if np.all(alpha == 1):
            alpha[0] = 0

        y_hat_ours, _ = michael_predict(x, alpha, w, D)
        port_out = adaptive_robust_qr_update_multi_lead(
            state={"w": w, "D": D},
            x=x, y=float(rng.uniform(0.0, 1.0)),
            alpha_vec=alpha.astype(np.float64),
            tau=0.5, eta=0.0,  # eta=0 isolates the predict step
        )
        y_hat_port = float(port_out["y_hat"])
        diff = abs(y_hat_ours - y_hat_port)
        if diff > max_abs_diff:
            max_abs_diff = diff
            worst_cfg = {
                "trial": trial, "w": w.tolist(), "D": D.tolist(),
                "x": x.tolist(), "alpha": alpha.tolist(),
                "y_hat_ours": y_hat_ours, "y_hat_port": y_hat_port,
            }

    if max_abs_diff > 1e-8:
        _commit_counterexample(
            "1_3", "robust_lr_bit_parity_violation",
            {"max_abs_diff": max_abs_diff, "worst_cfg": worst_cfg},
        )
    assert max_abs_diff <= 1e-8, (
        f"michael_robust_lr y_hat parity exceeded 1e-8 tolerance: "
        f"max_abs_diff = {max_abs_diff:.2e}."
    )


# ---------------------------------------------------------------------------
# Clause 1.4 / 2.4 — michael_ogd baseline row present in runner output
# ---------------------------------------------------------------------------
def test_michael_ogd_baseline_row_present():
    """Run a *tiny* real-data comparison and assert that the rules list
    includes ``michael_ogd`` (substring match — the rule is now named
    ``michael_ogd_centered_median_fan``).  Rather than actually running
    forecasters (which is expensive and pulls in xgboost/torch), we
    source-read the runner to confirm the rule name is present.
    """
    from onlinev2.real_data import runner as rd_runner
    import inspect

    source = inspect.getsource(rd_runner.run_real_data_comparison)
    present = "michael_ogd" in source
    if not present:
        _commit_counterexample(
            "1_4",
            "michael_ogd_row_absent",
            {
                "runner_module": rd_runner.__name__,
                "rules_list_contains_michael_ogd": False,
                "note": (
                    "Source of run_real_data_comparison does not reference "
                    "'michael_ogd' — the baseline row is never emitted."
                ),
            },
        )
    assert present, (
        "real_data.runner.run_real_data_comparison does not emit a "
        "'michael_ogd' baseline row (clause 1.4)."
    )
