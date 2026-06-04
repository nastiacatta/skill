"""
Tests for concentration metrics: HHI, N_eff, and Gini.
"""
import numpy as np
import pytest

from onlinev2.mechanism.metrics import (
    compute_gini,
    compute_hhi,
    compute_n_eff,
    compute_pit,
    compute_sharpness,
    validate_quantile_monotonicity,
)


class TestHHI:
    def test_equal_weights(self):
        w = np.ones(10) / 10
        hhi = compute_hhi(w)
        assert abs(hhi - 0.1) < 1e-10

    def test_monopoly(self):
        w = np.array([1.0, 0.0, 0.0, 0.0])
        hhi = compute_hhi(w)
        assert abs(hhi - 1.0) < 1e-10

    def test_zero_weights(self):
        w = np.zeros(5)
        hhi = compute_hhi(w)
        assert hhi == 0.0

    def test_unnormalised_weights(self):
        w = np.array([2.0, 2.0, 2.0, 2.0])
        hhi = compute_hhi(w)
        assert abs(hhi - 0.25) < 1e-10


class TestNEff:
    def test_equal_weights(self):
        w = np.ones(10) / 10
        n_eff = compute_n_eff(w)
        assert abs(n_eff - 10.0) < 1e-8

    def test_monopoly(self):
        w = np.array([1.0, 0.0, 0.0])
        n_eff = compute_n_eff(w)
        assert abs(n_eff - 1.0) < 1e-8

    def test_two_equal(self):
        w = np.array([0.5, 0.5])
        n_eff = compute_n_eff(w)
        assert abs(n_eff - 2.0) < 1e-8

    def test_zero_weights(self):
        """All-zero weights => N_eff = 0 (no active mass, not full participation)."""
        w = np.zeros(5)
        n_eff = compute_n_eff(w)
        assert n_eff == 0.0


class TestGini:
    def test_perfect_equality(self):
        x = np.ones(10) * 5.0
        gini = compute_gini(x)
        assert abs(gini) < 1e-10

    def test_maximal_inequality(self):
        n = 100
        x = np.zeros(n)
        x[0] = 100.0
        gini = compute_gini(x)
        assert gini > 0.95

    def test_moderate(self):
        x = np.array([1.0, 2.0, 3.0, 4.0, 10.0])
        gini = compute_gini(x)
        assert 0.0 < gini < 1.0

    def test_empty(self):
        x = np.array([])
        gini = compute_gini(x)
        assert gini == 0.0

    def test_all_zeros(self):
        x = np.zeros(5)
        gini = compute_gini(x)
        assert gini == 0.0


class TestPIT:
    def test_below_range(self):
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        quantiles = np.array([0.2, 0.3, 0.5, 0.7, 0.8])
        pit = compute_pit(0.0, quantiles, taus)
        assert pit == 0.1

    def test_above_range(self):
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        quantiles = np.array([0.2, 0.3, 0.5, 0.7, 0.8])
        pit = compute_pit(1.0, quantiles, taus)
        assert pit == 0.9

    def test_at_median(self):
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        quantiles = np.array([0.2, 0.3, 0.5, 0.7, 0.8])
        pit = compute_pit(0.5, quantiles, taus)
        assert abs(pit - 0.5) < 1e-10

    def test_interpolation(self):
        taus = np.array([0.1, 0.5, 0.9])
        quantiles = np.array([0.2, 0.5, 0.8])
        pit = compute_pit(0.35, quantiles, taus)
        assert 0.1 < pit < 0.5


class TestQuantileMonotonicity:
    def test_valid_ordered(self):
        q = np.array([0.1, 0.3, 0.5, 0.7, 0.9])
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        assert validate_quantile_monotonicity(q, taus) is True

    def test_crossing_quantiles(self):
        q = np.array([0.3, 0.2, 0.5, 0.7, 0.9])  # 0.3 > 0.2
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        assert validate_quantile_monotonicity(q, taus) is False

    def test_single_quantile(self):
        assert validate_quantile_monotonicity(np.array([0.5]), np.array([0.5])) is True


class TestSharpness:
    def test_narrow_distribution(self):
        taus = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        narrow = np.array([0.48, 0.49, 0.50, 0.51, 0.52])
        wide = np.array([0.1, 0.3, 0.5, 0.7, 0.9])

        sharp_narrow = compute_sharpness(narrow, taus)
        sharp_wide = compute_sharpness(wide, taus)

        assert sharp_narrow["interval_width"] < sharp_wide["interval_width"]
        assert sharp_narrow["iqr"] < sharp_wide["iqr"]


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
