"""Bug Condition B — Aggregate forecast quality (Property 3).

Encodes six property-based tests for aggregate forecast quality (properties 1.5–1.9).
The zero-wager sentinel test (clause 1.8) checks for a
``return_meta`` kwarg on ``aggregate_forecast``; that kwarg does not
exist on current code, so the test is expected to fail (TypeError).

**Validates: Requirements 2.5, 2.6, 2.7, 2.8, 2.9**
"""
from __future__ import annotations

import json
import os

import numpy as np
import pytest
from hypothesis import given
from hypothesis import strategies as st

from onlinev2.core.aggregation import aggregate_forecast
from onlinev2.core.metrics import validate_quantile_monotonicity
from onlinev2.core.scoring import crps_hat_from_quantiles

from . import dgps
from .strategies import quantile_panel_strategy, wager_vector_strategy

pytestmark = [pytest.mark.audit]

_CE_DIR = os.path.join(os.path.dirname(__file__), "fixtures", "counterexamples", "b")


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


# ---------------------------------------------------------------------------
# Clause 1.5 / 2.5 — monotone aggregate
# ---------------------------------------------------------------------------
@given(quantile_panel_strategy(N=4, n_taus=9), wager_vector_strategy(N=4))
def test_monotone_aggregate(panel, m):
    """Aggregated quantiles must be monotone non-decreasing when
    ``enforce_monotonicity=True`` (the default).
    """
    q_agg = aggregate_forecast(panel, m, enforce_monotonicity=True)
    if np.ndim(q_agg) == 0:
        return  # fell through to scalar fallback; nothing to check
    q_agg = np.asarray(q_agg, dtype=np.float64)
    diffs = np.diff(q_agg)
    ok = bool(np.all(diffs >= -1e-12))
    if not ok:
        _commit_counterexample(
            "1_5",
            "non_monotone_aggregate",
            {"panel": panel.tolist(), "m": m.tolist(), "q_agg": q_agg.tolist()},
        )
    assert ok, f"aggregate not monotone: min diff {float(diffs.min())}"


# ---------------------------------------------------------------------------
# Clause 1.6 / 2.6 — mechanism ≤ 1.05 × best_single CRPS
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_mechanism_within_1_05x_best_single(seed: int):
    """Run the skill-weighted aggregate on a best_single_dominant panel and
    compare its CRPS to the best single forecaster's CRPS.

    The mechanism's skill weighting (EWMA on per-round loss) should
    concentrate wager on the consistently-best forecaster, producing an
    aggregate no worse than 1.05× the best single's CRPS.

    Note: uniform weighting on this DGP would fail this bound by the
    Ranjan & Gneiting calibrated-linear-pool result — weighted by skill
    is what production does, and is what this clause guards.
    """
    from onlinev2.core.skill import loss_to_skill, update_ewma_loss

    panel, y, best_idx = dgps.best_single_dominant(seed=seed, T=300, N=4)
    taus = dgps.TAUS_DEFAULT
    T, N, _ = panel.shape

    # Skill-weighted aggregation (matches mechanism production path):
    # EWMA per-agent CRPS loss → σ via loss_to_skill → wager ∝ σ.
    sigma_min, gamma, rho = 0.1, 4.0, 0.05  # matches Task 2.5 retune
    L = np.full(N, 0.5, dtype=np.float64)
    alpha0 = np.zeros(N, dtype=np.int32)
    crps_mech = []
    crps_best = []
    for t in range(T):
        sigma = loss_to_skill(L, sigma_min, gamma)  # σ_t uses L_{t-1}
        m = sigma  # wager ∝ skill in the simplest bankroll-equal case
        q_agg = aggregate_forecast(panel[t], m, enforce_monotonicity=True)
        crps_mech.append(
            float(crps_hat_from_quantiles(float(y[t]), q_agg.reshape(1, -1), taus)[0])
        )
        crps_best.append(
            float(
                crps_hat_from_quantiles(
                    float(y[t]), panel[t, best_idx].reshape(1, -1), taus
                )[0]
            )
        )
        # Per-agent CRPS to update EWMA loss
        losses = crps_hat_from_quantiles(float(y[t]), panel[t], taus) / 2.0
        L = update_ewma_loss(L, losses, alpha0, rho=rho, kappa=0.0, L0=0.0)
    warmup = 50
    mean_mech = float(np.mean(crps_mech[warmup:]))
    mean_best = float(np.mean(crps_best[warmup:]))
    ratio = mean_mech / mean_best if mean_best > 1e-12 else float("inf")
    ok = ratio <= 1.05
    if not ok:
        _commit_counterexample(
            "1_6",
            f"mech_exceeds_best_seed{seed}",
            {
                "seed": seed,
                "best_idx": int(best_idx),
                "mean_crps_mechanism": mean_mech,
                "mean_crps_best_single": mean_best,
                "ratio": ratio,
            },
        )
    assert ok, f"seed {seed}: mechanism/best CRPS ratio = {ratio:.3f} > 1.05"


