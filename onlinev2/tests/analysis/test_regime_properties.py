"""Property tests for regime breakdown module.

Uses Hypothesis to verify correctness properties across random inputs.

Properties tested:
- Property 4: Regime per-round delta and statistics (Req 3.1, 3.3)
- Property 5: Regime partitioning correctness (Req 3.2)
- Property 6: Regime multi-seed aggregation (Req 3.7)
"""

from __future__ import annotations

import numpy as np
from hypothesis import given, settings
from hypothesis import strategies as st

from onlinev2.analysis.regime_breakdown import (
    RegimeStats,
    _get_early_late_indices,
    _get_volatility_indices,
    compute_regime_breakdown,
)
from onlinev2.analysis.stats import compute_ci, compute_se

# ---------------------------------------------------------------------------
# Strategies
# ---------------------------------------------------------------------------


@st.composite
def crps_arrays_1d(draw: st.DrawFn) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Generate 1D CRPS arrays and y for a single seed.

    Returns (crps_method, crps_baseline, y) each of shape (T,).
    Uses numpy RNG seeded by Hypothesis for efficiency.
    """
    T = draw(st.integers(min_value=50, max_value=500))
    seed = draw(st.integers(min_value=0, max_value=2**32 - 1))
    rng = np.random.default_rng(seed)
    crps_method = rng.uniform(0.0, 2.0, size=T)
    crps_baseline = rng.uniform(0.0, 2.0, size=T)
    y = rng.uniform(0.0, 1.0, size=T)
    return crps_method, crps_baseline, y


@st.composite
def y_array(draw: st.DrawFn) -> np.ndarray:
    """Generate a random y array of shape (T,) with T in [50, 500].

    Uses numpy RNG seeded by Hypothesis for efficiency.
    """
    T = draw(st.integers(min_value=50, max_value=500))
    seed = draw(st.integers(min_value=0, max_value=2**32 - 1))
    rng = np.random.default_rng(seed)
    return rng.uniform(0.0, 1.0, size=T)


@st.composite
def multi_seed_crps(draw: st.DrawFn) -> tuple[np.ndarray, np.ndarray, np.ndarray, int, int]:
    """Generate multi-seed CRPS arrays.

    Returns (crps_method, crps_baseline, y, K, T) where shapes are (K, T).
    Uses numpy RNG seeded by Hypothesis for efficiency.
    """
    K = draw(st.integers(min_value=2, max_value=10))
    T = draw(st.integers(min_value=50, max_value=200))
    seed = draw(st.integers(min_value=0, max_value=2**32 - 1))
    rng = np.random.default_rng(seed)
    crps_method = rng.uniform(0.0, 2.0, size=(K, T))
    crps_baseline = rng.uniform(0.0, 2.0, size=(K, T))
    y = rng.uniform(0.0, 1.0, size=(K, T))
    return crps_method, crps_baseline, y, K, T


# ---------------------------------------------------------------------------
# Property 4: Regime per-round delta and statistics
# ---------------------------------------------------------------------------


class TestRegimeDeltaAndStatistics:
    """Property 4 – mean, SE, CI computed correctly for each regime partition.

    **Validates: Requirements 3.1, 3.3**
    """

    @given(data=crps_arrays_1d())
    @settings(max_examples=100)
    def test_regime_stats_correct(
        self, data: tuple[np.ndarray, np.ndarray, np.ndarray]
    ) -> None:
        crps_method, crps_baseline, y = data
        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)

        T = len(crps_method)
        delta = crps_method - crps_baseline

        for regime in result:
            assert isinstance(regime, RegimeStats)
            assert regime.n_rounds >= 0

            if regime.n_rounds == 0:
                continue

            # Identify which rounds belong to this regime by name
            if "Early" in regime.regime_name:
                n_regime = int(np.floor(0.2 * T))
                indices = np.arange(0, n_regime)
            elif "Late" in regime.regime_name:
                n_regime = int(np.floor(0.2 * T))
                indices = np.arange(T - n_regime, T)
            elif "High-volatility" in regime.regime_name:
                abs_diff = np.abs(np.diff(y))
                q75 = np.percentile(abs_diff, 75)
                indices = np.where(abs_diff >= q75)[0] + 1
            elif "Low-volatility" in regime.regime_name:
                abs_diff = np.abs(np.diff(y))
                q25 = np.percentile(abs_diff, 25)
                indices = np.where(abs_diff <= q25)[0] + 1
            else:
                continue  # skip perturbation regimes (no sigma_hist)

            regime_deltas = delta[indices]
            expected_mean = float(np.mean(regime_deltas))
            expected_se = compute_se(regime_deltas)
            expected_ci_low, expected_ci_high = compute_ci(expected_mean, expected_se)

            assert abs(regime.mean_delta_crps - expected_mean) < 1e-10, (
                f"{regime.regime_name}: mean {regime.mean_delta_crps} != {expected_mean}"
            )
            assert abs(regime.se - expected_se) < 1e-10, (
                f"{regime.regime_name}: se {regime.se} != {expected_se}"
            )
            assert abs(regime.ci_low - expected_ci_low) < 1e-10, (
                f"{regime.regime_name}: ci_low {regime.ci_low} != {expected_ci_low}"
            )
            assert abs(regime.ci_high - expected_ci_high) < 1e-10, (
                f"{regime.regime_name}: ci_high {regime.ci_high} != {expected_ci_high}"
            )


# ---------------------------------------------------------------------------
# Property 5: Regime partitioning correctness
# ---------------------------------------------------------------------------


class TestRegimePartitioning:
    """Property 5 – early/late/high-vol/low-vol partitions are correct.

    **Validates: Requirements 3.2**
    """

    @given(y=y_array())
    @settings(max_examples=100)
    def test_early_late_partition(self, y: np.ndarray) -> None:
        T = len(y)
        early_idx, late_idx = _get_early_late_indices(T)
        n_regime = int(np.floor(0.2 * T))

        # Early = first floor(0.2*T) rounds
        expected_early = np.arange(0, n_regime)
        np.testing.assert_array_equal(early_idx, expected_early)

        # Late = last floor(0.2*T) rounds
        expected_late = np.arange(T - n_regime, T)
        np.testing.assert_array_equal(late_idx, expected_late)

    @given(y=y_array())
    @settings(max_examples=100)
    def test_volatility_partition(self, y: np.ndarray) -> None:
        high_vol_idx, low_vol_idx = _get_volatility_indices(y)

        abs_diff = np.abs(np.diff(y))
        q75 = np.percentile(abs_diff, 75)
        q25 = np.percentile(abs_diff, 25)

        # High-vol = top quartile of |y_t - y_{t-1}|
        expected_high = np.where(abs_diff >= q75)[0] + 1
        np.testing.assert_array_equal(high_vol_idx, expected_high)

        # Low-vol = bottom quartile of |y_t - y_{t-1}|
        expected_low = np.where(abs_diff <= q25)[0] + 1
        np.testing.assert_array_equal(low_vol_idx, expected_low)

    @given(y=y_array())
    @settings(max_examples=100)
    def test_early_count(self, y: np.ndarray) -> None:
        T = len(y)
        early_idx, _ = _get_early_late_indices(T)
        assert len(early_idx) == int(np.floor(0.2 * T))

    @given(y=y_array())
    @settings(max_examples=100)
    def test_late_count(self, y: np.ndarray) -> None:
        T = len(y)
        _, late_idx = _get_early_late_indices(T)
        assert len(late_idx) == int(np.floor(0.2 * T))


# ---------------------------------------------------------------------------
# Property 6: Regime multi-seed aggregation
# ---------------------------------------------------------------------------


class TestRegimeMultiSeedAggregation:
    """Property 6 – pooled stats computed over all K × n_regime_rounds.

    **Validates: Requirements 3.7**
    """

    @given(data=multi_seed_crps())
    @settings(max_examples=100)
    def test_multi_seed_pooling(
        self, data: tuple[np.ndarray, np.ndarray, np.ndarray, int, int]
    ) -> None:
        crps_method, crps_baseline, y, K, T = data
        result = compute_regime_breakdown(crps_method, crps_baseline, y)
        assert isinstance(result, list)

        delta = crps_method - crps_baseline  # (K, T)

        for regime in result:
            assert isinstance(regime, RegimeStats)

            if "Early" in regime.regime_name:
                n_regime = int(np.floor(0.2 * T))
                indices = np.arange(0, n_regime)
            elif "Late" in regime.regime_name:
                n_regime = int(np.floor(0.2 * T))
                indices = np.arange(T - n_regime, T)
            elif "High-volatility" in regime.regime_name:
                y_first = y[0]
                abs_diff = np.abs(np.diff(y_first))
                q75 = np.percentile(abs_diff, 75)
                indices = np.where(abs_diff >= q75)[0] + 1
            elif "Low-volatility" in regime.regime_name:
                y_first = y[0]
                abs_diff = np.abs(np.diff(y_first))
                q25 = np.percentile(abs_diff, 25)
                indices = np.where(abs_diff <= q25)[0] + 1
            else:
                continue

            # Pool across all seeds
            pooled = delta[:, indices].ravel()
            expected_n = pooled.size
            expected_mean = float(np.mean(pooled))
            expected_se = compute_se(pooled)

            assert regime.n_rounds == expected_n, (
                f"{regime.regime_name}: n_rounds {regime.n_rounds} != {expected_n}"
            )
            assert abs(regime.mean_delta_crps - expected_mean) < 1e-10, (
                f"{regime.regime_name}: mean {regime.mean_delta_crps} != {expected_mean}"
            )
            assert abs(regime.se - expected_se) < 1e-10, (
                f"{regime.regime_name}: se {regime.se} != {expected_se}"
            )
