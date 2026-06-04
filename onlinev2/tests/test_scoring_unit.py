"""Unit tests for core/scoring.py.

Covers CRPS non-negativity, pinball loss bounds, perfect-forecast behaviour,
TAUS_FINE / TAUS_COARSE constants, and equidistant vs non-equidistant grid quality.

Requirements: 9.1, 11.3
"""

import numpy as np
import pytest

from onlinev2.core.scoring import (
    TAUS_COARSE,
    TAUS_FINE,
    crps_hat_from_quantiles,
    pinball_loss,
    score_crps_hat,
)

# ---------------------------------------------------------------------------
# TAUS constants
# ---------------------------------------------------------------------------

class TestTausConstants:
    """Verify canonical quantile grid constants exist and are correct."""

    def test_taus_coarse_values(self):
        expected = np.array([0.1, 0.25, 0.5, 0.75, 0.9])
        np.testing.assert_array_equal(TAUS_COARSE, expected)

    def test_taus_fine_values(self):
        expected = np.array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9])
        np.testing.assert_array_equal(TAUS_FINE, expected)

    def test_taus_fine_is_equidistant(self):
        diffs = np.diff(TAUS_FINE)
        np.testing.assert_allclose(diffs, diffs[0], atol=1e-15)

    def test_taus_coarse_is_not_equidistant(self):
        diffs = np.diff(TAUS_COARSE)
        assert not np.allclose(diffs, diffs[0], atol=1e-10)

    def test_taus_fine_has_nine_levels(self):
        assert len(TAUS_FINE) == 9

    def test_taus_coarse_has_five_levels(self):
        assert len(TAUS_COARSE) == 5


# ---------------------------------------------------------------------------
# Pinball loss
# ---------------------------------------------------------------------------

class TestPinballLoss:
    """Pinball loss L^tau(y, q) must be non-negative for all valid inputs."""

    def test_pinball_non_negative_undershoot(self):
        """q < y: loss = tau * (y - q) >= 0."""
        loss = pinball_loss(y=0.8, q=0.3, tau=0.5)
        assert np.all(loss >= 0.0)

    def test_pinball_non_negative_overshoot(self):
        """q > y: loss = (1 - tau) * (q - y) >= 0."""
        loss = pinball_loss(y=0.3, q=0.8, tau=0.5)
        assert np.all(loss >= 0.0)

    def test_pinball_zero_at_perfect(self):
        """q == y: loss = 0."""
        loss = pinball_loss(y=0.5, q=0.5, tau=0.25)
        np.testing.assert_allclose(loss, 0.0, atol=1e-15)

    def test_pinball_vectorised(self):
        y = np.array([0.2, 0.5, 0.8])
        q = np.array([0.3, 0.5, 0.6])
        loss = pinball_loss(y, q, tau=0.5)
        assert loss.shape == (3,)
        assert np.all(loss >= 0.0)

    def test_pinball_invalid_tau_raises(self):
        with pytest.raises(ValueError, match="tau must be in"):
            pinball_loss(0.5, 0.5, tau=0.0)
        with pytest.raises(ValueError, match="tau must be in"):
            pinball_loss(0.5, 0.5, tau=1.0)


# ---------------------------------------------------------------------------
# CRPS non-negativity
# ---------------------------------------------------------------------------

class TestCRPSNonNegativity:
    """CRPS-hat must be >= 0 for any valid inputs."""

    def test_crps_non_negative_single_agent(self):
        y = 0.5
        q = np.array([[0.1, 0.3, 0.5, 0.7, 0.9]])
        crps = crps_hat_from_quantiles(y, q, TAUS_COARSE)
        assert np.all(crps >= 0.0)

    def test_crps_non_negative_multiple_agents(self):
        rng = np.random.default_rng(42)
        n = 10
        y = rng.uniform(0, 1)
        q = np.sort(rng.uniform(0, 1, size=(n, 5)), axis=1)
        crps = crps_hat_from_quantiles(y, q, TAUS_COARSE)
        assert crps.shape == (n,)
        assert np.all(crps >= 0.0)

    def test_crps_non_negative_extreme_outcome(self):
        """Outcome at boundary: y=0 and y=1."""
        q = np.array([[0.1, 0.3, 0.5, 0.7, 0.9]])
        for y in [0.0, 1.0]:
            crps = crps_hat_from_quantiles(y, q, TAUS_COARSE)
            assert np.all(crps >= 0.0)


