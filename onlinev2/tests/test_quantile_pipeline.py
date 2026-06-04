"""
Unit tests for the quantile forecast pipeline.

Tests cover ARIMA native intervals, XGBoost quantile regression,
BaseForecaster defaults, runner invariants, transition behaviour,
and isotonic monotonicity enforcement.
"""
from __future__ import annotations

import inspect
from unittest.mock import MagicMock, call, patch

import numpy as np
import pytest

from onlinev2.real_data.forecasters import (
    ARIMAForecaster,
    BaseForecaster,
    NaiveForecaster,
    XGBoostForecaster,
)


# ---------------------------------------------------------------------------
# 1. test_arima_uses_residual_bootstrap
# ---------------------------------------------------------------------------
def test_arima_uses_residual_bootstrap():
    """ARIMA uses the base class residual bootstrap for quantile generation
    (native statsmodels intervals were removed due to miscalibration)."""
    fc = ARIMAForecaster(order=(2, 1, 1))
    fc._fitted = True
    fc._last_pred = 0.5

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    # Add enough residuals so predict_quantiles takes the normal path
    fc._residuals = [0.01 * (i - 10) for i in range(20)]

    q = fc.predict_quantiles(taus)

    # Should produce valid quantiles (monotone, in [0,1])
    assert len(q) == len(taus)
    assert all(0 <= qi <= 1 for qi in q)
    # Should be monotone non-decreasing
    for k in range(1, len(q)):
        assert q[k] >= q[k - 1] - 1e-12

    # Verify ARIMA does NOT override _generate_quantiles (uses base class)
    from onlinev2.real_data.forecasters import BaseForecaster
    assert type(fc)._generate_quantiles is BaseForecaster._generate_quantiles


# ---------------------------------------------------------------------------
# 2. test_arima_fallback_on_failure
# ---------------------------------------------------------------------------
def test_arima_fallback_on_failure():
    """Req 2.2 — When ARIMA native intervals raise, fall back to residual
    bootstrap (result based on residuals, not on the model)."""
    fc = ARIMAForecaster(order=(2, 1, 1))
    fc._fitted = True
    fc._last_pred = 0.5

    # Model whose get_forecast() raises
    mock_model = MagicMock()
    mock_model.get_forecast.side_effect = RuntimeError("boom")
    fc._model = mock_model

    # Provide residuals so the bootstrap path has data to work with
    fc._residuals = [0.02 * (i - 10) for i in range(20)]

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    q = fc.predict_quantiles(taus)

    # Should still return a valid quantile vector (from residual bootstrap)
    assert len(q) == len(taus)
    assert np.all(np.isfinite(q))
    # Spread should be > 0 because residuals have variance
    assert q[-1] - q[0] > 0


# ---------------------------------------------------------------------------
# 3. test_xgboost_fits_per_tau_models
# ---------------------------------------------------------------------------
def test_xgboost_fits_per_tau_models():
    """Req 3.1 — After fit(), XGBoost has one quantile model per tau."""
    try:
        import xgboost as xgb  # noqa: F401
    except Exception:
        pytest.skip("xgboost not available")

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    fc = XGBoostForecaster(n_lags=5, taus=taus)

    # Synthetic data long enough for lag features
    np.random.seed(42)
    history = np.cumsum(np.random.randn(200)) * 0.01 + 0.5
    history = np.clip(history, 0, 1)

    fc.fit(history)

    assert len(fc._quantile_models) == len(taus)
    for tau in taus:
        assert float(tau) in fc._quantile_models


# ---------------------------------------------------------------------------
# 4. test_xgboost_fallback_on_failure
# ---------------------------------------------------------------------------
def test_xgboost_fallback_on_failure():
    """Req 3.3 — When XGBoost quantile models are empty, _generate_quantiles
    falls back to residual bootstrap."""
    fc = XGBoostForecaster(n_lags=5)
    fc._fitted = True
    fc._last_pred = 0.5
    fc._history = np.linspace(0.3, 0.7, 50)
    fc._quantile_models = {}  # empty — no per-tau models

    # Provide residuals for the bootstrap path
    fc._residuals = [0.02 * (i - 10) for i in range(20)]

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
    q = fc.predict_quantiles(taus)

    assert len(q) == len(taus)
    assert np.all(np.isfinite(q))
    # Spread should be > 0 from residual bootstrap
    assert q[-1] - q[0] > 0