# ---------------------------------------------------------------------------
# Clause 1.7 / 2.7 — PIT tail deviation at τ ∈ {0.1, 0.9}
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_pit_tail_deviation_under_threshold(seed: int):
    """Empirical coverage at τ=0.1 and τ=0.9 must deviate from nominal by
    ≤ 0.05 over ≥ 500 rounds on a stationary AR(1) under the mechanism's
    production skill-weighted aggregation.

    Uniform-weighted linear pools of calibrated forecasters are
    necessarily uncalibrated (Ranjan & Gneiting, JRSS-B 2010). The
    mechanism's concentration via skill weighting breaks the symmetric
    pool and recovers calibration when one forecaster is clearly best;
    this is what the clause guards in production.
    """
    from onlinev2.core.skill import loss_to_skill, update_ewma_loss

    panel, y, best_idx = dgps.best_single_dominant(seed=seed, T=600, N=4)
    taus = dgps.TAUS_DEFAULT
    T, N, _ = panel.shape

    # Skill-weighted aggregation (matches production): σ_t based on L_{t-1}.
    sigma_min, gamma, rho = 0.1, 4.0, 0.05
    L = np.full(N, 0.5, dtype=np.float64)
    alpha0 = np.zeros(N, dtype=np.int32)
    warmup = 200  # longer warmup so skill concentrates on best_idx
    covered_lo = 0
    covered_hi = 0
    n_scored = 0
    for t in range(T):
        sigma = loss_to_skill(L, sigma_min, gamma)
        m = sigma
        q_agg = aggregate_forecast(panel[t], m, enforce_monotonicity=True)
        if t >= warmup:
            q_lo = float(q_agg[0])
            q_hi = float(q_agg[-1])
            covered_lo += int(float(y[t]) <= q_lo)
            covered_hi += int(float(y[t]) <= q_hi)
            n_scored += 1
        losses = crps_hat_from_quantiles(float(y[t]), panel[t], taus) / 2.0
        L = update_ewma_loss(L, losses, alpha0, rho=rho, kappa=0.0, L0=0.0)
    emp_lo = covered_lo / max(n_scored, 1)
    emp_hi = covered_hi / max(n_scored, 1)
    dev_lo = abs(emp_lo - 0.1)
    dev_hi = abs(emp_hi - 0.9)
    ok = (dev_lo <= 0.05) and (dev_hi <= 0.05)
    if not ok:
        _commit_counterexample(
            "1_7",
            f"pit_tail_dev_seed{seed}",
            {
                "seed": seed,
                "emp_lo": emp_lo,
                "emp_hi": emp_hi,
                "dev_lo": dev_lo,
                "dev_hi": dev_hi,
            },
        )
    assert ok, (
        f"seed {seed}: PIT tail dev @0.1={dev_lo:.3f}, @0.9={dev_hi:.3f} > 0.05"
    )


