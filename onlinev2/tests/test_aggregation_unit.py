"""Unit tests for core/aggregation.py.

Covers weighted mean correctness, fallback on zero wagers, output shape
preservation in quantile mode, and uniform weights producing simple mean.

Requirements: 9.2
"""

import numpy as np
import pytest

from onlinev2.core.aggregation import aggregate_forecast

# ---------------------------------------------------------------------------
# Weighted mean correctness
# ---------------------------------------------------------------------------

class TestWeightedMean:
    """Known weights → known result for point and quantile modes."""

    def test_point_mode_known_weights(self):
        """w = [0.75, 0.25], reports = [1.0, 3.0] → 0.75*1 + 0.25*3 = 1.5."""
        reports = np.array([1.0, 3.0])
        m = np.array([3.0, 1.0])  # normalises to [0.75, 0.25]
        result = aggregate_forecast(reports, m)
        np.testing.assert_allclose(result, 1.5, atol=1e-12)

    def test_quantile_mode_known_weights(self):
        """Quantile mode: pointwise weighted average across K quantile levels."""
        reports = np.array([
            [0.1, 0.5, 0.9],  # agent 0
            [0.2, 0.6, 0.8],  # agent 1
        ])
        m = np.array([2.0, 2.0])  # equal weights
        result = aggregate_forecast(reports, m)
        expected = np.array([0.15, 0.55, 0.85])
        np.testing.assert_allclose(result, expected, atol=1e-12)

    def test_single_agent_returns_own_report(self):
        """Single agent with any positive wager → output equals its report."""
        reports = np.array([0.42])
        m = np.array([5.0])
        result = aggregate_forecast(reports, m)
        np.testing.assert_allclose(result, 0.42, atol=1e-12)

    def test_single_agent_quantile_mode(self):
        reports = np.array([[0.1, 0.3, 0.5, 0.7, 0.9]])
        m = np.array([1.0])
        result = aggregate_forecast(reports, m)
        np.testing.assert_allclose(result, reports[0], atol=1e-12)


# ---------------------------------------------------------------------------
# Uniform weights produce simple mean
# ---------------------------------------------------------------------------

class TestUniformWeights:
    """When all wagers are equal, the result is the simple arithmetic mean."""

    def test_uniform_point_mode(self):
        reports = np.array([1.0, 2.0, 3.0, 4.0])
        m = np.ones(4)
        result = aggregate_forecast(reports, m)
        np.testing.assert_allclose(result, 2.5, atol=1e-12)

    def test_uniform_quantile_mode(self):
        reports = np.array([
            [0.1, 0.5, 0.9],
            [0.3, 0.5, 0.7],
        ])
        m = np.ones(2)
        result = aggregate_forecast(reports, m)
        expected = np.mean(reports, axis=0)
        np.testing.assert_allclose(result, expected, atol=1e-12)


# ---------------------------------------------------------------------------
# Fallback on zero wagers
# ---------------------------------------------------------------------------

class TestZeroWagerFallback:
    """When all wagers are zero, aggregate should return fallback or zeros."""

    def test_zero_wagers_no_fallback_point(self):
        """No fallback provided → returns 0.0 in point mode."""
        reports = np.array([1.0, 2.0, 3.0])
        m = np.zeros(3)
        result = aggregate_forecast(reports, m)
        assert result == 0.0

    def test_zero_wagers_no_fallback_quantile(self):
        """No fallback provided → returns zeros matching quantile shape."""
        reports = np.array([[0.1, 0.5, 0.9], [0.2, 0.6, 0.8]])
        m = np.zeros(2)
        result = aggregate_forecast(reports, m)
        np.testing.assert_allclose(result, np.zeros(3), atol=1e-15)

    def test_zero_wagers_with_fallback_point(self):
        """Fallback provided → returns fallback value in point mode."""
        reports = np.array([1.0, 2.0])
        m = np.zeros(2)
        result = aggregate_forecast(reports, m, fallback=0.5)
        np.testing.assert_allclose(result, 0.5, atol=1e-12)

    def test_zero_wagers_with_fallback_quantile(self):
        """Fallback provided → returns fallback array in quantile mode."""
        reports = np.array([[0.1, 0.5, 0.9], [0.2, 0.6, 0.8]])
        m = np.zeros(2)
        fallback = np.array([0.3, 0.5, 0.7])
        result = aggregate_forecast(reports, m, fallback=fallback)
        np.testing.assert_allclose(result, fallback, atol=1e-12)


# ---------------------------------------------------------------------------
# Output shape matches input quantile shape
# ---------------------------------------------------------------------------

class TestOutputShape:
    """Output shape must match the quantile dimension of reports."""

    def test_point_mode_returns_scalar(self):
        reports = np.array([0.1, 0.5, 0.9])
        m = np.array([1.0, 2.0, 3.0])
        result = aggregate_forecast(reports, m)
        assert np.isscalar(result) or (isinstance(result, float))

    def test_quantile_mode_returns_correct_shape(self):
        K = 5
        n = 4
        reports = np.random.default_rng(0).uniform(size=(n, K))
        m = np.ones(n)
        result = aggregate_forecast(reports, m)
        assert result.shape == (K,)

    def test_quantile_mode_nine_levels(self):
        K = 9
        n = 3
        reports = np.random.default_rng(1).uniform(size=(n, K))
        m = np.array([1.0, 2.0, 3.0])
        result = aggregate_forecast(reports, m)
        assert result.shape == (K,)


# ---------------------------------------------------------------------------
# Alpha (missingness) handling
# ---------------------------------------------------------------------------

class TestAlphaMissingness:
    """Alpha mask zeroes out missing agents' wagers."""

    def test_alpha_excludes_agent(self):
        """Agent 0 missing (alpha=1) → only agent 1 contributes."""
        reports = np.array([100.0, 0.5])
        m = np.array([10.0, 1.0])
        alpha = np.array([1, 0])
        result = aggregate_forecast(reports, m, alpha=alpha)
        np.testing.assert_allclose(result, 0.5, atol=1e-12)

    def test_all_missing_returns_zero(self):
        reports = np.array([1.0, 2.0])
        m = np.array([1.0, 1.0])
        alpha = np.array([1, 1])
        result = aggregate_forecast(reports, m, alpha=alpha)
        assert result == 0.0
