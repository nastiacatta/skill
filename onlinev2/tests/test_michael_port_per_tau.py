"""Smoke tests for ``onlinev2.mechanism.michael_port_per_tau`` (task 11.7).

Covers the scaffolding shape + invariants. Does not attempt a full-series
run on Elia data; that is follow-up work (regenerating
``comparison.json`` with the real per-τ baseline takes ~1–3 hours
wall-clock and produces a different numeric column than the current
``michael_ogd_centered_median_fan`` row).
"""
from __future__ import annotations

import numpy as np
import pytest

from onlinev2.mechanism.michael_port_per_tau import (
    _isotonic_projection,
    run_main_rewards_per_tau,
)


TAUS = np.array([0.1, 0.25, 0.5, 0.75, 0.9])


def _make_synthetic_panel(
    T: int = 200, N: int = 3, K: int = 5, seed: int = 0
) -> tuple[np.ndarray, np.ndarray]:
    rng = np.random.default_rng(seed)
    # Each forecaster emits (T, K) monotone-in-τ quantile reports.
    panel = rng.uniform(0, 1, size=(T, N, K))
    panel.sort(axis=2)
    y = rng.uniform(0, 1, size=T)
    return panel, y


# ---------------------------------------------------------------------------
# _isotonic_projection
# ---------------------------------------------------------------------------


def test_isotonic_projection_already_sorted_unchanged() -> None:
    x = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
    out = _isotonic_projection(x)
    np.testing.assert_allclose(out, x)


def test_isotonic_projection_reversed_collapses_to_mean() -> None:
    x = np.array([0.9, 0.7, 0.5, 0.3, 0.1])
    out = _isotonic_projection(x)
    np.testing.assert_allclose(out, np.full_like(x, x.mean()))


def test_isotonic_projection_monotone_output() -> None:
    rng = np.random.default_rng(42)
    for _ in range(20):
        x = rng.normal(size=rng.integers(1, 30))
        out = _isotonic_projection(x)
        assert np.all(np.diff(out) >= -1e-12), "output must be non-decreasing"
        # Same mean (PAV preserves sum).
        assert abs(out.sum() - x.sum()) < 1e-9


# ---------------------------------------------------------------------------
# run_main_rewards_per_tau
# ---------------------------------------------------------------------------


def test_per_tau_shapes() -> None:
    panel, y = _make_synthetic_panel(T=200, N=3, K=5, seed=0)
    out = run_main_rewards_per_tau(panel, y, TAUS, config={"eta": 0.01})
    assert out["q_agg"].shape == (200, 5)
    assert out["y_hat_per_tau"].shape == (200, 5)
    assert out["weights_per_tau"].shape == (200, 3, 5)


def test_per_tau_output_is_monotone_in_tau() -> None:
    panel, y = _make_synthetic_panel(T=150, N=4, K=5, seed=1)
    out = run_main_rewards_per_tau(
        panel, y, TAUS, config={"eta": 0.01}, enforce_monotone=True
    )
    # Monotone non-decreasing in τ per round.
    diffs = np.diff(out["q_agg"], axis=1)
    assert np.all(diffs >= -1e-9), "q_agg must not cross in τ"


def test_per_tau_monotone_projection_preserves_mean() -> None:
    panel, y = _make_synthetic_panel(T=100, N=3, K=5, seed=2)
    out = run_main_rewards_per_tau(
        panel, y, TAUS, config={"eta": 0.01}, enforce_monotone=True
    )
    raw_means = out["y_hat_per_tau"].mean(axis=1)
    proj_means = out["q_agg"].mean(axis=1)
    # PAV preserves the per-row sum exactly.
    np.testing.assert_allclose(raw_means, proj_means, atol=1e-9)


def test_per_tau_config_quantile_is_ignored() -> None:
    """Caller-supplied ``quantile`` in config must not bleed into the per-τ
    loop: each τ is set by the loop, not by the caller."""
    panel, y = _make_synthetic_panel(T=100, N=3, K=5, seed=3)
    out_a = run_main_rewards_per_tau(
        panel, y, TAUS, config={"eta": 0.01, "quantile": 0.5}
    )
    out_b = run_main_rewards_per_tau(panel, y, TAUS, config={"eta": 0.01})
    np.testing.assert_allclose(out_a["q_agg"], out_b["q_agg"])


def test_per_tau_shape_errors() -> None:
    panel, y = _make_synthetic_panel(T=50, N=3, K=5, seed=4)
    # Wrong panel ndim.
    with pytest.raises(ValueError, match="ndim"):
        run_main_rewards_per_tau(
            panel.reshape(50, -1), y, TAUS, config={"eta": 0.01}
        )
    # Mismatched τ length.
    with pytest.raises(ValueError, match="taus length"):
        run_main_rewards_per_tau(
            panel, y, TAUS[:3], config={"eta": 0.01}
        )
    # Non-increasing τ.
    with pytest.raises(ValueError, match="strictly increasing"):
        run_main_rewards_per_tau(
            panel, y, np.array([0.5, 0.5, 0.5, 0.5, 0.5]), config={"eta": 0.01}
        )
    # Mismatched y length.
    with pytest.raises(ValueError, match="y length"):
        run_main_rewards_per_tau(
            panel, y[:10], TAUS, config={"eta": 0.01}
        )
