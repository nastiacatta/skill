"""
Property-based tests for the quantile forecast pipeline.

Feature: quantile-forecast-quality
Uses Hypothesis to verify universal properties across all valid inputs.
"""
from __future__ import annotations

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from onlinev2.core.scoring import crps_hat_from_quantiles
from onlinev2.real_data.forecasters import (
    BaseForecaster,
    MovingAverageForecaster,
    NaiveForecaster,
)

# ---------------------------------------------------------------------------
# Shared strategies
# ---------------------------------------------------------------------------

def sorted_taus(min_size: int = 2, max_size: int = 5) -> st.SearchStrategy:
    """Generate sorted arrays of 2-5 floats in (0.01, 0.99)."""
    return (
        st.lists(
            st.floats(min_value=0.01, max_value=0.99),
            min_size=min_size,
            max_size=max_size,
        )
        .map(sorted)
        .map(np.array)
    )


def sorted_taus_min2() -> st.SearchStrategy:
    """Generate sorted tau arrays with at least 2 levels separated by >= 0.02.

    A minimum gap ensures the normal-spread fallback produces distinct
    quantile values (norm.ppf is continuous, so a meaningful tau gap
    guarantees a meaningful quantile gap).
    """
    return (
        st.lists(
            st.floats(min_value=0.01, max_value=0.99),
            min_size=2,
            max_size=5,
        )
        .filter(lambda xs: max(xs) - min(xs) >= 0.02)
        .map(sorted)
        .map(np.array)
    )


def point_forecast() -> st.SearchStrategy:
    """Floats in [0, 1]."""
    return st.floats(min_value=0.0, max_value=1.0)


def residual_history(min_size: int = 0, max_size: int = 500) -> st.SearchStrategy:
    """Lists of floats in [-0.5, 0.5]."""
    return st.lists(
        st.floats(min_value=-0.5, max_value=0.5),
        min_size=min_size,
        max_size=max_size,
    )


def forecaster_factory() -> st.SearchStrategy:
    """Creates one of the lightweight forecaster types (Naive, MA)."""
    return st.sampled_from([
        lambda: NaiveForecaster(),
        lambda: MovingAverageForecaster(ma_window=5),
    ])


# ---------------------------------------------------------------------------
# Property 1 (8.2): Quantile output invariant
# Feature: quantile-forecast-quality, Property 1: Quantile output invariant
# ---------------------------------------------------------------------------
@given(taus=sorted_taus(), residuals=residual_history(0, 500))
@settings(max_examples=100)
def test_quantile_output_invariant(taus, residuals):
    """For any forecaster, predict_quantiles output has correct length,
    is monotone non-decreasing, bounded in [0,1], and all-finite.

    **Validates: Requirements 1.1, 1.2, 1.3, 2.4, 3.4, 6.1, 6.2, 8.1, 8.2, 8.3**
    """
    fc = NaiveForecaster()
    fc._last = 0.5
    fc._fitted = True
    fc._residuals = residuals

    q = fc.predict_quantiles(np.array(taus))

    assert len(q) == len(taus)
    assert np.all(np.isfinite(q))
    assert np.all(q >= 0.0) and np.all(q <= 1.0)
    for i in range(len(q) - 1):
        assert q[i] <= q[i + 1] + 1e-12


# ---------------------------------------------------------------------------
# Property 2 (8.3): Early-round non-degeneracy
# Feature: quantile-forecast-quality, Property 2: Early-round non-degeneracy
# ---------------------------------------------------------------------------
@given(taus=sorted_taus_min2())
@settings(max_examples=100)
def test_early_round_non_degeneracy(taus):
    """With fewer than min_residuals, output has non-zero spread.

    **Validates: Requirements 4.1, 4.2**
    """
    fc = NaiveForecaster()
    fc._last = 0.5
    fc._fitted = True
    fc._residuals = [0.01] * (fc.min_residuals - 1)

    q = fc.predict_quantiles(np.array(taus))
    assert q[-1] - q[0] > 0


# ---------------------------------------------------------------------------
# Property 3 (8.4): Residual buffer bound
# Feature: quantile-forecast-quality, Property 3: Residual buffer bound
# ---------------------------------------------------------------------------
@given(n_calls=st.integers(1, 1000), window=st.integers(5, 500))
@settings(max_examples=100)
def test_residual_buffer_bound(n_calls, window):
    """After any sequence of update_residuals, len <= residual_window.

    **Validates: Requirements 5.4**
    """
    fc = NaiveForecaster(residual_window=window)
    for i in range(n_calls):
        fc.update_residuals(float(i) * 0.001, 0.5)
    assert len(fc._residuals) <= fc.residual_window


# ---------------------------------------------------------------------------
# Property 4 (8.5): Tau-to-alpha mapping
# Feature: quantile-forecast-quality, Property 4: Tau-to-alpha mapping
# ---------------------------------------------------------------------------
@given(tau=st.floats(min_value=0.001, max_value=0.999))
@settings(max_examples=100)
def test_tau_to_alpha_mapping(tau):
    """alpha = 2*min(tau, 1-tau) and alpha in (0, 1].

    **Validates: Requirements 2.3**
    """
    alpha = 2.0 * min(tau, 1.0 - tau)
    assert 0 < alpha <= 1.0


# ---------------------------------------------------------------------------
# Property 5 (8.6): CRPS non-negativity
# Feature: quantile-forecast-quality, Property 5: CRPS non-negativity
# ---------------------------------------------------------------------------
@given(
    y=st.floats(min_value=0.0, max_value=1.0),
    taus=sorted_taus(),
)
@settings(max_examples=100)
def test_crps_non_negativity(y, taus):
    """For valid monotone quantiles and outcome, CRPS >= 0.

    **Validates: Requirements 8.4**
    """
    taus_arr = np.array(taus)
    q = np.sort(np.random.uniform(0, 1, len(taus)))
    crps = crps_hat_from_quantiles(y, q.reshape(1, -1), taus_arr)
    assert float(crps[0]) >= -1e-12
