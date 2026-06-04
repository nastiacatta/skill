"""Unit tests for MLP seed determinism (bugfix clause 1.8 / 2.8).
"""
# Feature: model-training-testing-audit, Property 1: Bug Condition
from __future__ import annotations

import inspect

import numpy as np
import pytest


def _make_series(n: int = 400, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(n)), 0.0, 1.0)


def test_mlp_fit_uses_self_seed():
    pytest.importorskip("torch")
    from onlinev2.real_data.forecasters import MLPForecaster

    src = inspect.getsource(MLPForecaster.fit)
    assert "torch.manual_seed(self.seed)" in src, (
        "MLPForecaster.fit must seed torch from self.seed"
    )
    assert "torch.manual_seed(len(history)" not in src, (
        "MLPForecaster.fit must not use len(history) % 1000 for seeding"
    )


def test_mlp_seed_constructor_kwarg():
    pytest.importorskip("torch")
    from onlinev2.real_data.forecasters import MLPForecaster

    fc = MLPForecaster(n_lags=6, hidden=16, seed=1337)
    assert fc.seed == 1337

    fc_default = MLPForecaster(n_lags=6, hidden=16)
    assert fc_default.seed == 42  # current default


def test_mlp_same_seed_same_data_bit_identical():
    pytest.importorskip("torch")
    from onlinev2.real_data.forecasters import MLPForecaster

    series = _make_series(400, seed=42)
    for trial_seed in (1, 7, 42, 2024):
        fc_a = MLPForecaster(n_lags=6, hidden=16, seed=trial_seed)
        fc_b = MLPForecaster(n_lags=6, hidden=16, seed=trial_seed)
        fc_a.fit(series[:300])
        fc_b.fit(series[:300])
        fc_a._history = series[:301]
        fc_b._history = series[:301]
        pred_a = float(fc_a.predict())
        pred_b = float(fc_b.predict())
        assert np.isclose(pred_a, pred_b, atol=1e-10, rtol=0), (
            f"seed={trial_seed}: pred_a={pred_a}, pred_b={pred_b}"
        )


def test_runner_propagates_seed_to_mlp():
    """`run_real_data_comparison(seed=...)` MUST set `fc.seed` on every
    forecaster that exposes that attribute (MLPForecaster)."""
    pytest.importorskip("torch")
    import tempfile

    from onlinev2.real_data.forecasters import get_all_forecasters
    from onlinev2.real_data.runner import run_real_data_comparison

    forecasters = get_all_forecasters()
    series = _make_series(500, seed=0)
    with tempfile.TemporaryDirectory() as td:
        run_real_data_comparison(
            series=series,
            forecasters=forecasters,
            warmup=150,
            outdir=td,
            series_name="mlp_seed_probe",
            seed=777,
        )
    for fc in forecasters:
        if fc.name == "Neural Net (MLP)":
            assert fc.seed == 777, f"MLP did not receive runner seed (got {fc.seed})"
            return
    pytest.fail("MLPForecaster not found in get_all_forecasters()")