# ---------------------------------------------------------------------------
# 5. test_xgboost_same_features
# ---------------------------------------------------------------------------
def test_xgboost_same_features():
    """Req 3.5 — XGBoost quantile models use the same feature vector as the point model.

    The actual feature count is n_lags (raw lags) + (n_lags-1) first-differences +
    12 engineered features (rolling means at 3 scales, rolling stds at 2 scales,
    rmin/rmax/pos_in_range, momentum, acceleration, mean_rev at 2 scales). What we
    guarantee is CONSISTENCY: the point model and every quantile model see exactly
    the same feature vector, so predictions compose cleanly.
    """
    try:
        import xgboost as xgb  # noqa: F401
    except Exception:
        pytest.skip("xgboost not available")

    taus = np.array([0.1, 0.5, 0.9])
    n_lags = 7
    fc = XGBoostForecaster(n_lags=n_lags, taus=taus)

    np.random.seed(0)
    history = np.cumsum(np.random.randn(200)) * 0.01 + 0.5
    history = np.clip(history, 0, 1)
    fc.fit(history)

    # Point model is trained
    assert fc._model is not None
    point_features = fc._model.n_features_in_

    # Must include at least n_lags features (raw lags are always present)
    assert point_features >= n_lags, (
        f"Point model has {point_features} features, expected >= {n_lags}"
    )

    # Every quantile model must see the same feature count as the point model
    for tau, qm in fc._quantile_models.items():
        assert qm.n_features_in_ == point_features, (
            f"Quantile model for tau={tau} has {qm.n_features_in_} features, "
            f"expected {point_features} (matching point model)"
        )

    # Verify at prediction time the feature vector also matches
    pred_features = fc._make_predict_features(history)
    assert pred_features is not None
    assert pred_features.shape[1] == point_features, (
        f"Predict-time features have {pred_features.shape[1]} columns, "
        f"expected {point_features}"
    )


# ---------------------------------------------------------------------------
# 6. test_default_residual_window
# ---------------------------------------------------------------------------
def test_default_residual_window():
    """Req 5.2 — BaseForecaster default residual_window is 200."""

    class _Stub(BaseForecaster):
        def fit(self, history):
            pass

        def predict(self):
            return 0.5

    fc = _Stub("stub")
    assert fc.residual_window == 200


# ---------------------------------------------------------------------------
# 7. test_runner_no_external_clip
# ---------------------------------------------------------------------------
def test_runner_no_external_clip():
    """Req 6.3 — The runner must NOT externally clip predict_quantiles output.
    Clipping is now internal to the pipeline."""
    from onlinev2.real_data import runner

    source = inspect.getsource(runner.run_real_data_comparison)
    # Should not contain patterns like np.clip(fc.predict_quantiles(...), ...)
    # or np.clip(... predict_quantiles ...)
    assert "np.clip(fc.predict_quantiles" not in source
    assert "clip(fc.predict_quantiles" not in source
    # Also check there's no clip wrapping the quantile assignment
    # The current code should just be: q_reports[i, t, :] = fc.predict_quantiles(taus)
    assert "predict_quantiles" in source, "predict_quantiles should still be called"


# ---------------------------------------------------------------------------
# 8. test_runner_call_order
# ---------------------------------------------------------------------------
def test_runner_call_order():
    """Req 7.1, 7.2 — The runner calls predict() before predict_quantiles()
    before update_residuals() for each forecaster within a round."""
    from onlinev2.real_data import runner

    source = inspect.getsource(runner.run_real_data_comparison)

    # Find the positions of the key calls in the source
    pos_predict = source.find("fc.predict()")
    pos_quantiles = source.find("fc.predict_quantiles(")
    pos_residuals = source.find("fc.update_residuals(")

    assert pos_predict != -1, "fc.predict() not found in runner source"
    assert pos_quantiles != -1, "fc.predict_quantiles() not found in runner source"
    assert pos_residuals != -1, "fc.update_residuals() not found in runner source"

    # Verify ordering: predict < predict_quantiles < update_residuals
    assert pos_predict < pos_quantiles, (
        "predict() should appear before predict_quantiles() in the runner"
    )
    assert pos_quantiles < pos_residuals, (
        "predict_quantiles() should appear before update_residuals() in the runner"
    )