# ---------------------------------------------------------------------------
# Perfect forecast has low CRPS
# ---------------------------------------------------------------------------

class TestPerfectForecast:
    """A perfect quantile forecast (all quantiles == y) should have low CRPS."""

    def test_perfect_forecast_low_crps(self):
        y = 0.5
        taus = TAUS_COARSE
        q = np.full((1, len(taus)), y)
        crps = crps_hat_from_quantiles(y, q, taus)
        # Not exactly zero because pinball loss at q=y is zero, so CRPS should be ~0
        assert crps[0] >= 0.0
        assert crps[0] < 0.01, f"Perfect forecast CRPS too high: {crps[0]}"

    def test_perfect_forecast_fine_grid(self):
        y = 0.3
        taus = TAUS_FINE
        q = np.full((1, len(taus)), y)
        crps = crps_hat_from_quantiles(y, q, taus)
        assert crps[0] >= 0.0
        assert crps[0] < 0.01

    def test_score_crps_hat_perfect_near_one(self):
        """score = 1 - crps/2; perfect forecast → score near 1."""
        y = 0.5
        q = np.full((1, len(TAUS_COARSE)), y)
        scores = score_crps_hat(y, q, TAUS_COARSE)
        assert scores[0] > 0.99


# ---------------------------------------------------------------------------
# Equidistant vs non-equidistant grid comparison
# ---------------------------------------------------------------------------

class TestEquidistantGrid:
    """Document that equidistant taus give better CRPS approximation.

    For a known distribution (e.g. N(0,1)), the true CRPS can be computed
    analytically. The equidistant grid should give a closer approximation
    because the trapezoidal rule is exact for equidistant grids.
    """

    def test_equidistant_better_approximation(self):
        """Compare CRPS-hat from TAUS_FINE vs TAUS_COARSE against a known
        distribution. For N(0,1), true CRPS ≈ 0.2821.

        We generate quantile forecasts from the true N(0,1) distribution
        and check that the finer equidistant grid gives a closer approximation.
        """
        from scipy import stats

        dist = stats.norm(0, 1)
        y = 0.0  # mean of N(0,1)

        # True quantiles from N(0,1)
        q_coarse = dist.ppf(TAUS_COARSE).reshape(1, -1)
        q_fine = dist.ppf(TAUS_FINE).reshape(1, -1)

        crps_coarse = crps_hat_from_quantiles(y, q_coarse, TAUS_COARSE)[0]
        crps_fine = crps_hat_from_quantiles(y, q_fine, TAUS_FINE)[0]

        # True CRPS for N(0,1) ≈ 1/sqrt(pi) ≈ 0.5642
        true_crps = 1.0 / np.sqrt(np.pi)

        error_coarse = abs(crps_coarse - true_crps)
        error_fine = abs(crps_fine - true_crps)

        # Document: equidistant grid gives better approximation
        assert error_fine <= error_coarse, (
            f"Expected equidistant grid to be at least as good: "
            f"error_fine={error_fine:.6f}, error_coarse={error_coarse:.6f}"
        )

    def test_both_grids_non_negative(self):
        rng = np.random.default_rng(123)
        y = rng.uniform(0, 1)
        q_coarse = np.sort(rng.uniform(0, 1, size=(1, 5)), axis=1)
        q_fine = np.sort(rng.uniform(0, 1, size=(1, 9)), axis=1)

        crps_c = crps_hat_from_quantiles(y, q_coarse, TAUS_COARSE)
        crps_f = crps_hat_from_quantiles(y, q_fine, TAUS_FINE)

        assert np.all(crps_c >= 0.0)
        assert np.all(crps_f >= 0.0)
