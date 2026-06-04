"""Unit tests for the day-ahead warmup floor and the `min_warmup_for`
helper that drives it (day-ahead warmup floor property 1.16 / 2.16)."""
# Feature: model-training-testing-audit, Property 3: Fix Checking
from __future__ import annotations

import pytest

from onlinev2.real_data.experiments import min_warmup_for


def test_min_warmup_for_full_forecaster_set():
    pytest.importorskip("xgboost")
    from onlinev2.real_data.forecasters import get_all_forecasters

    forecasters = get_all_forecasters()
    warmup = min_warmup_for(forecasters)
    # XGBoost: max(n_lags=24, 50) + 20 = 70
    # MLP:     max(n_lags=24, 50) + 10 = 60
    # Others:  20
    assert warmup == 70


def test_min_warmup_for_simpler_set():
    from onlinev2.real_data.forecasters import (
        MovingAverageForecaster,
        NaiveForecaster,
        ThetaForecaster,
    )

    forecasters = [NaiveForecaster(), MovingAverageForecaster(), ThetaForecaster()]
    warmup = min_warmup_for(forecasters)
    assert warmup == 20


def test_min_warmup_for_empty():
    warmup = min_warmup_for([])
    assert warmup == 20


def test_min_warmup_for_xgboost_only_with_larger_lags():
    pytest.importorskip("xgboost")
    from onlinev2.real_data.forecasters import XGBoostForecaster

    fc = XGBoostForecaster(n_lags=100)
    warmup = min_warmup_for([fc])
    assert warmup == 120  # max(100, 50) + 20


def test_horizon_runner_initialises_first_h_rounds():
    """Regression test for issue #1 of the post-fix audit sweep:
    `_run_horizon_comparison` populates `reports[:, 0:horizon]` and
    `q_reports[:, 0:horizon, :]` so the mechanism is never fed an
    all-zero quantile fan for the first `horizon` rounds.
    """
    import numpy as np

    from onlinev2.real_data import experiments
    from onlinev2.real_data.forecasters import (
        MovingAverageForecaster,
        NaiveForecaster,
    )

    rng = np.random.default_rng(0)
    series = np.clip(
        0.5 + 0.05 * np.cumsum(rng.standard_normal(200)), 0.0, 1.0
    )
    forecasters = [NaiveForecaster(), MovingAverageForecaster()]

    # Monkey-patch run_simulation to capture the q_reports_pre it receives.
    captured: dict = {}
    real_run_sim = experiments
    import onlinev2.simulation as sim_mod

    original = sim_mod.run_simulation

    def _spy(*args, **kwargs):
        captured["q_reports_pre"] = kwargs.get("q_reports_pre").copy()
        return original(*args, **kwargs)

    sim_mod.run_simulation = _spy
    try:
        experiments._run_horizon_comparison(
            series=series, horizon=4, forecasters=forecasters,
            warmup=20, taus=np.array([0.1, 0.5, 0.9]),
            label="horizon_init_probe",
        )
    finally:
        sim_mod.run_simulation = original

    q = captured["q_reports_pre"]
    # Rounds 0..horizon-1 must NOT be all zeros.
    assert not np.all(q[:, 0:4, :] == 0.0), (
        "First horizon rounds are all zeros; pending-queue fix regression"
    )
    # And the seeded value should be 0.5.
    assert np.all(q[:, 0:4, :] == 0.5), (
        f"Expected 0.5 seeding, got unique values: {np.unique(q[:, 0:4, :])}"
    )
