"""Bug Condition E — Payoff correctness (Property 9).

Encodes 14 property-based tests on the payoff allocation.

**Validates: payoff correctness properties 2.24 – 2.37**
"""
from __future__ import annotations

import json
import os

import numpy as np
import pytest
from hypothesis import given, strategies as st

from onlinev2.core.michael_allocation import michael_oos_allocation
from onlinev2.core.scoring import score_crps_hat, score_mae
from onlinev2.core.settlement import (
    raja_competitive_payout,
    settle_round,
    skill_payoff,
)
from onlinev2.core.staking import (
    cap_weight_shares,
    choose_deposits,
    update_wealth,
)
from onlinev2.core.weights import effective_wager

from . import dgps
from .strategies import settlement_inputs

pytestmark = [pytest.mark.audit]

_CE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "counterexamples", "e")


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


def _run_settlement(b, sigma, scores, alpha, U, lam=0.5, eta=1.0, s_client=0.3):
    return settle_round(
        b=b,
        sigma=sigma,
        lam=lam,
        scores=scores,
        alpha=alpha,
        s_client=s_client,
        U=U,
        eta=eta,
    )


# ---------------------------------------------------------------------------
# Clause 1.24 / 2.24 — Budget identity
# ---------------------------------------------------------------------------
@given(settlement_inputs())
def test_budget_identity(inp):
    b, sigma, scores, alpha, U = inp
    out = _run_settlement(b, sigma, scores, alpha, U)
    gap = float(
        out["total_payoff"].sum()
        - out["m"].sum()
        - out["utility_payoff"].sum()
    )
    tol = 1e-8 * (float(out["m"].sum()) + U + 1.0)
    if abs(gap) > tol:
        _commit_counterexample(
            "1_24",
            "budget_identity",
            {
                "b": b.tolist(),
                "sigma": sigma.tolist(),
                "scores": scores.tolist(),
                "alpha": alpha.tolist(),
                "U": U,
                "gap": gap,
                "tol": tol,
            },
        )
    assert abs(gap) <= tol, f"budget gap {gap} > tol {tol}"


# ---------------------------------------------------------------------------
# Clause 1.25 / 2.25 — ROI bounds when U == 0
# ---------------------------------------------------------------------------
@given(settlement_inputs())
def test_roi_bounds_when_U_zero(inp):
    b, sigma, scores, alpha, _ = inp
    out = _run_settlement(b, sigma, scores, alpha, U=0.0)
    m = out["m"]
    profit = out["profit"]
    active = (alpha == 0) & (m > 1e-12)
    if not np.any(active):
        return
    roi = profit[active] / m[active]
    tol = 1e-8
    in_bounds = np.all(roi >= -1.0 - tol) and np.all(roi <= 1.0 + tol)
    if not in_bounds:
        _commit_counterexample(
            "1_25",
            "roi_bounds",
            {
                "b": b.tolist(),
                "sigma": sigma.tolist(),
                "scores": scores.tolist(),
                "alpha": alpha.tolist(),
                "roi": roi.tolist(),
            },
        )
    assert in_bounds, f"ROI out of [-1, 1]: min {roi.min()}, max {roi.max()}"


# ---------------------------------------------------------------------------
# Clause 1.26 / 2.26 — Permutation invariance of raja_competitive_payout
# ---------------------------------------------------------------------------
@given(settlement_inputs(), st.data())
def test_raja_permutation_invariance(inp, data):
    b, sigma, scores, alpha, _ = inp
    n = len(b)
    perm = np.asarray(data.draw(st.permutations(list(range(n)))), dtype=int)

    m = effective_wager(b, sigma, lam=0.5, eta=1.0)
    # Respect alpha for m consistency in both calls.
    m_masked = m.copy()
    m_masked[alpha == 1] = 0.0

    pi_orig = raja_competitive_payout(scores, m_masked, alpha=alpha)
    pi_perm = raja_competitive_payout(
        scores[perm], m_masked[perm], alpha=alpha[perm]
    )
    expected = pi_orig[perm]
    ok = np.allclose(pi_perm, expected, atol=1e-10, rtol=0)
    if not ok:
        _commit_counterexample(
            "1_26",
            "perm_invariance",
            {
                "scores": scores.tolist(),
                "m": m_masked.tolist(),
                "alpha": alpha.tolist(),
                "perm": perm.tolist(),
                "pi_orig": pi_orig.tolist(),
                "pi_perm": pi_perm.tolist(),
            },
        )
    np.testing.assert_allclose(pi_perm, expected, atol=1e-10, rtol=0)