# ---------------------------------------------------------------------------
# Clause 1.7 (KS branch) / 2.7 — PIT KS distance
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("seed", [0, 1, 2, 42, 2024])
def test_pit_ks_under_adjusted_threshold(seed: int):
    """PIT KS distance from Uniform(0,1) must fall below the sample-adjusted
    99% threshold (approximately 1.63 / sqrt(n_scored)) under skill-weighted
    aggregation.
    """
    from scipy.stats import kstest

    from onlinev2.core.skill import loss_to_skill, update_ewma_loss

    panel, y, best_idx = dgps.best_single_dominant(seed=seed, T=600, N=4)
    taus = dgps.TAUS_DEFAULT
    T, N, _ = panel.shape

    sigma_min, gamma, rho = 0.1, 4.0, 0.05
    L = np.full(N, 0.5, dtype=np.float64)
    alpha0 = np.zeros(N, dtype=np.int32)
    warmup = 200
    pit_vals = []
    # Randomised PIT (Czado, Gneiting & Held 2009): uniform jitter within
    # each discrete bin so the reference distribution is continuous
    # Uniform(0,1) and the KS test is valid. Without this, PIT values
    # concentrate on the discrete atoms {k/K} and the KS stat is bounded
    # below regardless of aggregation quality.
    rng = np.random.default_rng(seed + 7777)
    for t in range(T):
        sigma = loss_to_skill(L, sigma_min, gamma)
        m = sigma
        q_agg = aggregate_forecast(panel[t], m, enforce_monotonicity=True)
        if t >= warmup:
            # rank of y in q_agg quantiles, randomised within the bin
            y_t = float(y[t])
            rank = int(np.sum(q_agg <= y_t))
            K = len(q_agg)
            u = float(rng.uniform())
            pit = (rank + u) / (K + 1)
            pit_vals.append(pit)
        losses = crps_hat_from_quantiles(float(y[t]), panel[t], taus) / 2.0
        L = update_ewma_loss(L, losses, alpha0, rho=rho, kappa=0.0, L0=0.0)
    pit_arr = np.asarray(pit_vals, dtype=np.float64)
    n = pit_arr.size
    stat, _ = kstest(pit_arr, "uniform")
    threshold = 1.63 / np.sqrt(n)
    ok = stat <= threshold
    if not ok:
        _commit_counterexample(
            "1_7",
            f"pit_ks_seed{seed}",
            {"seed": seed, "ks_stat": float(stat), "threshold": float(threshold), "n": int(n)},
        )
    assert ok, f"seed {seed}: KS = {stat:.4f} > threshold {threshold:.4f}"


# ---------------------------------------------------------------------------
# Clause 1.8 / 2.8 — zero-wager sentinel emitted (return_meta kwarg)
# ---------------------------------------------------------------------------
def test_zero_wager_sentinel_emitted():
    """When ``sum(m) ≤ eps`` the aggregate should signal the zero-wager
    fallback.  The contract requires a ``return_meta=True`` kwarg returning
    ``(q, meta)`` with ``meta["zero_wager_fallback"] is True``.  This kwarg
    does NOT exist on current code — the test is expected to fail with
    ``TypeError`` and is a deterministic counterexample.
    """
    N = 4
    K = 9
    panel = np.linspace(0.1, 0.9, K).reshape(1, -1).repeat(N, axis=0)
    m = np.zeros(N)
    try:
        result = aggregate_forecast(panel, m, return_meta=True)
    except TypeError as e:
        # Expected on current code — commit as counterexample and fail.
        _commit_counterexample(
            "1_8",
            "return_meta_not_supported",
            {"error": str(e), "m": m.tolist()},
        )
        pytest.fail(
            f"aggregate_forecast(..., return_meta=True) not supported: {e}"
        )
    else:
        assert isinstance(result, tuple) and len(result) == 2, (
            "return_meta=True must return (q, meta) tuple"
        )
        q, meta = result
        assert isinstance(meta, dict)
        assert meta.get("zero_wager_fallback") is True, (
            f"zero_wager_fallback sentinel missing: meta={meta}"
        )


# ---------------------------------------------------------------------------
# Clause 1.9 / 2.9 — scale invariance m vs k·m
# ---------------------------------------------------------------------------
@given(
    quantile_panel_strategy(N=4, n_taus=9),
    wager_vector_strategy(N=4, allow_zero=False),
    st.floats(min_value=0.01, max_value=100.0, allow_nan=False, allow_infinity=False),
)
def test_scale_invariance_mk_vs_m(panel, m, k):
    """``aggregate_forecast(panel, m)`` must be bit-identical to
    ``aggregate_forecast(panel, k·m)`` for all k > 0.
    """
    q1 = aggregate_forecast(panel, m, enforce_monotonicity=True)
    q2 = aggregate_forecast(panel, k * m, enforce_monotonicity=True)
    q1 = np.asarray(q1, dtype=np.float64)
    q2 = np.asarray(q2, dtype=np.float64)
    ok = np.allclose(q1, q2, atol=1e-12, rtol=0)
    if not ok:
        _commit_counterexample(
            "1_9",
            "scale_variance",
            {
                "panel": panel.tolist(),
                "m": m.tolist(),
                "k": float(k),
                "q1": q1.tolist(),
                "q2": q2.tolist(),
            },
        )
    np.testing.assert_allclose(q1, q2, atol=1e-12, rtol=0)
