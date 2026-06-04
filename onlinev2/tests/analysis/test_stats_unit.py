"""Unit tests for onlinev2.analysis.stats.

Requirements: 14.1, 14.2, 14.3
"""

from __future__ import annotations

import math

import numpy as np
import pytest

from onlinev2.analysis.stats import compute_ci, compute_se, paired_delta_crps, sanitise_json

# ---------------------------------------------------------------------------
# paired_delta_crps
# ---------------------------------------------------------------------------


class TestPairedDeltaCrps:
    """Test paired_delta_crps with known inputs."""

    def test_basic_difference(self) -> None:
        method = np.array([0.5, 0.6, 0.7])
        baseline = np.array([0.8, 0.8, 0.8])
        result = paired_delta_crps(method, baseline)
        np.testing.assert_allclose(result, [-0.3, -0.2, -0.1])

    def test_identical_arrays_give_zero(self) -> None:
        arr = np.array([0.1, 0.2, 0.3])
        result = paired_delta_crps(arr, arr)
        np.testing.assert_allclose(result, 0.0, atol=1e-15)

    def test_single_element(self) -> None:
        result = paired_delta_crps(np.array([0.3]), np.array([0.5]))
        np.testing.assert_allclose(result, [-0.2])

    def test_returns_float64_array(self) -> None:
        result = paired_delta_crps(np.array([1, 2]), np.array([3, 4]))
        assert result.dtype == np.float64


# ---------------------------------------------------------------------------
# compute_se
# ---------------------------------------------------------------------------


class TestComputeSe:
    """Test compute_se edge cases."""

    def test_single_value_returns_zero(self) -> None:
        assert compute_se(np.array([0.5])) == 0.0

    def test_all_nan_returns_zero(self) -> None:
        assert compute_se(np.array([np.nan, np.nan, np.nan])) == 0.0

    def test_known_values(self) -> None:
        deltas = np.array([1.0, 2.0, 3.0, 4.0, 5.0])
        expected = float(np.std(deltas, ddof=1) / np.sqrt(5))
        assert math.isclose(compute_se(deltas), expected, rel_tol=1e-12)

    def test_constant_array_returns_zero(self) -> None:
        assert compute_se(np.array([0.5, 0.5, 0.5])) == 0.0

    def test_empty_array_returns_zero(self) -> None:
        assert compute_se(np.array([])) == 0.0

    def test_ignores_nan_values(self) -> None:
        """SE should be computed on finite values only."""
        deltas = np.array([1.0, 2.0, np.nan, 3.0])
        finite = np.array([1.0, 2.0, 3.0])
        expected = float(np.std(finite, ddof=1) / np.sqrt(3))
        assert math.isclose(compute_se(deltas), expected, rel_tol=1e-12)


# ---------------------------------------------------------------------------
# compute_ci
# ---------------------------------------------------------------------------


class TestComputeCi:
    """Test compute_ci produces correct bounds."""

    def test_default_z(self) -> None:
        low, high = compute_ci(1.0, 0.1)
        assert math.isclose(low, 1.0 - 1.96 * 0.1, rel_tol=1e-12)
        assert math.isclose(high, 1.0 + 1.96 * 0.1, rel_tol=1e-12)

    def test_custom_z(self) -> None:
        low, high = compute_ci(0.0, 1.0, z=2.576)
        assert math.isclose(low, -2.576, rel_tol=1e-12)
        assert math.isclose(high, 2.576, rel_tol=1e-12)

    def test_zero_se_gives_point(self) -> None:
        low, high = compute_ci(0.5, 0.0)
        assert low == high == 0.5

    def test_negative_mean(self) -> None:
        low, high = compute_ci(-0.02, 0.005)
        assert low < -0.02
        assert high > -0.02


# ---------------------------------------------------------------------------
# sanitise_json
# ---------------------------------------------------------------------------


class TestSanitiseJson:
    """Test sanitise_json replaces NaN/Inf with None."""

    def test_nan_replaced(self) -> None:
        assert sanitise_json(float("nan")) is None

    def test_inf_replaced(self) -> None:
        assert sanitise_json(float("inf")) is None

    def test_neg_inf_replaced(self) -> None:
        assert sanitise_json(float("-inf")) is None

    def test_finite_float_preserved(self) -> None:
        assert sanitise_json(3.14) == 3.14

    def test_nested_dict(self) -> None:
        obj = {"a": 1.0, "b": float("nan"), "c": {"d": float("inf")}}
        result = sanitise_json(obj)
        assert result == {"a": 1.0, "b": None, "c": {"d": None}}

    def test_list_with_nan(self) -> None:
        result = sanitise_json([1.0, float("nan"), 2.0])
        assert result == [1.0, None, 2.0]

    def test_numpy_nan(self) -> None:
        assert sanitise_json(np.float64("nan")) is None

    def test_numpy_array(self) -> None:
        arr = np.array([1.0, np.nan, np.inf])
        result = sanitise_json(arr)
        assert result == [1.0, None, None]

    def test_numpy_integer(self) -> None:
        assert sanitise_json(np.int64(42)) == 42
        assert isinstance(sanitise_json(np.int64(42)), int)