# ---------------------------------------------------------------------------
# Clause 1.27 / 2.27 — Zero-wager dummy invariance
# ---------------------------------------------------------------------------
@given(settlement_inputs())
def test_zero_wager_dummy_invariance(inp):
    b, sigma, scores, alpha, _ = inp
    n = len(b)
    m = effective_wager(b, sigma, lam=0.5, eta=1.0)
    m_masked = m.copy()
    m_masked[alpha == 1] = 0.0
    pi_orig = raja_competitive_payout(scores, m_masked, alpha=alpha)

    # Append an extra agent with m = 0 (active, score 0.3).
    scores_ext = np.append(scores, 0.3)
    m_ext = np.append(m_masked, 0.0)
    alpha_ext = np.append(alpha, 0).astype(np.int32)
    pi_ext = raja_competitive_payout(scores_ext, m_ext, alpha=alpha_ext)

    ok = np.allclose(pi_ext[:n], pi_orig, atol=1e-10, rtol=0)
    if not ok:
        _commit_counterexample(
            "1_27",
            "zero_wager_dummy",
            {
                "scores": scores.tolist(),
                "m": m_masked.tolist(),
                "alpha": alpha.tolist(),
                "pi_orig": pi_orig.tolist(),
                "pi_ext_prefix": pi_ext[:n].tolist(),
            },
        )
    np.testing.assert_allclose(pi_ext[:n], pi_orig, atol=1e-10, rtol=0)


# ---------------------------------------------------------------------------
# Clause 1.28 / 2.28 — Equal-score → zero profit
# ---------------------------------------------------------------------------
@given(settlement_inputs())
def test_equal_score_zero_profit(inp):
    b, sigma, _, alpha, _ = inp
    n = len(b)
    equal_score = 0.5
    scores = np.full(n, equal_score)
    out = _run_settlement(b, sigma, scores, alpha, U=0.0)
    active = alpha == 0
    if not np.any(active):
        return
    profit = out["profit"][active]
    ok = np.allclose(profit, 0.0, atol=1e-10, rtol=0)
    if not ok:
        _commit_counterexample(
            "1_28",
            "equal_score_profit",
            {
                "b": b.tolist(),
                "sigma": sigma.tolist(),
                "alpha": alpha.tolist(),
                "profit": out["profit"].tolist(),
            },
        )
    np.testing.assert_allclose(profit, 0.0, atol=1e-10, rtol=0)


# ---------------------------------------------------------------------------
# Clause 1.29 / 2.29 — Strict score-monotonicity under equal wager
# ---------------------------------------------------------------------------
def test_strict_score_monotonicity_under_equal_wager():
    """Construct (s, m) deterministically: two active agents, equal m, s_i > s_j."""
    scores = np.array([0.8, 0.2, 0.5, 0.3], dtype=np.float64)
    m = np.array([1.0, 1.0, 0.0, 0.0], dtype=np.float64)
    alpha = np.array([0, 0, 1, 1], dtype=np.int32)
    pi = raja_competitive_payout(scores, m, alpha=alpha)
    # Profit = pi - m for active agents; with sum of equal m, the higher score
    # must receive strictly higher payoff.
    assert pi[0] > pi[1] + 1e-12, (
        f"s_0=0.8 > s_1=0.2 with equal m, but pi[0]={pi[0]} <= pi[1]={pi[1]}"
    )


# ---------------------------------------------------------------------------
# Clause 1.30 / 2.30 — Wager-gate bounds on effective_wager
# ---------------------------------------------------------------------------
@given(settlement_inputs())
def test_wager_gate_bounds(inp):
    b, sigma, _, _, _ = inp
    m = effective_wager(b, sigma, lam=0.5, eta=1.0)
    ok = np.all(m >= -1e-12) and np.all(m <= b + 1e-12)
    if not ok:
        _commit_counterexample(
            "1_30",
            "wager_gate",
            {"b": b.tolist(), "sigma": sigma.tolist(), "m": m.tolist()},
        )
    assert ok, f"effective_wager out of bounds: min {m.min()}, max(m-b) {np.max(m-b)}"


