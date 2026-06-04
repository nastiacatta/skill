"""Unit tests for XGBoost expanding-window CV with temporal gap.

Tests expanding-window CV with temporal gap for XGBoost (properties 1.7 / 2.7).
"""
# Feature: model-training-testing-audit, Property 1: Bug Condition
from __future__ import annotations

import numpy as np
import pytest


def _make_series(T: int = 800, seed: int = 0) -> np.ndarray:
    rng = np.random.default_rng(seed)
    return np.clip(0.5 + 0.05 * np.cumsum(rng.standard_normal(T)), 0.0, 1.0)


def test_xgboost_val_gap_attribute():
    pytest.importorskip("xgboost")
    from onlinev2.real_data.forecasters import XGBoostForecaster

    fc = XGBoostForecaster(n_lags=6)
    assert fc.val_gap == 24

    fc2 = XGBoostForecaster(n_lags=6, val_gap=48)
    assert fc2.val_gap == 48


def test_xgboost_cv_split_respects_gap():
    pytest.importorskip("xgboost")
    from onlinev2.real_data.forecasters import XGBoostForecaster

    fc = XGBoostForecaster(n_lags=6, val_gap=24)
    series = _make_series(T=800)
    fc.fit(series)

    assert fc._last_cv_split is not None
    train_end, val_start = fc._last_cv_split
    gap = val_start - train_end
    assert gap >= fc.val_gap, f"gap={gap} < val_gap={fc.val_gap}"


def test_xgboost_cv_falls_back_on_short_history():
    """When training history is too small for the configured gap, the
    forecaster shrinks the embargo rather than falling back to the
    legacy zero-gap 80/20 split. The Bergmeir 2018 embargoed-CV
    protocol must remain non-trivial: the gap stays at least 1 row.
    """
    pytest.importorskip("xgboost")
    from onlinev2.real_data.forecasters import XGBoostForecaster

    fc = XGBoostForecaster(n_lags=6, val_gap=24)
    # Need len(history) >= max(n_lags, 50) + 20 = 70 for XGBoost to
    # even attempt a fit, but keep the feature matrix below the
    # expanding-window CV's `val_gap + 60` threshold (= 84 rows of
    # features). With n_lags=6 features start at max(n_lags, 50)=50;
    # history length 130 gives ~80 feature rows, below the threshold.
    series = _make_series(T=130)
    fc.fit(series)
    assert fc._last_cv_split is not None
    train_end, val_start = fc._last_cv_split
    # New contract: shrunk-but-positive embargo on the short path.
    gap = val_start - train_end
    assert gap >= 1, f"short-history embargo collapsed to zero (gap={gap})"
    # And the short-history fallback counter is bumped so the
    # diagnostic surfaces in any fallback summary.
    assert fc.cv_short_history_fallbacks >= 1


def test_xgboost_cv_gap_never_zero_across_history_lengths():
    """Regression test for Bergmeir 2018 compliance: for every history
    length that triggers a real CV split, the embargo gap reported by
    `_last_cv_split` is at least 1 row. This guards against the
    silent-fallback bug flagged in the training-audit (forecasters.py
    around lines 450-475).
    """
    pytest.importorskip("xgboost")
    from onlinev2.real_data.forecasters import XGBoostForecaster

    # Sweep history lengths spanning both the short-history path
    # (n < val_gap+60) and the expanding-CV path (n >= val_gap+60).
    for T in (75, 90, 110, 130, 200, 400, 800):
        fc = XGBoostForecaster(n_lags=6, val_gap=24)
        series = _make_series(T=T)
        fc.fit(series)
        if fc._last_cv_split is None:
            # XGBoost early-returned because the training window was
            # too short for a feature matrix; that path is governed by
            # `fallback_counter`, not by the CV gap. Skip — no CV split
            # was attempted.
            continue
        train_end, val_start = fc._last_cv_split
        gap = val_start - train_end
        assert gap >= 1, (
            f"T={T}: embargo gap collapsed to {gap}; the Bergmeir 2018 "
            "embargoed-CV protocol requires a non-zero buffer between "
            "training and validation."
        )


def test_xgboost_val_gap_custom_value():
    pytest.importorskip("xgboost")
    from onlinev2.real_data.forecasters import XGBoostForecaster

    fc = XGBoostForecaster(n_lags=6, val_gap=48)
    series = _make_series(T=1000)
    fc.fit(series)
    train_end, val_start = fc._last_cv_split
    assert val_start - train_end >= 48