# ---------------------------------------------------------------------------
# 9. test_smooth_transition_at_threshold
# ---------------------------------------------------------------------------
def test_smooth_transition_at_threshold():
    """Req 4.4 — At the min_residuals boundary, both fallback and bootstrap
    produce spread > 0 (no discontinuity to zero spread)."""
    fc = NaiveForecaster()
    fc._last = 0.5
    fc._fitted = True

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])

    # Just below threshold: min_residuals - 1 residuals → fallback path
    fc._residuals = [0.01 * i for i in range(fc.min_residuals - 1)]
    q_below = fc.predict_quantiles(taus)
    spread_below = float(q_below[-1] - q_below[0])
    assert spread_below > 0, "Fallback path should produce non-zero spread"

    # Add one more residual to reach threshold → bootstrap path
    fc._residuals.append(0.05)
    assert len(fc._residuals) == fc.min_residuals
    q_at = fc.predict_quantiles(taus)
    spread_at = float(q_at[-1] - q_at[0])
    assert spread_at > 0, "Bootstrap path at threshold should produce non-zero spread"


# ---------------------------------------------------------------------------
# 10. test_isotonic_preserves_median
# ---------------------------------------------------------------------------
def test_isotonic_preserves_median():
    """Req 1.4 — Isotonic regression with equal weights preserves the median
    as closely as possible, and the result is monotone non-decreasing."""
    # Quantile vector with known crossings (indices 1 and 2 are swapped)
    q_crossed = np.array([0.30, 0.50, 0.40, 0.55, 0.70])
    median_idx = 2  # tau=0.5 position (middle element)
    original_median = q_crossed[median_idx]

    result = BaseForecaster._enforce_monotonicity(q_crossed)

    # Must be monotone non-decreasing
    for i in range(len(result) - 1):
        assert result[i] <= result[i + 1] + 1e-12, (
            f"Not monotone at index {i}: {result[i]} > {result[i+1]}"
        )

    # Median should be preserved as closely as possible
    # With equal-weight PAV, the crossed pair [0.50, 0.40] averages to 0.45
    # so the median moves only slightly
    assert abs(result[median_idx] - original_median) < 0.15, (
        f"Median shifted too much: {original_median} -> {result[median_idx]}"
    )


# ---------------------------------------------------------------------------
# 11. test_predict_quantiles_handles_nan_point_forecast
# ---------------------------------------------------------------------------
def test_predict_quantiles_handles_nan_point_forecast():
    """Property 1 invariant: predict_quantiles MUST return an all-finite
    vector even if the forecaster's `predict()` returns NaN or Inf.

    A NaN point forecast would otherwise produce a NaN quantile vector
    that poisons downstream CRPS scoring. The pipeline substitutes a
    flat 0.5 fan (the last-resort fallback) and increments
    `fallback_counter` so the runner-level audit surfaces the failure.
    """
    fc = NaiveForecaster()
    fc._last = float("nan")
    fc._fitted = True

    taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])

    # Case A: early-round (fallback path) with NaN point
    fc._residuals = [0.01] * 5
    pre = fc.fallback_counter
    q = fc.predict_quantiles(taus)
    assert np.all(np.isfinite(q)), f"NaN leaked through pipeline: {q}"
    assert len(q) == len(taus)
    assert fc.fallback_counter > pre, (
        "fallback_counter did not increment on non-finite raw quantiles"
    )

    # Case B: normal path with 50 residuals and NaN point
    fc2 = NaiveForecaster()
    fc2._last = float("nan")
    fc2._fitted = True
    fc2._residuals = [0.01] * 50
    q2 = fc2.predict_quantiles(taus)
    assert np.all(np.isfinite(q2))

    # Case C: Inf point
    fc3 = NaiveForecaster()
    fc3._last = float("inf")
    fc3._fitted = True
    fc3._residuals = [0.01] * 50
    q3 = fc3.predict_quantiles(taus)
    assert np.all(np.isfinite(q3))


# ---------------------------------------------------------------------------
# 12. test_predict_quantiles_handles_all_nan_residuals
# ---------------------------------------------------------------------------
def test_predict_quantiles_handles_all_nan_residuals():
    """If the residual buffer is all-NaN, the normal-path quantile
    generation would propagate NaN. The pipeline must still return a
    finite vector (falling through to the flat 0.5 last-resort fan)."""
    fc = NaiveForecaster()
    fc._last = 0.5
    fc._fitted = True
    fc._residuals = [float("nan")] * 50

    taus = np.array([0.1, 0.5, 0.9])
    q = fc.predict_quantiles(taus)
    assert np.all(np.isfinite(q)), f"NaN residuals leaked through pipeline: {q}"