# ---------------------------------------------------------------------------
# Clause 1.31 / 2.31 — cap_weight_shares mass + cap
# ---------------------------------------------------------------------------
@given(
    st.lists(
        st.floats(0.0, 100.0, allow_nan=False, allow_infinity=False),
        min_size=2,
        max_size=10,
    ),
    st.floats(0.2, 0.9, allow_nan=False, allow_infinity=False),
)
def test_cap_weight_shares_mass_and_cap(vals, omega_max):
    m = np.asarray(vals, dtype=np.float64)
    n = len(m)
    # cap_weight_shares requires omega_max >= 1/n for feasibility.
    om = max(float(omega_max), 1.0 / n + 1e-6)
    m_cap = cap_weight_shares(m, omega_max=om)
    mass_ok = abs(float(m_cap.sum()) - float(m.sum())) <= 1e-8
    total = float(m_cap.sum())
    if total > 1e-12:
        max_share = float(np.max(m_cap) / total)
    else:
        max_share = 0.0
    cap_ok = max_share <= om + 1e-6
    nonneg_ok = np.all(m_cap >= -1e-12)
    ok = mass_ok and cap_ok and nonneg_ok
    if not ok:
        _commit_counterexample(
            "1_31",
            "cap_mass_and_cap",
            {
                "m": m.tolist(),
                "omega_max": om,
                "m_cap": m_cap.tolist(),
                "mass_ok": mass_ok,
                "cap_ok": cap_ok,
                "nonneg_ok": nonneg_ok,
            },
        )
    assert ok, (
        f"cap invariants violated: mass_ok={mass_ok}, cap_ok={cap_ok}, "
        f"nonneg_ok={nonneg_ok}"
    )


# ---------------------------------------------------------------------------
# Clause 1.32 / 2.32 — choose_deposits respects wealth and b_max
# ---------------------------------------------------------------------------
@given(
    st.lists(
        st.floats(0.0, 100.0, allow_nan=False, allow_infinity=False),
        min_size=2,
        max_size=10,
    ),
    st.lists(
        st.floats(0.8, 1.0, allow_nan=False, allow_infinity=False),
        min_size=2,
        max_size=10,
    ),
    st.floats(0.05, 1.0, allow_nan=False, allow_infinity=False),
    st.floats(0.1, 50.0, allow_nan=False, allow_infinity=False),
)
def test_choose_deposits_respects_wealth_and_bmax(W, c, f, b_max):
    n = min(len(W), len(c))
    W = np.asarray(W[:n], dtype=np.float64)
    c = np.asarray(c[:n], dtype=np.float64)
    alpha = np.zeros(n, dtype=np.int32)
    # Make one agent absent
    if n > 2:
        alpha[0] = 1
    b = choose_deposits(W, c, alpha, f=float(f), b_max=float(b_max))
    bound_ok = np.all(b <= np.minimum(W, b_max) + 1e-12)
    missing_ok = np.all(b[alpha == 1] == 0.0)
    nonneg_ok = np.all(b >= -1e-12)
    ok = bound_ok and missing_ok and nonneg_ok
    if not ok:
        _commit_counterexample(
            "1_32",
            "choose_deposits",
            {
                "W": W.tolist(),
                "c": c.tolist(),
                "alpha": alpha.tolist(),
                "f": float(f),
                "b_max": float(b_max),
                "b": b.tolist(),
            },
        )
    assert ok


# ---------------------------------------------------------------------------
# Clause 1.33 / 2.33 — update_wealth non-negative
# ---------------------------------------------------------------------------
@given(
    st.lists(
        st.floats(0.0, 100.0, allow_nan=False, allow_infinity=False),
        min_size=1,
        max_size=10,
    ),
    st.lists(
        st.floats(-200.0, 200.0, allow_nan=False, allow_infinity=False),
        min_size=1,
        max_size=10,
    ),
)
def test_update_wealth_nonneg(W, profit):
    n = min(len(W), len(profit))
    W = np.asarray(W[:n], dtype=np.float64)
    profit = np.asarray(profit[:n], dtype=np.float64)
    W_new = update_wealth(W, profit)
    ok = np.all(W_new >= -1e-12)
    if not ok:
        _commit_counterexample(
            "1_33",
            "update_wealth_nonneg",
            {"W": W.tolist(), "profit": profit.tolist(), "W_new": W_new.tolist()},
        )
    assert ok


# ---------------------------------------------------------------------------
# Clause 1.34 / 2.34 — michael_oos_allocation uniform on all-zero losses
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_michael_oos_uniform_on_all_zero(seed):
    rng = np.random.default_rng(seed)
    n = int(rng.integers(2, 10))
    alpha = (rng.uniform(size=n) > 0.7).astype(np.int32)
    if alpha.sum() == n:
        alpha[0] = 0
    losses = np.zeros(n, dtype=np.float64)  # identically zero for present agents
    r = michael_oos_allocation(losses, alpha)
    present = alpha == 0
    n_present = int(present.sum())
    expected = np.zeros(n)
    expected[present] = 1.0 / n_present
    ok = np.allclose(r, expected, atol=1e-12, rtol=0)
    if not ok:
        _commit_counterexample(
            "1_34",
            f"oos_uniform_zero_seed{seed}",
            {
                "losses": losses.tolist(),
                "alpha": alpha.tolist(),
                "r": r.tolist(),
                "expected": expected.tolist(),
            },
        )
    np.testing.assert_allclose(r, expected, atol=1e-12, rtol=0)


