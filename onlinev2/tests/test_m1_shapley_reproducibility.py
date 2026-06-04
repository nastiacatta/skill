"""Test M1: Shapley MC in Michael-split allocation is now reproducible
across runs with the same params and seed.

Before the fix, ``run_round`` called ``shapley_mc`` without an RNG, so the
inner ``np.random.default_rng()`` with no seed produced different
permutations every run. Michael-split allocation results were therefore
non-reproducible even with a deterministic simulation seed.
"""
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.core.runner import run_round
from onlinev2.core.shapley import shapley_mc
from onlinev2.core.types import MechanismParams, MechanismState, RoundInput


def _make_actions(n: int, K: int, seed: int = 0) -> list[RoundInput]:
    rng = np.random.default_rng(seed)
    actions = []
    for i in range(n):
        q = np.sort(rng.uniform(0.0, 1.0, size=K))
        actions.append(RoundInput(
            account_id=f"agent_{i}",
            participate=True,
            report=q,
            deposit=1.0,
        ))
    return actions


def test_shapley_mc_explicit_rng_is_reproducible():
    """Direct: passing the same seeded RNG twice gives the same result."""
    def _value_fn(coalition):
        # Simple monotone-in-size value function.
        return float(len(coalition)) ** 1.5

    idx = np.arange(5)
    phi_a = shapley_mc(idx, _value_fn, n_perm=64, rng=np.random.default_rng(42))
    phi_b = shapley_mc(idx, _value_fn, n_perm=64, rng=np.random.default_rng(42))
    np.testing.assert_allclose(phi_a, phi_b, atol=0.0)

    phi_c = shapley_mc(idx, _value_fn, n_perm=64, rng=np.random.default_rng(43))
    # Different seed → result should differ (unlikely to collide).
    assert not np.allclose(phi_a, phi_c, atol=0.0)


def test_run_round_michael_split_is_reproducible():
    """run_round with allocation_mode='michael_split' is reproducible.

    Two identical run_round invocations on the same state should produce
    identical profits, thanks to the deterministic per-round, per-τ
    RNG seeded from params.shapley_seed + K*t + k (audit fix M1).
    """
    taus = np.array([0.1, 0.5, 0.9])
    params = MechanismParams(
        lam=0.05,
        eta=2.0,
        sigma_min=0.1,
        rho=0.5,
        gamma=16.0,
        scoring_mode="quantiles_crps",
        taus=taus,
        aggregation_mode="michael_robust_lr",
        allocation_mode="michael_split",
        U=1.0,
        michael_shapley_mc=16,  # small for speed
        shapley_seed=20260510,
    )
    state = MechanismState()

    n, K = 5, len(taus)
    actions = _make_actions(n, K, seed=0)
    y_t = 0.42

    _, logs_a = run_round(state=state, params=params, actions=actions, y_t=y_t)
    _, logs_b = run_round(state=state, params=params, actions=actions, y_t=y_t)

    # The key guarantee: profits are bitwise-identical across re-runs.
    np.testing.assert_allclose(
        np.asarray(logs_a["profit"]), np.asarray(logs_b["profit"]), atol=0.0
    )


def test_run_round_michael_split_different_seed_differs_in_phi_c():
    """Different shapley_seed → different φ_c state (the Shapley accumulator).

    The realised ``profit`` may coincide across seeds for one round due
    to the ``normalise_present`` uniform fallback when ``phi_c.sum()``
    is near zero (a separate documented caveat of the Michael-split
    allocation, not M1's RNG issue). The direct check that M1 fixes is
    that the RNG-dependent Shapley estimates ``phi_c`` themselves now
    differ across seeds.
    """
    taus = np.array([0.1, 0.5, 0.9])
    base = dict(
        lam=0.05, eta=2.0, sigma_min=0.1, rho=0.5, gamma=16.0,
        scoring_mode="quantiles_crps", taus=taus,
        aggregation_mode="michael_robust_lr",
        allocation_mode="michael_split",
        U=1.0, michael_shapley_mc=16,
    )
    actions = _make_actions(5, len(taus), seed=0)
    y_t = 0.42

    params_a = MechanismParams(**base, shapley_seed=111)
    params_b = MechanismParams(**base, shapley_seed=222)
    state_a, _ = run_round(
        state=MechanismState(), params=params_a, actions=actions, y_t=y_t
    )
    state_b, _ = run_round(
        state=MechanismState(), params=params_b, actions=actions, y_t=y_t
    )

    # The key RNG-dependent state: per-τ φ_c Shapley EWMA arrays.
    phi_a = state_a.allocation_state.get("phi_c", {})
    phi_b = state_b.allocation_state.get("phi_c", {})
    assert set(phi_a.keys()) == set(phi_b.keys())
    any_differ = False
    for k in phi_a:
        if not np.allclose(phi_a[k], phi_b[k], atol=1e-12):
            any_differ = True
            break
    assert any_differ, (
        f"Expected some φ_c[k] to differ across shapley_seed values; "
        f"got phi_a={phi_a}, phi_b={phi_b}"
    )


def test_mechanism_params_shapley_seed_has_reasonable_default():
    """The shapley_seed default is an integer > 0 (not None)."""
    p = MechanismParams()
    assert isinstance(p.shapley_seed, int)
    assert p.shapley_seed > 0