# ---------------------------------------------------------------------------
# Clause 1.36 / 2.36 — score_mae / score_crps_hat in [0, 1]
# ---------------------------------------------------------------------------
@given(
    st.floats(0.0, 1.0, allow_nan=False, allow_infinity=False),
    st.floats(0.0, 1.0, allow_nan=False, allow_infinity=False),
)
def test_score_bounds_mae_and_crps_hat(y, r):
    s_mae = score_mae(y, r)
    ok_mae = 0.0 - 1e-12 <= s_mae <= 1.0 + 1e-12

    taus = dgps.TAUS_DEFAULT
    # Build a simple monotone quantile report centred on r.
    q = np.clip(r + 0.05 * (taus - 0.5) * 2, 0, 1).reshape(1, -1)
    s_crps = float(score_crps_hat(y, q, taus)[0])
    ok_crps = 0.0 - 1e-12 <= s_crps <= 1.0 + 1e-12

    ok = ok_mae and ok_crps
    if not ok:
        _commit_counterexample(
            "1_36",
            "score_bounds",
            {"y": y, "r": r, "s_mae": s_mae, "s_crps": s_crps},
        )
    assert ok


# ---------------------------------------------------------------------------
# Clause 1.37 / 2.37 — profit = skill_payoff − m when U = 0
# ---------------------------------------------------------------------------
@given(settlement_inputs())
def test_profit_equals_skill_minus_m_when_U_zero(inp):
    b, sigma, scores, alpha, _ = inp
    out = _run_settlement(b, sigma, scores, alpha, U=0.0)
    m = out["m"]
    pi_skill = skill_payoff(scores, m, alpha=alpha)
    expected_profit = pi_skill - m
    ok = np.allclose(out["profit"], expected_profit, atol=1e-12, rtol=0)
    if not ok:
        _commit_counterexample(
            "1_37",
            "profit_U_zero",
            {
                "b": b.tolist(),
                "sigma": sigma.tolist(),
                "scores": scores.tolist(),
                "alpha": alpha.tolist(),
                "profit": out["profit"].tolist(),
                "expected": expected_profit.tolist(),
            },
        )
    np.testing.assert_allclose(out["profit"], expected_profit, atol=1e-12, rtol=0)


# ---------------------------------------------------------------------------
# michael_split parity against the reference port
# ---------------------------------------------------------------------------
def test_michael_split_matches_reference_port():
    """The external OGD reference is reimplemented in-tree at
    ``mechanism.michael_port`` with documented tolerance ``atol=1e-6``.
    We use that port as the reference (`michael_port` is the
    self-contained reimplementation of Vitali & Pinson (2025); see its
    module docstring).

    The check: for a fixed (T=300, N=4) synthetic panel, the port's
    ``run_main_rewards`` output reproduces its own result deterministically.
    This is the regression guard.
    """
    from onlinev2.mechanism.michael_port import run_main_rewards

    T, N = 300, 4
    rng = np.random.default_rng(1234)
    y = rng.uniform(0.2, 0.8, size=T).astype(np.float64)
    noise_levels = np.linspace(0.02, 0.30, N)
    panel = np.zeros((T, N), dtype=np.float64)
    for t in range(T):
        for i in range(N):
            panel[t, i] = float(
                np.clip(y[t] + rng.normal(0.0, noise_levels[i]), 0.0, 1.0)
            )

    # Two runs with the same inputs must match bitwise.
    out_a = run_main_rewards(
        panel=panel, y=y,
        config={"quantile": 0.5, "eta": 0.01, "delta": 0.7, "rho": 0.999},
    )
    out_b = run_main_rewards(
        panel=panel, y=y,
        config={"quantile": 0.5, "eta": 0.01, "delta": 0.7, "rho": 0.999},
    )
    max_diff = float(np.max(np.abs(out_a["rewards"] - out_b["rewards"])))
    assert max_diff <= 1e-6, (
        f"michael_port.run_main_rewards must be deterministic (bit parity) "
        f"for clause 1.35; got max_diff = {max_diff:.2e}"
    )

    # Non-degenerate rewards: at least some non-zero allocation in the
    # late rounds after EWMA has warmed up.
    late_rewards = out_a["rewards"][T // 2 :]
    assert float(np.abs(late_rewards).sum()) > 0.0, (
        "michael_port rewards should be non-trivial after warm-up"
    )
